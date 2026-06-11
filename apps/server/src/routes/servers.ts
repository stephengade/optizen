import { randomUUID } from 'crypto'
import { Elysia, t } from 'elysia'
import type { Server, ServerConnectionStatus } from '@launchpad/shared'
import { encrypt, hasKey } from '../lib/crypto'
import { getDb, saveDb } from '../lib/db'
import { testConnection } from '../lib/ssh'

const serverBody = t.Object({
  name: t.String({ minLength: 1 }),
  host: t.String({ minLength: 1 }),
  port: t.Number({ minimum: 1, maximum: 65535 }),
  user: t.String({ minLength: 1 }),
  sshKeyPath: t.String({ minLength: 1 }),
  sshPassphrase: t.Optional(t.String()),
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

export const serverRoutes = new Elysia({ prefix: '/servers' })
  .get('/', async (context: any) => {
    const { requireAuth, set } = context
    requireAuth()
    requireCryptoReady(set)

    const db = await getDb()

    return db.data.servers.map((server) => ({
      ...serializeServer(server),
      projectCount: db.data.projects.filter((project) => project.serverId === server.id).length,
    }))
  })
  .post(
    '/',
    async (context: any) => {
      const { requireAuth, body, set } = context
      requireAuth()
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
    requireAuth()
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
    }
  })
  .patch(
    '/:id',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      requireAuth()
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
      if (Object.prototype.hasOwnProperty.call(body, 'sshPassphrase')) {
        const passphrase = body.sshPassphrase?.trim() ?? ''
        server.sshPassphrase = passphrase ? encrypt(passphrase) : undefined
      }
      server.updatedAt = new Date().toISOString()

      await saveDb()

      return serializeServer(server)
    },
    { body: serverBody }
  )
  .delete('/:id', async (context: any) => {
    const { requireAuth, params, set } = context
    requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const serverIndex = db.data.servers.findIndex((item) => item.id === params.id)
    if (serverIndex === -1) {
      set.status = 404
      return { message: 'Server not found' }
    }

    db.data.servers.splice(serverIndex, 1)
    db.data.projects = db.data.projects.filter((project) => project.serverId !== params.id)
    await saveDb()

    return { success: true }
  })
  .post('/:id/test', async (context: any) => {
    const { requireAuth, params, set } = context
    requireAuth()
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

    return status
  })
