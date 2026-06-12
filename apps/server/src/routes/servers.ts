import { randomUUID } from 'crypto'
import { Elysia, t } from 'elysia'
import type { Server, ServerConnectionStatus } from '@launchpad/shared'
import { recordActivity } from '../lib/activity'
import { encrypt, hasKey } from '../lib/crypto'
import { requireDangerousActionAuth } from '../lib/dangerousAction'
import { getDb, saveDb } from '../lib/db'
import { sendServerDiskWarningNotification } from '../lib/notifications'
import { inferProjectRuntime, inferProjectSource, inferProxyTypeFromProject } from '../lib/projectInference'
import { fetchServerResources } from '../lib/resources'
import { execCommand, getConnection, testConnection } from '../lib/ssh'

const serverBody = t.Object({
  name: t.String({ minLength: 1 }),
  host: t.String({ minLength: 1 }),
  port: t.Number({ minimum: 1, maximum: 65535 }),
  user: t.String({ minLength: 1 }),
  sshKeyPath: t.String({ minLength: 1 }),
  sshPassphrase: t.Optional(t.String()),
  diskAlertThresholdPercent: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
})

function requireCryptoReady(set: { status?: number | string }) {
  if (!hasKey()) {
    set.status = 401
    throw new Error('Encryption key not loaded. Please log in again.')
  }
}

function serializeServer(server: Server) {
  return {
    ...server,
    sshPassphrase: server.sshPassphrase ? '••••••••' : '',
  }
}

function splitImageRef(image: string) {
  const digestIndex = image.indexOf('@')
  const withoutDigest = digestIndex >= 0 ? image.slice(0, digestIndex) : image
  const lastColon = withoutDigest.lastIndexOf(':')
  const lastSlash = withoutDigest.lastIndexOf('/')

  if (lastColon > lastSlash) {
    return {
      repository: withoutDigest.slice(0, lastColon),
      tag: withoutDigest.slice(lastColon + 1),
    }
  }

  return {
    repository: withoutDigest,
    tag: 'latest',
  }
}

const STORAGE_AUDIT_ITEMS = [
  { key: 'docker_root', label: 'Docker data', path: '/var/lib/docker', note: 'Images, layers, volumes, and container metadata managed by Docker.' },
  { key: 'containerd_root', label: 'containerd data', path: '/var/lib/containerd', note: 'Runtime content store and snapshots used underneath Docker/containerd.' },
  { key: 'journal_logs', label: 'systemd journal', path: '/var/log/journal', note: 'Persisted system logs that can quietly grow over time.' },
  { key: 'apt_cache', label: 'APT cache', path: '/var/cache/apt', note: 'Downloaded package archives left behind after installs and upgrades.' },
  { key: 'tmp', label: 'Temporary files', path: '/tmp', note: 'Short-lived temp data; repeated build or runtime leftovers can accumulate here.' },
  { key: 'var_tmp', label: 'Persistent temp files', path: '/var/tmp', note: 'Temporary files kept across reboots and often forgotten.' },
] as const

type StorageAuditItem = {
  key: string
  label: string
  path: string
  note: string
  sizeBytes: number
  breakdown?: Array<{
    path: string
    sizeBytes: number
  }>
}

type StorageAuditDiagnostic = {
  step: string
  message: string
}

const SAFE_CLEANUP_COMMANDS = [
  'docker image prune -f',
  'docker container prune -f',
  'docker builder prune -af',
  'journalctl --vacuum-time=7d',
  'apt-get clean',
] as const

const DEEP_CLEANUP_COMMANDS = [
  'docker system prune -af',
  'docker builder prune -af',
  'journalctl --vacuum-time=7d',
  'apt-get clean',
] as const
const STORAGE_AUDIT_TIMEOUT_SECONDS = 20

function createFallbackStorageAudit(message: string) {
  return {
    checkedAt: new Date().toISOString(),
    dockerAvailable: false,
    items: [] as StorageAuditItem[],
    dockerSystemDf: '',
    diagnostics: [{ step: 'audit', message }],
    cleanupCommands: [...SAFE_CLEANUP_COMMANDS],
  }
}

function logServerRouteError(route: string, serverId: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(`[servers:${route}]`, {
    serverId,
    ...extra,
    error,
  })
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
}

function buildTimedShell(command: string, useSudo = false) {
  const escaped = command.replace(/"/g, '\\"')
  const runner = useSudo ? `sudo -n sh -c "${escaped}"` : `sh -c "${escaped}"`
  return `if command -v timeout >/dev/null 2>&1; then timeout ${STORAGE_AUDIT_TIMEOUT_SECONDS}s ${runner}; else ${runner}; fi`
}

function buildSizeCommand(path: string, useSudo = false) {
  return [
    `if [ ! -e '${path}' ]; then echo "__MISSING__";`,
    `elif [ ! -d '${path}' ]; then echo "__NOT_A_DIRECTORY__";`,
    useSudo ? '' : `elif [ ! -r '${path}' ] || [ ! -x '${path}' ]; then echo "__PERMISSION_DENIED__";`,
    `else ${buildTimedShell(`du -sk ${shellEscape(path)} 2>/dev/null | cut -f1`, useSudo)}; fi`,
  ].join(' ')
}

function buildBreakdownCommand(path: string, useSudo = false) {
  return [
    `if [ ! -e '${path}' ]; then echo "__MISSING__";`,
    `elif [ ! -d '${path}' ]; then echo "__NOT_A_DIRECTORY__";`,
    useSudo ? '' : `elif [ ! -r '${path}' ] || [ ! -x '${path}' ]; then echo "__PERMISSION_DENIED__";`,
    `else ${buildTimedShell(`du -sk ${shellEscape(path)}/* 2>/dev/null | sort -rn | head -n 6`, useSudo)}; fi`,
  ].join(' ')
}

async function runAuditCommandWithSudoRetry(
  ssh: Awaited<ReturnType<typeof getConnection>>,
  commandBuilder: (useSudo?: boolean) => string
) {
  const initial = await execCommand(ssh, commandBuilder(false))
  if (initial.stdout.trim() !== '__PERMISSION_DENIED__') {
    return { result: initial, usedSudo: false, sudoUnavailable: false }
  }

  const sudoCheck = await execCommand(ssh, 'sudo -n true >/dev/null 2>&1; echo $?')
  if (sudoCheck.stdout.trim() !== '0') {
    return { result: initial, usedSudo: false, sudoUnavailable: true }
  }

  const elevated = await execCommand(ssh, commandBuilder(true))
  return { result: elevated, usedSudo: true, sudoUnavailable: false }
}

async function maybeSendDiskWarning(server: Server, resources: Server['lastResourceStatus']) {
  if (!resources?.diskUsedBytes || !resources.diskTotalBytes || resources.diskTotalBytes <= 0) return

  const thresholdPercent = server.diskAlertThresholdPercent ?? 50
  const usedPercent = (resources.diskUsedBytes / resources.diskTotalBytes) * 100
  if (!Number.isFinite(usedPercent) || usedPercent < thresholdPercent) return

  const now = Date.now()
  const lastSentAt = server.lastDiskAlertAt ? new Date(server.lastDiskAlertAt).getTime() : 0
  const cooldownMs = 12 * 60 * 60 * 1000
  if (lastSentAt && now - lastSentAt < cooldownMs) return

  await sendServerDiskWarningNotification({
    server,
    usedPercent,
    thresholdPercent,
  })
  server.lastDiskAlertAt = new Date(now).toISOString()
}

async function withSsh<T>(server: Server, handler: (ssh: Awaited<ReturnType<typeof getConnection>>) => Promise<T>) {
  let ssh: Awaited<ReturnType<typeof getConnection>> | null = null
  try {
    ssh = await getConnection(server)
    return await handler(ssh)
  } finally {
    ssh?.dispose()
  }
}

async function fetchServerStorageAudit(server: Server) {
  return withSsh(server, async (ssh) => {
    const items: StorageAuditItem[] = []
    const diagnostics: StorageAuditDiagnostic[] = []
    let dockerAvailable = false

    try {
      const dockerCheck = await execCommand(
        ssh,
        'if command -v docker >/dev/null 2>&1; then echo 1; elif [ -x /usr/bin/docker ]; then echo 1; else echo 0; fi'
      )
      dockerAvailable = dockerCheck.stdout.trim() === '1'
      if (dockerCheck.code !== 0) {
        diagnostics.push({
          step: 'docker-check',
          message: dockerCheck.stderr.trim() || dockerCheck.stdout.trim() || 'Docker availability check exited unexpectedly.',
        })
      }
    } catch (error) {
      logServerRouteError('storage-audit:docker-check', server.id, error)
      diagnostics.push({
        step: 'docker-check',
        message: error instanceof Error ? error.message : 'Docker availability check failed.',
      })
    }

    for (const metadata of STORAGE_AUDIT_ITEMS) {
      try {
        let breakdown: StorageAuditItem['breakdown']
        if (metadata.key === 'containerd_root' || metadata.key === 'docker_root') {
          try {
            const breakdownAttempt = await runAuditCommandWithSudoRetry(ssh, (useSudo = false) => buildBreakdownCommand(metadata.path, useSudo))
            const breakdownResult = breakdownAttempt.result
            const breakdownOutput = breakdownResult.stdout.trim()
            if (breakdownOutput === '__PERMISSION_DENIED__') {
              diagnostics.push({
                step: `breakdown:${metadata.key}`,
                message: breakdownAttempt.sudoUnavailable
                  ? `Permission denied while inspecting ${metadata.path}. This SSH user cannot read it, and passwordless sudo is not available.`
                  : `Permission denied while inspecting ${metadata.path}. Use an SSH user with read access or allow passwordless sudo for this audit.`,
              })
            } else if (breakdownOutput === '__MISSING__') {
              diagnostics.push({
                step: `breakdown:${metadata.key}`,
                message: `${metadata.path} does not exist on this host.`,
              })
            } else if (breakdownOutput === '__NOT_A_DIRECTORY__') {
              diagnostics.push({
                step: `breakdown:${metadata.key}`,
                message: `${metadata.path} exists but is not a directory.`,
              })
            } else {
              breakdown = breakdownResult.stdout
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                  const match = line.match(/^(\d+)\s+(.+)$/)
                  if (!match) return null
                  return {
                    sizeBytes: Number(match[1]) * 1024,
                    path: match[2],
                  }
                })
                .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
              if (breakdownAttempt.usedSudo) {
                diagnostics.push({
                  step: `breakdown:${metadata.key}`,
                  message: `Inspected ${metadata.path} using passwordless sudo.`,
                })
              }
            }

            if (breakdownResult.code === 124) {
              diagnostics.push({
                step: `breakdown:${metadata.key}`,
                message: `Timed out after ${STORAGE_AUDIT_TIMEOUT_SECONDS}s while inspecting ${metadata.path}.`,
              })
            }
          } catch (error) {
            logServerRouteError('storage-audit:breakdown', server.id, error, { bucket: metadata.key, path: metadata.path })
            diagnostics.push({
              step: `breakdown:${metadata.key}`,
              message: error instanceof Error ? error.message : `Failed to inspect ${metadata.path}.`,
            })
          }
        }

        const sizeAttempt = await runAuditCommandWithSudoRetry(ssh, (useSudo = false) => buildSizeCommand(metadata.path, useSudo))
        const sizeResult = sizeAttempt.result
        const sizeOutput = sizeResult.stdout.trim()
        const sizeKiB = Number(sizeOutput)
        if (Number.isFinite(sizeKiB) && sizeKiB >= 0) {
          items.push({
            key: metadata.key,
            label: metadata.label,
            path: metadata.path,
            note: metadata.note,
            sizeBytes: sizeKiB * 1024,
            breakdown,
          })
          if (sizeAttempt.usedSudo) {
            diagnostics.push({
              step: `size:${metadata.key}`,
              message: `Scanned ${metadata.path} using passwordless sudo.`,
            })
          }
        } else if (sizeOutput === '__PERMISSION_DENIED__') {
          diagnostics.push({
            step: `size:${metadata.key}`,
            message: sizeAttempt.sudoUnavailable
              ? `Permission denied while scanning ${metadata.path}. This SSH user cannot read it, and passwordless sudo is not available.`
              : `Permission denied while scanning ${metadata.path}. Use an SSH user with read access or allow passwordless sudo for this audit.`,
          })
        } else if (sizeOutput === '__MISSING__') {
          diagnostics.push({
            step: `size:${metadata.key}`,
            message: `${metadata.path} does not exist on this host.`,
          })
        } else if (sizeOutput === '__NOT_A_DIRECTORY__') {
          diagnostics.push({
            step: `size:${metadata.key}`,
            message: `${metadata.path} exists but is not a directory.`,
          })
        } else if (sizeResult.code === 124 && breakdown?.length) {
          const estimatedSizeBytes = breakdown.reduce((sum, entry) => sum + entry.sizeBytes, 0)
          items.push({
            key: metadata.key,
            label: metadata.label,
            path: metadata.path,
            note: `${metadata.note} Estimated from the largest children because the full scan timed out.`,
            sizeBytes: estimatedSizeBytes,
            breakdown,
          })
          diagnostics.push({
            step: `size:${metadata.key}`,
            message: `Timed out after ${STORAGE_AUDIT_TIMEOUT_SECONDS}s while scanning ${metadata.path}; showing an estimate from the largest children.`,
          })
        } else {
          diagnostics.push({
            step: `size:${metadata.key}`,
            message: `Unexpected size output: ${sizeOutput || '(empty)'}`,
          })
        }
      } catch (error) {
        logServerRouteError('storage-audit:size', server.id, error, { bucket: metadata.key, path: metadata.path })
        diagnostics.push({
          step: `size:${metadata.key}`,
          message: error instanceof Error ? error.message : `Failed to read ${metadata.path}.`,
        })
      }
    }

    items.sort((a, b) => b.sizeBytes - a.sizeBytes)

    let dockerSystemDf = ''
    if (dockerAvailable) {
      try {
        const dockerDfResult = await execCommand(
          ssh,
          'if command -v docker >/dev/null 2>&1; then DOCKER_BIN="$(command -v docker)"; elif [ -x /usr/bin/docker ]; then DOCKER_BIN="/usr/bin/docker"; else DOCKER_BIN=""; fi; if [ -n "$DOCKER_BIN" ]; then "$DOCKER_BIN" system df 2>/dev/null; fi'
        )
        dockerSystemDf = dockerDfResult.stdout.trim()
        if (!dockerSystemDf) {
          const sudoCheck = await execCommand(ssh, 'sudo -n true >/dev/null 2>&1; echo $?')
          if (sudoCheck.stdout.trim() === '0') {
            const dockerDfSudoResult = await execCommand(
              ssh,
              'if command -v docker >/dev/null 2>&1; then DOCKER_BIN="$(command -v docker)"; elif [ -x /usr/bin/docker ]; then DOCKER_BIN="/usr/bin/docker"; else DOCKER_BIN=""; fi; if [ -n "$DOCKER_BIN" ]; then sudo -n "$DOCKER_BIN" system df 2>/dev/null; fi'
            )
            dockerSystemDf = dockerDfSudoResult.stdout.trim()
            if (dockerSystemDf) {
              diagnostics.push({
                step: 'docker-system-df',
                message: 'Read Docker disk usage using passwordless sudo.',
              })
            }
          }
        }
        if (!dockerSystemDf) {
          dockerSystemDf = 'Docker disk details unavailable for this SSH user.'
        }
      } catch (error) {
        logServerRouteError('storage-audit:docker-system-df', server.id, error)
        diagnostics.push({
          step: 'docker-system-df',
          message: error instanceof Error ? error.message : 'Failed to inspect Docker disk usage.',
        })
        dockerSystemDf = 'Docker disk details unavailable for this SSH user.'
      }
    }

    return {
      checkedAt: new Date().toISOString(),
      dockerAvailable,
      items,
      dockerSystemDf,
      diagnostics,
      cleanupCommands: [...SAFE_CLEANUP_COMMANDS],
    }
  })
}

async function fetchServerStorageOverview(server: Server) {
  const diagnostics: StorageAuditDiagnostic[] = []
  let dockerAvailable = false
  let dockerSystemDf = ''
  let rootSizeBytes = 0
  let rootUsedBytes = 0

  try {
    const resources = await fetchServerResources(server)
    rootSizeBytes = resources.diskTotalBytes ?? 0
    rootUsedBytes = resources.diskUsedBytes ?? 0
  } catch (error) {
    logServerRouteError('storage-overview:resources', server.id, error)
    diagnostics.push({
      step: 'root-disk',
      message: error instanceof Error ? error.message : 'Failed to read root disk usage.',
    })
  }

  await withSsh(server, async (ssh) => {
    try {
      const dockerCheck = await execCommand(
        ssh,
        'if command -v docker >/dev/null 2>&1; then echo 1; elif [ -x /usr/bin/docker ]; then echo 1; else echo 0; fi'
      )
      dockerAvailable = dockerCheck.stdout.trim() === '1'
    } catch (error) {
      logServerRouteError('storage-overview:docker-check', server.id, error)
      diagnostics.push({
        step: 'docker-check',
        message: error instanceof Error ? error.message : 'Docker availability check failed.',
      })
    }

    if (dockerAvailable) {
      try {
        const dockerDfResult = await execCommand(
          ssh,
          'if command -v docker >/dev/null 2>&1; then DOCKER_BIN="$(command -v docker)"; elif [ -x /usr/bin/docker ]; then DOCKER_BIN="/usr/bin/docker"; else DOCKER_BIN=""; fi; if [ -n "$DOCKER_BIN" ]; then "$DOCKER_BIN" system df 2>/dev/null; fi'
        )
        dockerSystemDf = dockerDfResult.stdout.trim()
        if (!dockerSystemDf) {
          const sudoCheck = await execCommand(ssh, 'sudo -n true >/dev/null 2>&1; echo $?')
          if (sudoCheck.stdout.trim() === '0') {
            const dockerDfSudoResult = await execCommand(
              ssh,
              'if command -v docker >/dev/null 2>&1; then DOCKER_BIN="$(command -v docker)"; elif [ -x /usr/bin/docker ]; then DOCKER_BIN="/usr/bin/docker"; else DOCKER_BIN=""; fi; if [ -n "$DOCKER_BIN" ]; then sudo -n "$DOCKER_BIN" system df 2>/dev/null; fi'
            )
            dockerSystemDf = dockerDfSudoResult.stdout.trim()
            if (dockerSystemDf) {
              diagnostics.push({
                step: 'docker-system-df',
                message: 'Read Docker disk usage using passwordless sudo.',
              })
            }
          }
        }
        if (!dockerSystemDf) {
          dockerSystemDf = 'Docker disk details unavailable for this SSH user.'
        }
      } catch (error) {
        logServerRouteError('storage-overview:docker-system-df', server.id, error)
        diagnostics.push({
          step: 'docker-system-df',
          message: error instanceof Error ? error.message : 'Failed to inspect Docker disk usage.',
        })
      }
    }
  })

  const items: StorageAuditItem[] = rootSizeBytes > 0
    ? [{
        key: 'root_filesystem',
        label: 'Root filesystem',
        path: '/',
        note: 'Fast overview from filesystem metadata. This is quick and does not scan directory trees.',
        sizeBytes: rootUsedBytes,
      }]
    : []

  return {
    checkedAt: new Date().toISOString(),
    dockerAvailable,
    items,
    dockerSystemDf,
    diagnostics,
    cleanupCommands: [...SAFE_CLEANUP_COMMANDS],
  }
}

async function runServerStorageCleanup(server: Server, mode: 'safe' | 'deep' = 'safe') {
  return withSsh(server, async (ssh) => {
    const cleanupCommands = mode === 'deep' ? DEEP_CLEANUP_COMMANDS : SAFE_CLEANUP_COMMANDS
    const cleanupScript = [
      'set +e',
      'if command -v docker >/dev/null 2>&1; then DOCKER_BIN="$(command -v docker)"; elif [ -x /usr/bin/docker ]; then DOCKER_BIN="/usr/bin/docker"; else DOCKER_BIN=""; fi',
      mode === 'deep'
        ? 'if [ -n "$DOCKER_BIN" ]; then echo "$ docker system prune -af"; "$DOCKER_BIN" system prune -af 2>&1; fi'
        : 'if [ -n "$DOCKER_BIN" ]; then echo "$ docker image prune -f"; "$DOCKER_BIN" image prune -f 2>&1; fi',
      mode === 'deep'
        ? ''
        : 'if [ -n "$DOCKER_BIN" ]; then echo "$ docker container prune -f"; "$DOCKER_BIN" container prune -f 2>&1; fi',
      'if [ -n "$DOCKER_BIN" ]; then echo "$ docker builder prune -af"; "$DOCKER_BIN" builder prune -af 2>&1; fi',
      'if command -v journalctl >/dev/null 2>&1; then echo "$ journalctl --vacuum-time=7d"; journalctl --vacuum-time=7d 2>&1; fi',
      'if command -v apt-get >/dev/null 2>&1; then echo "$ apt-get clean"; apt-get clean 2>&1; fi',
    ].filter(Boolean).join('; ')

    const result = await execCommand(ssh, cleanupScript)
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || 'Failed to clean server storage')
    }

    return {
      success: true,
      mode,
      commands: [...cleanupCommands],
      output: [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n'),
    }
  })
}

export const serverRoutes = new Elysia({ prefix: '/servers' })
  .get('/', async (context: any) => {
    const { requireAuth, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()

    return db.data.servers.map((server) => ({
      ...serializeServer(server),
      projectCount: db.data.projects.filter((project) => project.serverId === server.id).length,
      recentDeployOutcomes: db.data.deployHistory.filter((record) => record.serverId === server.id).slice(0, 5),
    }))
  })
  .post(
    '/',
    async (context: any) => {
      const { requireAuth, body, set } = context
      await requireAuth()
      requireCryptoReady(set)

      const now = new Date().toISOString()
      const server: Server = {
        id: randomUUID(),
        name: body.name.trim(),
        host: body.host.trim(),
        port: body.port,
        user: body.user.trim(),
        sshKeyPath: body.sshKeyPath.trim(),
        sshPassphrase: body.sshPassphrase?.trim()
          ? encrypt(body.sshPassphrase.trim())
          : undefined,
        diskAlertThresholdPercent: body.diskAlertThresholdPercent,
        createdAt: now,
        updatedAt: now,
      }

      const db = await getDb()
      db.data.servers.unshift(server)
      await saveDb()

      set.status = 201
      return serializeServer(server)
    },
    { body: serverBody }
  )
  .get('/:id', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    return {
      ...serializeServer(server),
      projectCount: db.data.projects.filter((project) => project.serverId === server.id).length,
      recentDeployOutcomes: db.data.deployHistory.filter((record) => record.serverId === server.id).slice(0, 5),
    }
  })
  .patch(
    '/:id',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)

      const db = await getDb()
      const server = db.data.servers.find((item) => item.id === params.id)
      if (!server) {
        set.status = 404
        return { message: 'Server not found' }
      }

      server.name = body.name.trim()
      server.host = body.host.trim()
      server.port = body.port
      server.user = body.user.trim()
      server.sshKeyPath = body.sshKeyPath.trim()
      server.diskAlertThresholdPercent = body.diskAlertThresholdPercent
      if (Object.prototype.hasOwnProperty.call(body, 'sshPassphrase')) {
        const passphrase = body.sshPassphrase?.trim() ?? ''
        server.sshPassphrase = passphrase ? encrypt(passphrase) : undefined
      }
      server.updatedAt = new Date().toISOString()

      await saveDb()
      await recordActivity({
        serverId: server.id,
        type: 'project_updated',
        status: 'info',
        title: `Updated server ${server.name}`,
        detail: 'Connection settings were updated.',
      })

      return serializeServer(server)
    },
    { body: serverBody }
  )
  .delete('/:id', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)
    const denied = await requireDangerousActionAuth(context)
    if (denied) return denied

    const db = await getDb()
    const serverIndex = db.data.servers.findIndex((item) => item.id === params.id)
    if (serverIndex === -1) {
      set.status = 404
      return { message: 'Server not found' }
    }
    const server = db.data.servers[serverIndex]

    db.data.servers.splice(serverIndex, 1)
    db.data.projects = db.data.projects.filter((project) => project.serverId !== params.id)
    await saveDb()
    await recordActivity({
      serverId: server.id,
      type: 'project_deleted',
      status: 'warning',
      title: `Deleted server ${server.name}`,
      detail: 'Associated Launchpad projects were removed from the registry.',
    })

    return { success: true }
  })
  .post('/:id/test', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    const result = await testConnection(server)
    const status: ServerConnectionStatus = {
      serverId: server.id,
      connected: result.connected,
      latencyMs: result.latencyMs,
      error: result.error,
      checkedAt: new Date().toISOString(),
    }

    server.lastConnectionStatus = status
    if (result.connected) {
      try {
        server.lastResourceStatus = await fetchServerResources(server)
        await maybeSendDiskWarning(server, server.lastResourceStatus)
      } catch {
        // Ignore telemetry failures during SSH test; connection result remains useful.
      }
    }
    server.updatedAt = new Date().toISOString()
    await saveDb()

    return status
  })
  .get('/:id/resources', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    try {
      const resources = await fetchServerResources(server)
      server.lastResourceStatus = resources
      await maybeSendDiskWarning(server, resources)
      server.updatedAt = new Date().toISOString()
      await saveDb()
      return resources
    } catch (error) {
      set.status = 500
      return { message: error instanceof Error ? error.message : 'Failed to load server resources' }
    }
  })
  .get('/:id/storage-audit', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    try {
      return await fetchServerStorageAudit(server)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to audit server storage'
      logServerRouteError('storage-audit', server.id, error, { message })
      return createFallbackStorageAudit(message)
    }
  })
  .get('/:id/storage-overview', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    try {
      return await fetchServerStorageOverview(server)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load server storage overview'
      logServerRouteError('storage-overview', server.id, error, { message })
      return createFallbackStorageAudit(message)
    }
  })
  .post('/:id/storage-cleanup', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)
    const denied = await requireDangerousActionAuth(context)
    if (denied) return denied

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    try {
      const beforeAudit = await fetchServerStorageAudit(server).catch((error) =>
        createFallbackStorageAudit(error instanceof Error ? error.message : 'Pre-cleanup audit failed')
      )
      const result = await runServerStorageCleanup(server)
      const afterAudit = await fetchServerStorageAudit(server).catch((error) =>
        createFallbackStorageAudit(error instanceof Error ? error.message : 'Post-cleanup audit failed')
      )
      const beforeTotalBytes = beforeAudit.items.reduce((sum, item) => sum + item.sizeBytes, 0)
      const afterTotalBytes = afterAudit.items.reduce((sum, item) => sum + item.sizeBytes, 0)
      const reclaimedBytes = Math.max(0, beforeTotalBytes - afterTotalBytes)
      server.updatedAt = new Date().toISOString()
      await saveDb()
      await recordActivity({
        serverId: server.id,
        type: 'server_storage_cleaned',
        status: 'warning',
        title: `Ran storage cleanup on ${server.name}`,
        detail: reclaimedBytes > 0
          ? `Pruned unused Docker data and host caches, reclaiming about ${reclaimedBytes} bytes.`
          : 'Pruned unused Docker data and common host caches.',
      })
      return {
        ...result,
        reclaimedBytes,
        beforeAudit,
        afterAudit,
      }
    } catch (error) {
      logServerRouteError('storage-cleanup', server.id, error)
      set.status = 500
      return { message: error instanceof Error ? error.message : 'Failed to clean server storage' }
    }
  })
  .post('/:id/storage-deep-cleanup', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)
    const denied = await requireDangerousActionAuth(context)
    if (denied) return denied

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    try {
      const beforeAudit = await fetchServerStorageAudit(server).catch((error) =>
        createFallbackStorageAudit(error instanceof Error ? error.message : 'Pre-cleanup audit failed')
      )
      const result = await runServerStorageCleanup(server, 'deep')
      const afterAudit = await fetchServerStorageAudit(server).catch((error) =>
        createFallbackStorageAudit(error instanceof Error ? error.message : 'Post-cleanup audit failed')
      )
      const beforeTotalBytes = beforeAudit.items.reduce((sum, item) => sum + item.sizeBytes, 0)
      const afterTotalBytes = afterAudit.items.reduce((sum, item) => sum + item.sizeBytes, 0)
      const reclaimedBytes = Math.max(0, beforeTotalBytes - afterTotalBytes)
      server.updatedAt = new Date().toISOString()
      await saveDb()
      await recordActivity({
        serverId: server.id,
        type: 'server_storage_cleaned',
        status: 'warning',
        title: `Ran inactive-only deep cleanup on ${server.name}`,
        detail: reclaimedBytes > 0
          ? `Pruned unused Docker images, stopped containers, unused networks, build cache, and host caches, reclaiming about ${reclaimedBytes} bytes.`
          : 'Pruned unused Docker images, stopped containers, unused networks, build cache, and host caches.',
      })
      return {
        ...result,
        reclaimedBytes,
        beforeAudit,
        afterAudit,
      }
    } catch (error) {
      logServerRouteError('storage-deep-cleanup', server.id, error)
      set.status = 500
      return { message: error instanceof Error ? error.message : 'Failed to run inactive-only deep cleanup' }
    }
  })
  .post('/:id/reclassify-projects', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    const projects = db.data.projects.filter((project) => project.serverId === params.id)
    let updated = 0

    for (const project of projects) {
      const inferred = inferProxyTypeFromProject(project)
      const runtime = inferProjectRuntime({ ...project, proxyType: inferred })
      const source = project.source ?? inferProjectSource({ imported: true })
      if (
        (project.proxyType !== inferred && inferred !== 'none') ||
        project.runtime !== runtime ||
        project.source !== source
      ) {
        project.proxyType = inferred
        project.runtime = runtime
        project.source = source
        project.updatedAt = new Date().toISOString()
        updated += 1
      }
    }

    if (updated > 0) {
      await saveDb()
    }

    return { success: true, updated }
  })
  .get('/:id/activity', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    return db.data.activity
      .filter((event) => event.serverId === params.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50)
  })
  .get('/:id/discover', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    let ssh: Awaited<ReturnType<typeof getConnection>> | null = null

    try {
      ssh = await getConnection(server)

      const idsResult = await execCommand(ssh, 'docker ps -q')
      if (idsResult.code !== 0) {
        set.status = 500
        return { message: idsResult.stderr || idsResult.stdout || 'Failed to query running containers' }
      }

      const ids = idsResult.stdout
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean)

      if (ids.length === 0) {
        return []
      }

      const inspectResult = await execCommand(ssh, `docker inspect --format='{{json .}}' ${ids.join(' ')}`)
      if (inspectResult.code !== 0) {
        set.status = 500
        return { message: inspectResult.stderr || inspectResult.stdout || 'Failed to inspect running containers' }
      }

      const containers = inspectResult.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as any)

      const discovered = await Promise.all(
        containers.map(async (container) => {
          const image = container.Config?.Image ?? ''
          const { repository, tag } = splitImageRef(image)
          const labels = container.Config?.Labels ?? {}
          const workingDir =
            labels['com.docker.compose.project.working_dir'] ||
            container.Config?.WorkingDir ||
            undefined
          const composeService = labels['com.docker.compose.service'] || undefined
          const composeProject = labels['com.docker.compose.project'] || undefined
          const containerName = String(container.Name || '').replace(/^\//, '')
          const ports = Array.isArray(container.NetworkSettings?.Ports)
            ? []
            : Object.keys(container.NetworkSettings?.Ports ?? {})
          const envPath = workingDir ? `${workingDir.replace(/\/$/, '')}/.env` : undefined
          const importable = Boolean(composeService && workingDir)
          const proxyType = inferProxyTypeFromProject({
            name: composeService || composeProject || containerName,
            repoImage: repository,
            workingDir,
            deployCommands: workingDir
              ? ['docker compose pull', 'docker compose up -d']
              : ['docker pull ' + image],
          })
          const existingProject = db.data.projects.find(
            (project) =>
              project.serverId === server.id &&
              ((workingDir && project.workingDir === workingDir) ||
                project.name === composeService ||
                project.repoImage === repository)
          )

          let envExists = false
          if (envPath) {
            const envCheck = await execCommand(ssh!, `[ -f '${envPath.replace(/'/g, `'\"'\"'`)}' ] && echo yes || echo no`)
            envExists = envCheck.stdout.trim() === 'yes'
          }

          return {
            containerId: container.Id,
            containerName,
            image,
            imageRepository: repository,
            imageTag: tag,
            status: container.State?.Status ?? 'unknown',
            ports,
            workingDir,
            envPath: envExists ? envPath : undefined,
            composeProject,
            composeService,
            alreadyImported: Boolean(existingProject),
            importable,
            importReason: importable
              ? undefined
              : 'Automatic import currently works best for Docker Compose-managed apps with a detected working directory.',
            suggestedProject: {
              name: composeService || composeProject || containerName,
              source: inferProjectSource({ imported: true }),
              runtime: inferProjectRuntime({
                name: composeService || composeProject || containerName,
                repoImage: repository,
                workingDir,
                deployCommands: workingDir
                  ? ['docker compose pull', 'docker compose up -d']
                  : ['docker pull ' + image],
                proxyType,
              }),
              repoImage: repository,
              deployCommands: workingDir
                ? ['docker compose pull', 'docker compose up -d']
                : ['docker pull ' + image],
              envPath: envExists ? envPath : undefined,
              workingDir,
              proxyType,
              webhookEnabled: false,
              notifications: {
                onSuccess: true,
                onFailure: true,
                webhooks: [],
              },
            },
          }
        })
      )

      return discovered
    } catch (error) {
      set.status = 500
      return { message: error instanceof Error ? error.message : 'Failed to discover projects' }
    } finally {
      ssh?.dispose()
    }
  })
