import type { Server, ServerResourceStatus } from '@launchpad/shared'
import { execCommand, getConnection } from './ssh'

function parseSingleNumber(value: string) {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : undefined
}

function parsePair(value: string) {
  const parts = value.trim().split(/\s+/).map((item) => Number(item))
  return parts.length >= 2 && parts.every((item) => Number.isFinite(item)) ? parts.slice(0, 2) as [number, number] : undefined
}

function parseTriple(value: string) {
  const parts = value.trim().split(/\s+/).map((item) => Number(item))
  return parts.length >= 3 && parts.slice(0, 3).every((item) => Number.isFinite(item)) ? parts.slice(0, 3) as [number, number, number] : undefined
}

function parseResourceSnapshot(output: string, serverId: string): ServerResourceStatus {
  const values = Object.fromEntries(
    output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(':')
        if (separator === -1) return [line, '']
        return [line.slice(0, separator), line.slice(separator + 1).trim()]
      })
  )

  const cpuUsagePercent = parseSingleNumber(values.cpu ?? '')
  const memoryPair = parsePair(values.memory ?? '')
  const diskPair = parsePair(values.disk ?? '')
  const loadAverage = parseTriple(values.load ?? '')
  const uptimeSeconds = parseSingleNumber(values.uptime ?? '')
  const inodeUsedPercent = parseSingleNumber(values.inodes ?? '')
  const cpuCoreCount = parseSingleNumber(values.cores ?? '')
  const containerTriple = parseTriple(values.containers ?? '')

  const memoryTotalBytes =
    memoryPair && memoryPair[0] > 0 && memoryPair[1] >= 0 ? memoryPair[0] * 1024 : undefined
  const memoryUsedBytes =
    memoryPair && memoryPair[0] > 0 && memoryPair[1] >= 0 ? Math.max(0, (memoryPair[0] - memoryPair[1]) * 1024) : undefined
  const diskTotalBytes =
    diskPair && diskPair[0] > 0 && diskPair[1] >= 0 ? diskPair[0] : undefined
  const diskUsedBytes =
    diskPair && diskPair[0] > 0 && diskPair[1] >= 0 ? Math.max(0, diskPair[1]) : undefined

  return {
    serverId,
    cpuUsagePercent: cpuUsagePercent !== undefined && cpuUsagePercent >= 0 ? cpuUsagePercent : undefined,
    cpuCoreCount: cpuCoreCount !== undefined && cpuCoreCount > 0 ? cpuCoreCount : undefined,
    memoryTotalBytes,
    memoryUsedBytes,
    diskTotalBytes,
    diskUsedBytes,
    uptimeSeconds: uptimeSeconds !== undefined && uptimeSeconds >= 0 ? uptimeSeconds : undefined,
    loadAverage,
    diskInodesUsedPercent: inodeUsedPercent !== undefined && inodeUsedPercent >= 0 ? inodeUsedPercent : undefined,
    runningContainers: containerTriple ? containerTriple[1] : undefined,
    exitedContainers: containerTriple ? containerTriple[2] : undefined,
    containersAvailable: containerTriple ? containerTriple[0] === 1 : undefined,
    checkedAt: new Date().toISOString(),
  }
}

export async function fetchServerResources(server: Server): Promise<ServerResourceStatus> {
  let ssh: Awaited<ReturnType<typeof getConnection>> | null = null

  try {
    ssh = await getConnection(server)
    const result = await execCommand(
      ssh,
      // CPU: two /proc/stat samples 1s apart (a single read is the average since boot). Idle = idle + iowait.
      "printf 'cpu:' && (head -n 1 /proc/stat; sleep 1; head -n 1 /proc/stat) | awk 'NR==1 { for (i=2; i<=9; i++) t1+=$i; i1=$5+$6 } NR==2 { for (i=2; i<=9; i++) t2+=$i; i2=$5+$6 } END { dt=t2-t1; if (dt > 0) printf \"%.2f\\n\", (1-(i2-i1)/dt)*100; else print \"0\" }' && printf 'memory:' && awk '/MemTotal:/ { total=$2 } /MemAvailable:/ { available=$2 } END { printf \"%s %s\\n\", total, available }' /proc/meminfo && printf 'disk:' && df -B1 --output=size,used / | tail -n 1 && printf 'load:' && awk '{print $1, $2, $3}' /proc/loadavg && printf 'uptime:' && cut -d. -f1 /proc/uptime && printf 'inodes:' && df -i --output=pcent / | tail -n 1 | tr -dc '0-9\\n' && printf 'cores:' && nproc && if command -v docker >/dev/null 2>&1; then printf 'containers:1 %s %s\\n' \"$(docker ps -q 2>/dev/null | wc -l)\" \"$(docker ps -aq -f status=exited 2>/dev/null | wc -l)\"; elif [ -x /usr/bin/docker ]; then printf 'containers:1 %s %s\\n' \"$(/usr/bin/docker ps -q 2>/dev/null | wc -l)\" \"$(/usr/bin/docker ps -aq -f status=exited 2>/dev/null | wc -l)\"; else printf 'containers:0 0 0\\n'; fi"
    )

    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || 'Failed to read server resources')
    }

    return parseResourceSnapshot(result.stdout, server.id)
  } finally {
    ssh?.dispose()
  }
}
