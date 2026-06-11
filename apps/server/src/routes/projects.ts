import { randomBytes, randomUUID } from 'crypto'
import { Elysia, t } from 'elysia'
import type { Project } from '@launchpad/shared'
import { decrypt, encrypt, hasKey } from '../lib/crypto'
import { getDb, saveDb } from '../lib/db'

const webhookBody = t.Object({
  onSuccess: t.Boolean(),
  onFailure: t.Boolean(),
  webhooks: t.Array(
    t.Object({
      id: t.String(),
      url: t.String(),
      secret: t.Optional(t.String()),
      enabled: t.Boolean(),
    })
  ),
})

const projectBody = t.Object({
  name: t.String({ minLength: 1 }),
  repoImage: t.String({ minLength: 1 }),
  deployCommands: t.Array(t.String()),
  envPath: t.Optional(t.String()),
  workingDir: t.Optional(t.String()),
  proxyType: t.Union([t.Literal('caddy'), t.Literal('nginx'), t.Literal('none')]),
  webhookEnabled: t.Boolean(),
  notifications: webhookBody,
})

function requireCryptoReady(set: { status?: number | string }) {
  if (!hasKey()) {
    set.status = 401
    throw new Error('Encryption key not loaded. Please log in again.')
  }
}

function generateWebhookSecret() {
  return randomBytes(32).toString('hex')
}

function serializeProject(project: Project) {
  return {
    ...project,
    webhookSecret: project.webhookSecret ? decrypt(project.webhookSecret) : undefined,
    notifications: {
      ...project.notifications,
      webhooks: project.notifications.webhooks.map((webhook) => ({
        ...webhook,
        secret: webhook.secret ? decrypt(webhook.secret) : '',
      })),
    },
  }
}

export const projectRoutes = new Elysia()
  .get('/servers/:id/projects', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    return db.data.projects
      .filter((project) => project.serverId === params.id)
      .map(serializeProject)
  })
  .post(
    '/servers/:id/projects',
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

      const now = new Date().toISOString()
      const project: Project = {
        id: randomUUID(),
        serverId: params.id,
        name: body.name.trim(),
        repoImage: body.repoImage.trim(),
        deployCommands: body.deployCommands
          .map((command: string) => command.trim())
          .filter(Boolean),
        envPath: body.envPath?.trim() || undefined,
        workingDir: body.workingDir?.trim() || undefined,
        proxyType: body.proxyType,
        webhookEnabled: body.webhookEnabled,
        webhookSecret: encrypt(generateWebhookSecret()),
        notifications: {
          onSuccess: body.notifications.onSuccess,
          onFailure: body.notifications.onFailure,
          webhooks: body.notifications.webhooks.map((webhook: { id: string; url: string; secret?: string; enabled: boolean }) => ({
            ...webhook,
            url: webhook.url.trim(),
            secret: webhook.secret?.trim() ? encrypt(webhook.secret.trim()) : undefined,
          })),
        },
        createdAt: now,
        updatedAt: now,
      }

      db.data.projects.unshift(project)
      await saveDb()

      set.status = 201
      return serializeProject(project)
    },
    { body: projectBody }
  )
  .get('/projects/:id', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const project = db.data.projects.find((item) => item.id === params.id)
    if (!project) {
      set.status = 404
      return { message: 'Project not found' }
    }

    return serializeProject(project)
  })
  .patch(
    '/projects/:id',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)

      const db = await getDb()
      const project = db.data.projects.find((item) => item.id === params.id)
      if (!project) {
        set.status = 404
        return { message: 'Project not found' }
      }

      project.name = body.name.trim()
      project.repoImage = body.repoImage.trim()
      project.deployCommands = body.deployCommands
        .map((command: string) => command.trim())
        .filter(Boolean)
      project.envPath = body.envPath?.trim() || undefined
      project.workingDir = body.workingDir?.trim() || undefined
      project.proxyType = body.proxyType
      project.webhookEnabled = body.webhookEnabled
      project.notifications = {
        onSuccess: body.notifications.onSuccess,
        onFailure: body.notifications.onFailure,
        webhooks: body.notifications.webhooks.map((webhook: { id: string; url: string; secret?: string; enabled: boolean }) => ({
          ...webhook,
          url: webhook.url.trim(),
          secret: webhook.secret?.trim() ? encrypt(webhook.secret.trim()) : undefined,
        })),
      }
      project.updatedAt = new Date().toISOString()

      await saveDb()

      return serializeProject(project)
    },
    { body: projectBody }
  )
  .delete('/projects/:id', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const projectIndex = db.data.projects.findIndex((item) => item.id === params.id)
    if (projectIndex === -1) {
      set.status = 404
      return { message: 'Project not found' }
    }

    db.data.projects.splice(projectIndex, 1)
    await saveDb()

    return { success: true }
  })
  .post('/projects/:id/webhook-secret', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const project = db.data.projects.find((item) => item.id === params.id)
    if (!project) {
      set.status = 404
      return { message: 'Project not found' }
    }

    const secret = generateWebhookSecret()
    project.webhookSecret = encrypt(secret)
    project.updatedAt = new Date().toISOString()
    await saveDb()

    return { webhookSecret: secret }
  })
