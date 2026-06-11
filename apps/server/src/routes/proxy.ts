import { Elysia, t } from 'elysia'
import { hasKey } from '../lib/crypto'
import { getDb } from '../lib/db'
import { execCommand, getConnection, readRemoteFile, writeRemoteFile } from '../lib/ssh'

type ProxyKind = 'caddy' | 'nginx' | 'none'

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

async function withSsh<T>(serverId: string, handler: (ssh: Awaited<ReturnType<typeof getConnection>>) => Promise<T>) {
  const server = await loadServer(serverId)
  if (!server) {
    throw new Error('Server not found')
  }

  let ssh: Awaited<ReturnType<typeof getConnection>> | null = null
  try {
    ssh = await getConnection(server)
    return await handler(ssh)
  } finally {
    ssh?.dispose()
  }
}

function getConfigPath(type: ProxyKind) {
  if (type === 'caddy') return '/etc/caddy/Caddyfile'
  if (type === 'nginx') return '/etc/nginx/nginx.conf'
  return ''
}

async function detectProxy(ssh: Awaited<ReturnType<typeof getConnection>>): Promise<ProxyKind> {
  const caddy = await execCommand(ssh, 'command -v caddy >/dev/null 2>&1 && echo caddy')
  if (caddy.stdout.trim() === 'caddy') return 'caddy'

  const nginx = await execCommand(ssh, 'command -v nginx >/dev/null 2>&1 && echo nginx')
  if (nginx.stdout.trim() === 'nginx') return 'nginx'

  return 'none'
}

export const proxyRoutes = new Elysia({ prefix: '/proxy' })
  .get('/:serverId/detect', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    try {
      return await withSsh(params.serverId, async (ssh) => ({
        type: await detectProxy(ssh),
      }))
    } catch (error) {
      set.status = error instanceof Error && error.message === 'Server not found' ? 404 : 500
      return { message: error instanceof Error ? error.message : 'Failed to detect proxy' }
    }
  })
  .get('/:serverId/status', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    try {
      return await withSsh(params.serverId, async (ssh) => {
        const type = await detectProxy(ssh)
        if (type === 'none') {
          return { type, running: false, version: '', configPath: '' }
        }

        const statusResult = await execCommand(ssh, `systemctl is-active ${type}`)
        const versionResult =
          type === 'caddy'
            ? await execCommand(ssh, 'caddy version')
            : await execCommand(ssh, 'nginx -v 2>&1')

        return {
          type,
          running: statusResult.stdout.trim() === 'active',
          version: (versionResult.stdout || versionResult.stderr).trim(),
          configPath: getConfigPath(type),
        }
      })
    } catch (error) {
      set.status = error instanceof Error && error.message === 'Server not found' ? 404 : 500
      return { message: error instanceof Error ? error.message : 'Failed to load proxy status' }
    }
  })
  .get('/:serverId/config', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    try {
      return await withSsh(params.serverId, async (ssh) => {
        const type = await detectProxy(ssh)
        if (type === 'none') {
          return { type, path: '', content: '' }
        }

        const path = getConfigPath(type)
        const content = await readRemoteFile(ssh, path)
        return { type, path, content }
      })
    } catch (error) {
      set.status = error instanceof Error && error.message === 'Server not found' ? 404 : 500
      return { message: error instanceof Error ? error.message : 'Failed to load proxy config' }
    }
  })
  .put(
    '/:serverId/config',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)

      try {
        return await withSsh(params.serverId, async (ssh) => {
          const type = await detectProxy(ssh)
          if (type === 'none') {
            set.status = 400
            return { message: 'No proxy detected on this server' }
          }

          const path = getConfigPath(type)
          await writeRemoteFile(ssh, path, body.content)

          const validation =
            type === 'caddy'
              ? await execCommand(ssh, `caddy validate --config ${path}`)
              : await execCommand(ssh, 'nginx -t')

          if (validation.code !== 0) {
            set.status = 400
            return {
              message: validation.stderr || validation.stdout || 'Proxy config validation failed',
            }
          }

          const reload =
            type === 'caddy'
              ? await execCommand(ssh, `caddy reload --config ${path}`)
              : await execCommand(ssh, 'systemctl reload nginx')

          if (reload.code !== 0) {
            set.status = 500
            return { message: reload.stderr || reload.stdout || 'Proxy reload failed' }
          }

          return { success: true, path }
        })
      } catch (error) {
        set.status = error instanceof Error && error.message === 'Server not found' ? 404 : 500
        return { message: error instanceof Error ? error.message : 'Failed to save proxy config' }
      }
    },
    { body: t.Object({ content: t.String() }) }
  )
  .post('/:serverId/reload', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    try {
      return await withSsh(params.serverId, async (ssh) => {
        const type = await detectProxy(ssh)
        if (type === 'none') {
          set.status = 400
          return { message: 'No proxy detected on this server' }
        }

        const result =
          type === 'caddy'
            ? await execCommand(ssh, 'systemctl reload caddy')
            : await execCommand(ssh, 'systemctl reload nginx')

        if (result.code !== 0) {
          set.status = 500
          return { message: result.stderr || result.stdout || 'Failed to reload proxy' }
        }

        return { success: true, type }
      })
    } catch (error) {
      set.status = error instanceof Error && error.message === 'Server not found' ? 404 : 500
      return { message: error instanceof Error ? error.message : 'Failed to reload proxy' }
    }
  })
  .get('/:serverId/sites', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    try {
      return await withSsh(params.serverId, async (ssh) => {
        const type = await detectProxy(ssh)
        if (type !== 'nginx') {
          return { type, sites: [] as Array<{ name: string; enabled: boolean }> }
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

        return { type, sites }
      })
    } catch (error) {
      set.status = error instanceof Error && error.message === 'Server not found' ? 404 : 500
      return { message: error instanceof Error ? error.message : 'Failed to load nginx sites' }
    }
  })
  .post(
    '/:serverId/sites/:site/toggle',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)

      try {
        return await withSsh(params.serverId, async (ssh) => {
          const type = await detectProxy(ssh)
          if (type !== 'nginx') {
            set.status = 400
            return { message: 'Site toggling is only supported for Nginx' }
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

          const reload = await execCommand(ssh, 'systemctl reload nginx')
          if (reload.code !== 0) {
            set.status = 500
            return { message: reload.stderr || reload.stdout || 'Failed to reload nginx' }
          }

          return { success: true, enabled: body.enabled }
        })
      } catch (error) {
        set.status = error instanceof Error && error.message === 'Server not found' ? 404 : 500
        return { message: error instanceof Error ? error.message : 'Failed to toggle nginx site' }
      }
    },
    { body: t.Object({ enabled: t.Boolean() }) }
  )
