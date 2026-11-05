/**
 * Memory inspection + reclaim actions for a remote server.
 * Everything runs over SSH; nothing is persisted.
 */
import type {
  MemoryActionResult,
  MemoryBreakdown,
  MemoryContainer,
  MemoryProcess,
  MemoryProcessGroup,
  MemoryReport,
  Server,
} from '@launchpad/shared'
import { execCommand, getConnection } from './ssh'

type Ssh = Awaited<ReturnType<typeof getConnection>>

async function withSsh<T>(server: Server, handler: (ssh: Ssh) => Promise<T>) {
  let ssh: Ssh | null = null
  try {
    ssh = await getConnection(server)
    return await handler(ssh)
  } finally {
    ssh?.dispose()
  }
}

const DOCKER_BIN =
  'if command -v docker >/dev/null 2>&1; then D="$(command -v docker)"; elif [ -x /usr/bin/docker ]; then D=/usr/bin/docker; else D=""; fi'

/** Processes Launchpad will never signal: killing them can lock you out or take every app down. */
const PROTECTED_COMMANDS = [
  /^systemd/,
  /^init$/,
  /^sshd/,
  /^dockerd$/,
  /^containerd/,
  /^kthreadd$/,
  /^kworker/,
  /^ksoftirqd/,
  /^dbus-daemon$/,
  /^agetty$/,
  /^rsyslogd$/,
  /^cron$/,
]

export function isProtectedCommand(command: string) {
  return PROTECTED_COMMANDS.some((pattern) => pattern.test(command.trim()))
}

export const REPORT_SCRIPT = [
  'set +e',
  'export LC_ALL=C',
  'echo "@@meminfo"',
  'cat /proc/meminfo',
  'echo "@@elevate"',
  'if [ "$(id -u)" = 0 ]; then echo root; elif sudo -n true 2>/dev/null; then echo sudo; else echo none; fi',
  // This script and its helpers (ps, sort, awk…) run in their own session (sid = $$); hide them from the report.
  'ME=$$',
  'echo "@@ps"',
  // pid, user, rss(kB), %mem, %cpu, then args last (may contain spaces); comm + container id resolved per pid
  `ps -eo pid=,sid=,user:32=,rss=,pmem=,pcpu=,args= --sort=-rss 2>/dev/null | awk -v me="$ME" '$2 != me' | head -n 40 | while read -r pid sid user rss pmem pcpu args; do comm=$(cat /proc/$pid/comm 2>/dev/null); cid=$(grep -m1 -oE '[0-9a-f]{64}' /proc/$pid/cgroup 2>/dev/null | head -n 1); printf '%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\n' "$pid" "$user" "$rss" "$pmem" "$pcpu" "$comm" "$cid" "$args"; done`,
  'echo "@@groups"',
  `ps -eo sid=,rss=,comm= 2>/dev/null | awk -v me="$ME" '$1 != me { r=$2; $1=""; $2=""; sub(/^ +/, ""); a[$0]+=r; c[$0]++ } END { for (k in a) printf "%d\\t%d\\t%s\\n", a[k], c[k], k }' | sort -t "$(printf '\\t')" -k1,1 -rn | head -n 15`,
  DOCKER_BIN,
  'echo "@@docker"',
  'if [ -n "$D" ]; then echo available; "$D" stats --no-stream --format "{{.ID}}\\t{{.Name}}\\t{{.MemUsage}}\\t{{.MemPerc}}\\t{{.CPUPerc}}" 2>/dev/null; else echo unavailable; fi',
  'echo "@@dockerps"',
  'if [ -n "$D" ]; then "$D" ps --no-trunc --format "{{.ID}}\\t{{.Names}}\\t{{.Image}}" 2>/dev/null; fi',
  'echo "@@oom"',
  "(dmesg -T 2>/dev/null || journalctl -k --no-pager -n 3000 2>/dev/null) | grep -iE 'killed process|out of memory' | tail -n 5",
  'echo "@@end"',
].join('\n')

function splitSections(output: string) {
  const sections: Record<string, string[]> = {}
  let current = ''
  for (const raw of output.split('\n')) {
    const line = raw.replace(/\r$/, '')
    const marker = line.match(/^@@(\w+)$/)
    if (marker) {
      current = marker[1]
      sections[current] = []
      continue
    }
    if (current) sections[current].push(line)
  }
  return sections
}

const UNIT_FACTORS: Record<string, number> = {
  b: 1,
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
  tb: 1e12,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
}

/** Parse Docker sizes like "123.4MiB" or "1.2GB" */
export function parseDockerSize(value: string): number | undefined {
  const match = value.trim().match(/^([\d.]+)\s*([a-zA-Z]+)$/)
  if (!match) return undefined
  const factor = UNIT_FACTORS[match[2].toLowerCase()]
  const amount = Number(match[1])
  if (!factor || !Number.isFinite(amount)) return undefined
  return Math.round(amount * factor)
}

function parsePercent(value: string | undefined) {
  if (!value) return undefined
  const parsed = Number(value.replace('%', '').trim())
  return Number.isFinite(parsed) ? parsed : undefined
}

export function parseMeminfo(lines: string[]): MemoryBreakdown & { raw: Record<string, number> } {
  const raw: Record<string, number> = {}
  for (const line of lines) {
    const match = line.match(/^(\w+(?:\(\w+\))?):\s+(\d+)/)
    if (match) raw[match[1]] = Number(match[2]) * 1024
  }

  const total = raw.MemTotal ?? 0
  const free = raw.MemFree ?? 0
  // Kernels before 3.14 lack MemAvailable; approximate the way `free` does.
  const available = raw.MemAvailable ?? free + (raw.Buffers ?? 0) + (raw.Cached ?? 0)
  const cache = (raw.Buffers ?? 0) + (raw.Cached ?? 0) + (raw.SReclaimable ?? 0)
  const swapTotal = raw.SwapTotal ?? 0
  const swapFree = raw.SwapFree ?? 0

  return {
    raw,
    totalBytes: total,
    usedBytes: Math.max(0, total - available),
    availableBytes: available,
    freeBytes: free,
    cacheBytes: cache,
    sharedBytes: raw.Shmem ?? 0,
    swapTotalBytes: swapTotal,
    swapUsedBytes: Math.max(0, swapTotal - swapFree),
  }
}

export function parseProcesses(lines: string[], containerNames: Map<string, string>): MemoryProcess[] {
  const processes: MemoryProcess[] = []
  for (const line of lines) {
    if (!line.trim()) continue
    const [pid, user, rss, pmem, pcpu, comm, cid, ...rest] = line.split('\t')
    const pidNumber = Number(pid)
    const rssKb = Number(rss)
    if (!Number.isInteger(pidNumber) || !Number.isFinite(rssKb)) continue
    // Empty comm means the process exited before /proc was read (e.g. the report's own ps/head).
    if (!comm?.trim()) continue
    const args = rest.join('\t').trim()
    const command = comm.trim()
    processes.push({
      pid: pidNumber,
      user: user?.trim() ?? '',
      rssBytes: rssKb * 1024,
      memPercent: Number(pmem) || 0,
      cpuPercent: Number(pcpu) || 0,
      command,
      args: args.length > 300 ? `${args.slice(0, 300)}…` : args,
      containerName: cid ? containerNames.get(cid) : undefined,
      protected: pidNumber <= 1 || isProtectedCommand(command),
    })
  }
  return processes
}

export function parseGroups(lines: string[]): MemoryProcessGroup[] {
  return lines
    .map((line) => line.split('\t'))
    .filter((parts) => parts.length >= 3)
    .map(([rss, count, command]) => ({
      command: command.trim(),
      processCount: Number(count) || 0,
      rssBytes: (Number(rss) || 0) * 1024,
    }))
    .filter((group) => group.command && group.rssBytes > 0)
}

export function parseContainers(statsLines: string[], psLines: string[]): MemoryContainer[] {
  const images = new Map<string, string>()
  for (const line of psLines) {
    const [id, , image] = line.split('\t')
    if (id) images.set(id.slice(0, 12), image)
  }

  const containers: MemoryContainer[] = []
  for (const line of statsLines) {
    const [id, name, usage, memPerc, cpuPerc] = line.split('\t')
    if (!id || !name || !usage) continue
    const [used, limit] = usage.split('/').map((part) => part.trim())
    containers.push({
      id: id.slice(0, 12),
      name,
      image: images.get(id.slice(0, 12)),
      usageBytes: parseDockerSize(used) ?? 0,
      limitBytes: limit ? parseDockerSize(limit) : undefined,
      memPercent: parsePercent(memPerc),
      cpuPercent: parsePercent(cpuPerc),
    })
  }
  return containers.sort((a, b) => b.usageBytes - a.usageBytes)
}

export function parseMemoryReport(output: string, serverId: string): MemoryReport {
  const sections = splitSections(output)
  const dockerLines = sections.docker ?? []
  const dockerAvailable = dockerLines[0]?.trim() === 'available'

  const containerNames = new Map<string, string>()
  for (const line of sections.dockerps ?? []) {
    const [id, name] = line.split('\t')
    if (id && name) containerNames.set(id.trim(), name.trim())
  }

  const { raw: _raw, ...breakdown } = parseMeminfo(sections.meminfo ?? [])

  return {
    serverId,
    checkedAt: new Date().toISOString(),
    breakdown,
    topProcesses: parseProcesses(sections.ps ?? [], containerNames).slice(0, 30),
    groups: parseGroups(sections.groups ?? []),
    containers: dockerAvailable ? parseContainers(dockerLines.slice(1), sections.dockerps ?? []) : [],
    dockerAvailable,
    canElevate: ['root', 'sudo'].includes((sections.elevate ?? [])[0]?.trim() ?? ''),
    recentOomKills: (sections.oom ?? []).map((line) => line.trim()).filter(Boolean),
  }
}

export async function fetchMemoryReport(server: Server): Promise<MemoryReport> {
  return withSsh(server, async (ssh) => {
    const result = await execCommand(ssh, REPORT_SCRIPT)
    if (!result.stdout.includes('@@meminfo')) {
      throw new Error(result.stderr || 'Failed to read memory usage')
    }
    return parseMemoryReport(result.stdout, server.id)
  })
}

async function readAvailable(ssh: Ssh) {
  const result = await execCommand(ssh, "awk '/^MemAvailable:/ { print $2 * 1024 }' /proc/meminfo")
  const value = Number(result.stdout.trim())
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function combine(stdout: string, stderr: string) {
  return [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
}

/**
 * Drop the kernel page cache. Safe (no data loss) but only helps when cache is the issue,
 * and the cache refills as files are read again.
 */
export async function dropPageCache(server: Server): Promise<MemoryActionResult> {
  return withSsh(server, async (ssh) => {
    const before = await readAvailable(ssh)
    const result = await execCommand(
      ssh,
      `if [ "$(id -u)" = 0 ]; then sync && echo 3 > /proc/sys/vm/drop_caches; else sudo -n sh -c 'sync && echo 3 > /proc/sys/vm/drop_caches'; fi`
    )
    if (result.code !== 0) {
      const detail = combine(result.stdout, result.stderr)
      throw new Error(
        `Dropping caches needs root or passwordless sudo for the SSH user.${detail ? ` (${detail})` : ''}`
      )
    }
    const after = await readAvailable(ssh)
    return { success: true, output: 'Page cache, dentries and inodes dropped.', availableBeforeBytes: before, availableAfterBytes: after }
  })
}

const CONTAINER_REF = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/

export async function restartContainer(server: Server, container: string): Promise<MemoryActionResult> {
  if (!CONTAINER_REF.test(container)) {
    throw new Error('Invalid container id or name')
  }
  return withSsh(server, async (ssh) => {
    const before = await readAvailable(ssh)
    const result = await execCommand(ssh, `${DOCKER_BIN}; [ -n "$D" ] || { echo "Docker is not installed" >&2; exit 1; }; "$D" restart -t 15 ${container}`)
    if (result.code !== 0) {
      throw new Error(combine(result.stdout, result.stderr) || `Failed to restart ${container}`)
    }
    const after = await readAvailable(ssh)
    return { success: true, output: `Restarted container ${container}.`, availableBeforeBytes: before, availableAfterBytes: after }
  })
}

export async function killProcess(
  server: Server,
  pid: number,
  signal: 'TERM' | 'KILL'
): Promise<MemoryActionResult> {
  if (!Number.isInteger(pid) || pid <= 1) {
    throw new Error('Invalid process id')
  }
  return withSsh(server, async (ssh) => {
    const commResult = await execCommand(ssh, `cat /proc/${pid}/comm 2>/dev/null`)
    const command = commResult.stdout.trim()
    if (!command) {
      throw new Error(`Process ${pid} is no longer running.`)
    }
    if (isProtectedCommand(command)) {
      throw new Error(`Refusing to signal ${command} (pid ${pid}): it is a system process Launchpad protects.`)
    }

    const before = await readAvailable(ssh)
    const result = await execCommand(
      ssh,
      `if kill -${signal} ${pid} 2>/dev/null || sudo -n kill -${signal} ${pid} 2>/dev/null; then for i in 1 2 3 4 5; do [ -e /proc/${pid} ] || break; sleep 1; done; if [ -e /proc/${pid} ]; then echo still-running; else echo exited; fi; else echo denied; fi`
    )
    const state = result.stdout.trim().split('\n').pop()
    if (state === 'denied') {
      throw new Error(`Permission denied: the SSH user cannot signal ${command} (pid ${pid}). It needs to own the process, be root, or have passwordless sudo.`)
    }
    if (state !== 'exited' && state !== 'still-running') {
      throw new Error(combine(result.stdout, result.stderr) || `Failed to signal process ${pid}`)
    }
    const after = await readAvailable(ssh)
    return {
      success: state === 'exited',
      output:
        state === 'exited'
          ? `Sent SIG${signal} to ${command} (pid ${pid}); it exited.`
          : `Sent SIG${signal} to ${command} (pid ${pid}) but it is still running.${signal === 'TERM' ? ' Try Force kill.' : ''}`,
      availableBeforeBytes: before,
      availableAfterBytes: after,
    }
  })
}
