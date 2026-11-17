/**
 * Finds the reverse proxy on a server and reads, writes, validates and reloads its config.
 *
 * Two shapes are supported:
 *  - host: Caddy or Nginx installed on the server and run by systemd
 *  - docker: a Caddy or Nginx container, with its config bind-mounted from a host file or folder
 *
 * For a container, files are read and written on the host first. When the SSH user cannot touch the
 * host file, the same file is reached through the proxy container's own mount (`docker exec`), which
 * keeps the file's inode, so single-file bind mounts keep working.
 */
import { randomUUID } from 'crypto'
import { posix } from 'path'
import { asRoot } from './elevate'
import { execCommand, getConnection, writeRemoteTempFile } from './ssh'

type Ssh = Awaited<ReturnType<typeof getConnection>>

export type ProxyKind = 'caddy' | 'nginx' | 'none'

export interface ProxyContainer {
  name: string
  image: string
  type: Exclude<ProxyKind, 'none'>
  /** Publishes port 80 or 443 on the host */
  publishesWeb: boolean
  running: boolean
}

interface Mount {
  source: string
  destination: string
  rw: boolean
}

export interface ProxyTarget {
  type: ProxyKind
  mode: 'host' | 'docker' | 'none'
  container?: string
  containers: ProxyContainer[]
  /** Config path inside the container (docker mode) */
  innerConfigPath?: string
  mounts: Mount[]
}

export function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

/** Sets $D to a working docker command, or empty. */
export const DOCKER_CMD =
  'if command -v docker >/dev/null 2>&1 && docker ps -q >/dev/null 2>&1; then D=docker; elif sudo -n docker ps -q >/dev/null 2>&1; then D="sudo -n docker"; else D=""; fi'

const CONTAINER_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/

function proxyTypeOfImage(image: string): Exclude<ProxyKind, 'none'> | null {
  const repo = image.toLowerCase().split('@')[0].split(':')[0]
  const base = repo.split('/').pop() ?? ''
  if (base.includes('caddy')) return 'caddy'
  if (base === 'nginx' || base.startsWith('nginx-') || base.endsWith('-nginx') || base === 'openresty') return 'nginx'
  return null
}

export async function listProxyContainers(ssh: Ssh): Promise<ProxyContainer[]> {
  const result = await execCommand(
    ssh,
    `${DOCKER_CMD}; [ -n "$D" ] && $D ps -a --format '{{.Names}}\t{{.Image}}\t{{.State}}\t{{.Ports}}' 2>/dev/null`
  )
  const containers: ProxyContainer[] = []
  for (const line of result.stdout.split('\n')) {
    const [name, image, state, ports = ''] = line.trim().split('\t')
    if (!name || !image) continue
    const type = proxyTypeOfImage(image)
    if (!type) continue
    containers.push({
      name,
      image,
      type,
      running: state === 'running',
      publishesWeb: /:(80|443)->/.test(ports),
    })
  }
  // Running first, then the one that owns ports 80/443 (the server's front door).
  return containers.sort(
    (a, b) => Number(b.running) - Number(a.running) || Number(b.publishesWeb) - Number(a.publishesWeb) || a.name.localeCompare(b.name)
  )
}

async function inspectContainer(ssh: Ssh, name: string): Promise<{ mounts: Mount[]; args: string[] }> {
  const result = await execCommand(
    ssh,
    `${DOCKER_CMD}; [ -n "$D" ] && $D inspect --format '{{json .Mounts}}\n{{json .Args}}\n{{json .Config.Cmd}}' ${shellEscape(name)}`
  )
  const [mountsJson = '[]', argsJson = '[]', cmdJson = '[]'] = result.stdout.trim().split('\n')
  const parse = (value: string) => {
    try {
      return JSON.parse(value) ?? []
    } catch {
      return []
    }
  }
  const mounts = (parse(mountsJson) as any[])
    .filter((mount) => mount?.Source && mount?.Destination)
    .map((mount) => ({ source: String(mount.Source), destination: String(mount.Destination), rw: mount.RW !== false }))
  const args = [...(parse(argsJson) as string[]), ...(parse(cmdJson) as string[])]
  return { mounts, args }
}

function configFlag(args: string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--config' || arg === '-c') return args[index + 1]
    if (arg.startsWith('--config=')) return arg.slice('--config='.length)
  }
  return undefined
}

/** Map a path inside the container to the host, through its bind mounts. */
export function toHostPath(mounts: Mount[], inner: string): string | undefined {
  const sorted = [...mounts].sort((a, b) => b.destination.length - a.destination.length)
  for (const mount of sorted) {
    if (inner === mount.destination) return mount.source
    if (inner.startsWith(`${mount.destination.replace(/\/$/, '')}/`)) {
      return posix.join(mount.source, inner.slice(mount.destination.replace(/\/$/, '').length))
    }
  }
  return undefined
}

/** Map a host path into the container, through its bind mounts. */
export function toInnerPath(mounts: Mount[], host: string): { path: string; rw: boolean } | undefined {
  const sorted = [...mounts].sort((a, b) => b.source.length - a.source.length)
  for (const mount of sorted) {
    if (host === mount.source) return { path: mount.destination, rw: mount.rw }
    if (host.startsWith(`${mount.source.replace(/\/$/, '')}/`)) {
      return { path: posix.join(mount.destination, host.slice(mount.source.replace(/\/$/, '').length)), rw: mount.rw }
    }
  }
  return undefined
}

async function hostBinary(ssh: Ssh, name: 'caddy' | 'nginx') {
  const result = await execCommand(
    ssh,
    `PATH="$PATH:/usr/sbin:/sbin:/usr/local/sbin"; command -v ${name} >/dev/null 2>&1 && echo yes`
  )
  return result.stdout.trim() === 'yes'
}

/**
 * Work out which proxy to manage. A host-installed proxy wins, unless the caller picked a container.
 */
export async function resolveProxy(ssh: Ssh, preferredContainer?: string): Promise<ProxyTarget> {
  const containers = await listProxyContainers(ssh)
  const picked = preferredContainer && CONTAINER_NAME.test(preferredContainer)
    ? containers.find((item) => item.name === preferredContainer)
    : undefined

  if (!picked) {
    for (const type of ['caddy', 'nginx'] as const) {
      if (await hostBinary(ssh, type)) {
        return { type, mode: 'host', containers, mounts: [] }
      }
    }
  }

  const container = picked ?? containers[0]
  if (!container) {
    return { type: 'none', mode: 'none', containers, mounts: [] }
  }

  const { mounts, args } = await inspectContainer(ssh, container.name)
  const innerConfigPath =
    configFlag(args) ?? (container.type === 'caddy' ? '/etc/caddy/Caddyfile' : '/etc/nginx/nginx.conf')

  return { type: container.type, mode: 'docker', container: container.name, containers, innerConfigPath, mounts }
}

/** The host file to edit by default. */
export async function defaultConfigPath(ssh: Ssh, target: ProxyTarget): Promise<string> {
  if (target.mode === 'host') {
    if (target.type === 'nginx') {
      const result = await execCommand(
        ssh,
        "PATH=\"$PATH:/usr/sbin:/sbin\"; nginx -V 2>&1 | sed -n 's/.*--conf-path=\\([^ ]*\\).*/\\1/p' | head -n 1"
      )
      return result.stdout.trim() || '/etc/nginx/nginx.conf'
    }
    const result = await execCommand(
      ssh,
      "systemctl cat caddy 2>/dev/null | sed -n 's/^ExecStart=.*--config \\([^ ]*\\).*/\\1/p' | head -n 1"
    )
    return result.stdout.trim() || '/etc/caddy/Caddyfile'
  }

  if (target.mode === 'docker' && target.innerConfigPath) {
    const mapped = toHostPath(target.mounts, target.innerConfigPath)
    if (mapped) return mapped

    // Nginx images often mount only conf.d; edit the first site file there.
    const nginxMount = target.mounts.find((mount) => mount.destination.startsWith('/etc/nginx'))
    if (nginxMount) {
      const list = await execCommand(
        ssh,
        `if [ -d ${shellEscape(nginxMount.source)} ]; then ls -1 ${shellEscape(nginxMount.source)}/*.conf 2>/dev/null | head -n 1; else echo ${shellEscape(nginxMount.source)}; fi`
      )
      if (list.stdout.trim()) return list.stdout.trim()
    }
  }
  return ''
}

function dockerExec(target: ProxyTarget, command: string, interactive = false) {
  return `${DOCKER_CMD}; [ -n "$D" ] || { echo "Docker is not available to the SSH user." >&2; exit 127; }; $D exec ${interactive ? '-i ' : ''}${shellEscape(target.container ?? '')} ${command}`
}

export async function readConfig(ssh: Ssh, target: ProxyTarget, path: string): Promise<string> {
  const direct = await execCommand(ssh, `cat ${shellEscape(path)}`)
  if (direct.code === 0) return direct.stdout

  if (target.mode === 'docker') {
    const inner = toInnerPath(target.mounts, path)
    if (inner) {
      const viaContainer = await execCommand(ssh, dockerExec(target, `cat ${shellEscape(inner.path)}`))
      if (viaContainer.code === 0) return viaContainer.stdout
    }
  }

  const root = await execCommand(ssh, asRoot(`cat ${shellEscape(path)}`))
  if (root.code === 0) return root.stdout

  throw new Error(direct.stderr.trim() || `Failed to read ${path}`)
}

/**
 * Overwrite a config file in place (keeps the inode, so bind mounts see the change).
 * Returns how the file was written.
 */
export async function writeConfig(ssh: Ssh, target: ProxyTarget, path: string, content: string): Promise<'host' | 'container' | 'root'> {
  const staged = await writeRemoteTempFile(ssh, `/tmp/optizen-proxy-${randomUUID()}`, content)
  try {
    const direct = await execCommand(ssh, `[ ! -e ${shellEscape(path)} ] || [ -w ${shellEscape(path)} ] && cat ${shellEscape(staged)} > ${shellEscape(path)}`)
    if (direct.code === 0) return 'host'

    if (target.mode === 'docker') {
      const inner = toInnerPath(target.mounts, path)
      if (inner?.rw) {
        const viaContainer = await execCommand(
          ssh,
          `${dockerExec(target, `sh -c ${shellEscape(`cat > ${shellEscape(inner.path)}`)}`, true)} < ${shellEscape(staged)}`
        )
        if (viaContainer.code === 0) return 'container'
      }
    }

    const root = await execCommand(ssh, asRoot(`cat ${shellEscape(staged)} > ${shellEscape(path)}`))
    if (root.code === 0) return 'root'

    throw new Error(
      `The SSH user cannot write ${path}. Give it write access to the file, passwordless sudo, or Docker access.${direct.stderr.trim() ? ` (${direct.stderr.trim()})` : ''}`
    )
  } finally {
    await execCommand(ssh, `rm -f ${shellEscape(staged)}`).catch(() => undefined)
  }
}

/** Validate a candidate config before it goes live. Host mode only (containers validate after write). */
export async function validateCandidate(ssh: Ssh, target: ProxyTarget, path: string, content: string) {
  if (target.mode !== 'host') return { ok: true, output: '' }
  const staged = await writeRemoteTempFile(ssh, `/tmp/optizen-validate-${randomUUID()}`, content)
  try {
    const adapter = path.endsWith('.json') ? '' : ' --adapter caddyfile'
    const command =
      target.type === 'caddy'
        ? `caddy validate --config ${shellEscape(staged)}${adapter}`
        : `PATH="$PATH:/usr/sbin:/sbin"; nginx -t -c ${shellEscape(staged)} 2>&1 || sudo -n nginx -t -c ${shellEscape(staged)}`
    const result = await execCommand(ssh, command)
    return { ok: result.code === 0, output: (result.stderr || result.stdout).trim() }
  } finally {
    await execCommand(ssh, `rm -f ${shellEscape(staged)}`).catch(() => undefined)
  }
}

/** Check the live config as the running proxy sees it. */
export async function validateLive(ssh: Ssh, target: ProxyTarget) {
  if (target.mode !== 'docker' || !target.innerConfigPath) return { ok: true, output: '' }
  const adapter = target.innerConfigPath.endsWith('.json') ? '' : ' --adapter caddyfile'
  const command =
    target.type === 'caddy'
      ? dockerExec(target, `caddy validate --config ${shellEscape(target.innerConfigPath)}${adapter}`)
      : dockerExec(target, 'nginx -t')
  const result = await execCommand(ssh, `${command} 2>&1`)
  return { ok: result.code === 0, output: result.stdout.trim() }
}

export async function reloadProxy(ssh: Ssh, target: ProxyTarget) {
  let command: string
  if (target.mode === 'docker') {
    const adapter = target.innerConfigPath?.endsWith('.json') ? '' : ' --adapter caddyfile'
    command =
      target.type === 'caddy'
        ? dockerExec(target, `caddy reload --config ${shellEscape(target.innerConfigPath ?? '/etc/caddy/Caddyfile')}${adapter}`)
        : dockerExec(target, 'nginx -s reload')
  } else {
    command = `systemctl reload ${target.type} 2>&1 || { ${asRoot(`systemctl reload ${target.type}`)}; }`
  }
  const result = await execCommand(ssh, `${command} 2>&1`)
  return { ok: result.code === 0, output: result.stdout.trim() }
}

export async function proxyStatus(ssh: Ssh, target: ProxyTarget) {
  if (target.mode === 'none') return { running: false, version: '' }
  if (target.mode === 'docker') {
    const container = target.containers.find((item) => item.name === target.container)
    const version = await execCommand(
      ssh,
      dockerExec(target, target.type === 'caddy' ? 'caddy version' : 'nginx -v') + ' 2>&1'
    )
    return { running: Boolean(container?.running), version: version.stdout.trim().split('\n')[0] ?? '' }
  }
  const active = await execCommand(ssh, `systemctl is-active ${target.type}`)
  const version = await execCommand(
    ssh,
    target.type === 'caddy' ? 'caddy version 2>&1' : 'PATH="$PATH:/usr/sbin:/sbin"; nginx -v 2>&1'
  )
  return { running: active.stdout.trim() === 'active', version: version.stdout.trim() }
}

/** Best-effort copy next to the file. Optizen also keeps its own revision, so failure is not fatal. */
export async function backupConfig(ssh: Ssh, path: string): Promise<string | undefined> {
  const backupPath = `${path}.optizen-backup-${Date.now()}`
  const result = await execCommand(
    ssh,
    `cp -p ${shellEscape(path)} ${shellEscape(backupPath)} 2>/dev/null || { ${asRoot(`cp -p ${shellEscape(path)} ${shellEscape(backupPath)}`)}; } 2>/dev/null`
  )
  return result.code === 0 ? backupPath : undefined
}
