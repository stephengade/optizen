import { Elysia, t } from 'elysia'
import { recordActivity } from '../lib/activity'
import { hasKey } from '../lib/crypto'
import { requireDangerousActionAuth } from '../lib/dangerousAction'
import { getDb } from '../lib/db'
import { listFileRevisions, saveFileRevision } from '../lib/fileHistory'
import {
  backupConfig,
  defaultConfigPath,
  proxyStatus,
  readConfig,
  reloadProxy,
  resolveProxy,
  validateCandidate,
  validateLive,
  writeConfig,
  type ProxyKind,
  type ProxyTarget,
} from '../lib/proxyTarget'
import { execCommand, getConnection } from '../lib/ssh'

type Ssh = Awaited<ReturnType<typeof getConnection>>

function requireCryptoReady(set: { status?: number | string }) {
  if (!hasKey()) {
    set.status = 401
    throw new Error('Encryption key not loaded. Please log in again.')
  }
}

async function loadServer(serverId: string) {
  const db = await getDb()
  return db.data.servers.find((item) => item.id === serverId) ?? null
}

async function withSsh<T>(serverId: string, handler: (ssh: Ssh) => Promise<T>) {
  const server = await loadServer(serverId)
  if (!server) {
    throw new Error('Server not found')
  }

  let ssh: Ssh | null = null
  try {
    ssh = await getConnection(server)
    return await handler(ssh)
  } finally {
    ssh?.dispose()
  }
}

function inferProxyTypeFromPath(path: string): ProxyKind {
  const normalized = path.toLowerCase()
  if (normalized.includes('caddy')) return 'caddy'
  if (normalized.includes('nginx')) return 'nginx'
  return 'none'
}

function pickContainer(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function describeTarget(target: ProxyTarget) {
  return {
    type: target.type,
    mode: target.mode,
    container: target.container,
    containers: target.containers,
  }
}

function failure(set: { status?: number | string }, error: unknown, fallback: string) {
  set.status = error instanceof Error && error.message === 'Server not found' ? 404 : 500
  return { message: error instanceof Error ? error.message : fallback }
}

/** Validate, write, check the live config, reload. The old file goes back if a check or the reload fails. */
async function applyConfig(ssh: Ssh, target: ProxyTarget, path: string, content: string, previous: string | null) {
  const candidate = await validateCandidate(ssh, target, path, content)
  if (!candidate.ok) {
    return { ok: false as const, status: 400, message: candidate.output || 'Proxy config validation failed' }
  }

  await writeConfig(ssh, target, path, content)

  if (target.mode === 'none') {
    return { ok: true as const, reloaded: false, validated: false }
  }

  const live = await validateLive(ssh, target)
  if (!live.ok) {
    if (previous !== null) await writeConfig(ssh, target, path, previous).catch(() => undefined)
    return {
      ok: false as const,
      status: 400,
      message: `${live.output || 'Proxy config validation failed'}\n\nThe previous config was put back; nothing was reloaded.`,
    }
  }

  const reload = await reloadProxy(ssh, target)
  if (!reload.ok) {
    if (previous !== null) {
      await writeConfig(ssh, target, path, previous).catch(() => undefined)
      await reloadProxy(ssh, target).catch(() => undefined)
    }
    return {
      ok: false as const,
      status: 500,
      message: `${reload.output || 'Proxy reload failed'}\n\nThe previous config was put back.`,
    }
  }

  return { ok: true as const, reloaded: true, validated: true }
}

export const proxyRoutes = new Elysia({ prefix: '/proxy' })
  .get('/:serverId/detect', async (context: any) => {
    const { requireAuth, params, query, set } = context
    await requireAuth()
    requireCryptoReady(set)

    try {
      return await withSsh(params.serverId, async (ssh) => describeTarget(await resolveProxy(ssh, pickContainer(query.container))))
    } catch (error) {
      return failure(set, error, 'Failed to detect proxy')
    }
  })
  .get('/:serverId/status', async (context: any) => {
    const { requireAuth, params, query, set } = context
    await requireAuth()
    requireCryptoReady(set)

    try {
      return await withSsh(params.serverId, async (ssh) => {
        const target = await resolveProxy(ssh, pickContainer(query.container))
        if (target.type === 'none') {
          return { ...describeTarget(target), running: false, version: '', configPath: '' }
        }
        const status = await proxyStatus(ssh, target)
        const configPath = await defaultConfigPath(ssh, target)
        return { ...describeTarget(target), ...status, configPath }
      })
    } catch (error) {
      return failure(set, error, 'Failed to load proxy status')
    }
  })
  .get('/:serverId/config', async (context: any) => {
    const { requireAuth, params, query, set } = context
    await requireAuth()
    requireCryptoReady(set)

    try {
      return await withSsh(params.serverId, async (ssh) => {
        const target = await resolveProxy(ssh, pickContainer(query.container))
        const requestedPath = typeof query.path === 'string' && query.path.trim() ? query.path.trim() : ''

        if (target.type === 'none' && !requestedPath) {
          return {
            ...describeTarget(target),
            path: '',
            content: '',
            editable: false,
            error:
              'No Caddy or Nginx found on this server, neither installed on the host nor running in Docker. If your proxy config lives elsewhere, enter its path and click Load path.',
          }
        }

        const path = requestedPath || (await defaultConfigPath(ssh, target))
        const responseType = target.type === 'none' ? inferProxyTypeFromPath(path) : target.type

        if (!path) {
          return {
            ...describeTarget(target),
            type: responseType,
            path: '',
            content: '',
            editable: false,
            error: `The ${target.container} container's config is not mounted from the host, so there is no file to edit. Enter a path and click Load path.`,
          }
        }

        try {
          const content = await readConfig(ssh, target, path)
          const revisions = await listFileRevisions({ kind: 'proxy', serverId: params.serverId, path })
          return { ...describeTarget(target), type: responseType, path, content, editable: true, error: '', revisions }
        } catch (error) {
          return {
            ...describeTarget(target),
            type: responseType,
            path,
            content: '',
            editable: true,
            error: error instanceof Error ? error.message : 'Failed to read proxy config',
            revisions: [],
          }
        }
      })
    } catch (error) {
      return failure(set, error, 'Failed to load proxy config')
    }
  })
  .put(
    '/:serverId/config',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)
      const denied = await requireDangerousActionAuth(context)
      if (denied) return denied

      try {
        return await withSsh(params.serverId, async (ssh) => {
          const target = await resolveProxy(ssh, pickContainer(body.container))
          const path = body.path?.trim() || (await defaultConfigPath(ssh, target))

          if (!path) {
            set.status = 400
            return { message: 'Provide a config path to edit.' }
          }

          const previous = await readConfig(ssh, target, path).catch(() => null)
          if (previous) {
            await saveFileRevision({
              kind: 'proxy',
              serverId: params.serverId,
              path,
              content: previous,
              summary: 'Snapshot before proxy overwrite',
            })
          }
          const backupPath = previous ? await backupConfig(ssh, path) : undefined

          const applied = await applyConfig(ssh, target, path, body.content, previous)
          if (!applied.ok) {
            set.status = applied.status
            return { message: applied.message }
          }

          const where = target.mode === 'docker' ? ` (container ${target.container})` : ''
          await recordActivity({
            serverId: params.serverId,
            type: 'proxy_config_updated',
            status: 'success',
            title: applied.reloaded ? `Saved and reloaded ${target.type}${where}` : 'Saved custom proxy config',
            detail: backupPath ? `${path} backed up to ${backupPath}` : path,
          })

          return {
            success: true,
            path,
            backupPath,
            reloaded: applied.reloaded,
            validated: applied.validated,
            message: applied.reloaded
              ? `Config validated, saved, and ${target.type} reloaded${where}.`
              : 'Config file saved. No proxy was found to validate or reload it.',
          }
        })
      } catch (error) {
        return failure(set, error, 'Failed to save proxy config')
      }
    },
    { body: t.Object({ content: t.String(), path: t.Optional(t.String()), container: t.Optional(t.String()) }) }
  )
  .get('/:serverId/history', async (context: any) => {
    const { requireAuth, params, query, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const path = typeof query.path === 'string' ? query.path.trim() : ''
    if (!path) {
      set.status = 400
      return { message: 'A config path is required to load proxy history' }
    }

    return listFileRevisions({
      kind: 'proxy',
      serverId: params.serverId,
      path,
    })
  })
  .post(
    '/:serverId/restore',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)
      const denied = await requireDangerousActionAuth(context)
      if (denied) return denied

      const db = await getDb()
      const revision = db.data.fileHistory.find(
        (item) => item.id === body.revisionId && item.kind === 'proxy' && item.serverId === params.serverId
      )
      if (!revision) {
        set.status = 404
        return { message: 'Proxy revision not found' }
      }

      try {
        return await withSsh(params.serverId, async (ssh) => {
          const target = await resolveProxy(ssh, pickContainer(body.container))
          const previous = await readConfig(ssh, target, revision.path).catch(() => null)
          const backupPath = previous ? await backupConfig(ssh, revision.path) : undefined
          const applied = await applyConfig(ssh, target, revision.path, revision.content, previous)
          if (!applied.ok) {
            set.status = applied.status
            return { message: applied.message }
          }
          await recordActivity({
            serverId: params.serverId,
            type: 'proxy_config_updated',
            status: 'warning',
            title: 'Restored proxy config revision',
            detail: `Restored ${revision.path}.${backupPath ? ` Backup: ${backupPath}` : ''}`,
          })
          return { success: true, path: revision.path, backupPath, reloaded: applied.reloaded }
        })
      } catch (error) {
        return failure(set, error, 'Failed to restore proxy config')
      }
    },
    { body: t.Object({ revisionId: t.String(), container: t.Optional(t.String()) }) }
  )
  .post(
    '/:serverId/reload',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)
      const denied = await requireDangerousActionAuth(context)
      if (denied) return denied

      try {
        return await withSsh(params.serverId, async (ssh) => {
          const target = await resolveProxy(ssh, pickContainer(body?.container))
          if (target.type === 'none') {
            set.status = 400
            return { message: 'No Caddy or Nginx found on this server' }
          }

          const live = await validateLive(ssh, target)
          if (!live.ok) {
            set.status = 400
            return { message: `${live.output || 'The current config is invalid'}\n\nNot reloaded.` }
          }

          const result = await reloadProxy(ssh, target)
          if (!result.ok) {
            set.status = 500
            return { message: result.output || 'Failed to reload proxy' }
          }

          const where = target.mode === 'docker' ? ` (container ${target.container})` : ''
          await recordActivity({
            serverId: params.serverId,
            type: 'proxy_reloaded',
            status: 'success',
            title: `Reloaded ${target.type}${where}`,
            detail: 'Manual reload from Optizen.',
          })

          return { success: true, type: target.type, container: target.container }
        })
      } catch (error) {
        return failure(set, error, 'Failed to reload proxy')
      }
    },
    { body: t.Optional(t.Object({ container: t.Optional(t.String()) })) }
  )
  .get('/:serverId/sites', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    try {
      return await withSsh(params.serverId, async (ssh) => {
        const target = await resolveProxy(ssh)
        if (target.type !== 'nginx' || target.mode !== 'host') {
          return { type: target.type, sites: [] as Array<{ name: string; enabled: boolean }> }
        }

        const list = await execCommand(
          ssh,
          "for f in /etc/nginx/sites-available/*; do [ -f \"$f\" ] || continue; name=$(basename \"$f\"); if [ -L \"/etc/nginx/sites-enabled/$name\" ]; then echo \"$name\tenabled\"; else echo \"$name\tdisabled\"; fi; done"
        )

        const sites = list.stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [name, state] = line.split('\t')
            return { name, enabled: state === 'enabled' }
          })

        return { type: target.type, sites }
      })
    } catch (error) {
      return failure(set, error, 'Failed to load nginx sites')
    }
  })
  .post(
    '/:serverId/sites/:site/toggle',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)
      const denied = await requireDangerousActionAuth(context)
      if (denied) return denied

      try {
        return await withSsh(params.serverId, async (ssh) => {
          const target = await resolveProxy(ssh)
          if (target.type !== 'nginx' || target.mode !== 'host') {
            set.status = 400
            return { message: 'Site toggling is only supported for Nginx installed on the host' }
          }

          const site = params.site.replace(/[^A-Za-z0-9._-]/g, '')
          const command = body.enabled
            ? `ln -sf /etc/nginx/sites-available/${site} /etc/nginx/sites-enabled/${site}`
            : `rm -f /etc/nginx/sites-enabled/${site}`

          const toggle = await execCommand(ssh, command)
          if (toggle.code !== 0) {
            set.status = 500
            return { message: toggle.stderr || toggle.stdout || 'Failed to toggle site' }
          }

          const validate = await execCommand(ssh, 'nginx -t')
          if (validate.code !== 0) {
            set.status = 400
            return { message: validate.stderr || validate.stdout || 'Nginx validation failed' }
          }

          const reload = await reloadProxy(ssh, target)
          if (!reload.ok) {
            set.status = 500
            return { message: reload.output || 'Failed to reload nginx' }
          }

          await recordActivity({
            serverId: params.serverId,
            type: 'nginx_site_toggled',
            status: 'success',
            title: `${body.enabled ? 'Enabled' : 'Disabled'} nginx site ${site}`,
            detail: '/etc/nginx/sites-enabled',
          })

          return { success: true, enabled: body.enabled }
        })
      } catch (error) {
        return failure(set, error, 'Failed to toggle nginx site')
      }
    },
    { body: t.Object({ enabled: t.Boolean() }) }
  )
