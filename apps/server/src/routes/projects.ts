import { randomBytes, randomUUID } from 'crypto'
import { Elysia, t } from 'elysia'
import type { Project } from '@launchpad/shared'
import { recordActivity } from '../lib/activity'
import { decrypt, encrypt, hasKey } from '../lib/crypto'
import { getDb, saveDb } from '../lib/db'
import { runProjectHealthCheck } from '../lib/projectHealth'
import {
  inferAndApplyProjectProxyType,
  inferProjectRuntime,
  inferProjectSource,
} from '../lib/projectInference'

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
  source: t.Optional(t.Union([t.Literal('manual'), t.Literal('imported')])),
  runtime: t.Optional(t.Union([t.Literal('compose'), t.Literal('image'), t.Literal('proxy'), t.Literal('custom')])),
  healthCheck: t.Optional(
    t.Object({
      path: t.Optional(t.String()),
      port: t.Optional(t.Number({ minimum: 1, maximum: 65535 })),
    })
  ),
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
    source: project.source ?? inferProjectSource({ imported: false }),
    runtime: project.runtime ?? inferProjectRuntime(project),
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

    let changed = false
    const projects = db.data.projects
      .filter((project) => project.serverId === params.id)
      .map((project) => {
        if (project.proxyType === 'none') {
          const inferred = inferAndApplyProjectProxyType(project)
          if (inferred !== 'none') {
            project.proxyType = inferred
            project.runtime = inferProjectRuntime(project)
            project.updatedAt = new Date().toISOString()
            changed = true
          }
        }

        return project
      })

    if (changed) {
      await saveDb()
    }

    return projects.map(serializeProject)
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
      const source = body.source ?? inferProjectSource({ imported: false })
      const runtime = body.runtime ?? inferProjectRuntime({
        name: body.name,
        repoImage: body.repoImage,
        workingDir: body.workingDir,
        deployCommands: body.deployCommands,
        proxyType: body.proxyType,
      })
      const project: Project = {
        id: randomUUID(),
        serverId: params.id,
        name: body.name.trim(),
        source,
        runtime,
        repoImage: body.repoImage.trim(),
        deployCommands: body.deployCommands
          .map((command: string) => command.trim())
          .filter(Boolean),
        envPath: body.envPath?.trim() || undefined,
        workingDir: body.workingDir?.trim() || undefined,
        proxyType: body.proxyType,
        healthCheck:
          body.healthCheck?.path?.trim() || body.healthCheck?.port
            ? {
                path: body.healthCheck?.path?.trim() || undefined,
                port: body.healthCheck?.port || undefined,
              }
            : undefined,
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
      await recordActivity({
        serverId: params.id,
        projectId: project.id,
        type: source === 'imported' ? 'project_imported' : 'project_created',
        status: 'success',
        title: source === 'imported' ? `Imported project ${project.name}` : `Created project ${project.name}`,
        detail: `${project.runtime} app on ${project.proxyType === 'none' ? 'no proxy' : project.proxyType}.`,
      })

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
      project.source = body.source ?? project.source ?? inferProjectSource({ imported: false })
      project.repoImage = body.repoImage.trim()
      project.deployCommands = body.deployCommands
        .map((command: string) => command.trim())
        .filter(Boolean)
      project.envPath = body.envPath?.trim() || undefined
      project.workingDir = body.workingDir?.trim() || undefined
      project.proxyType = body.proxyType
      project.runtime = body.runtime ?? inferProjectRuntime(project)
      project.healthCheck =
        body.healthCheck?.path?.trim() || body.healthCheck?.port
          ? {
              path: body.healthCheck?.path?.trim() || undefined,
              port: body.healthCheck?.port || undefined,
            }
          : undefined
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
      await recordActivity({
        serverId: project.serverId,
        projectId: project.id,
        type: 'project_updated',
        status: 'info',
        title: `Updated project ${project.name}`,
        detail: `Classification: ${project.source}/${project.runtime}.`,
      })

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
    const project = db.data.projects[projectIndex]

    db.data.projects.splice(projectIndex, 1)
    await saveDb()
    await recordActivity({
      serverId: project.serverId,
      projectId: project.id,
      type: 'project_deleted',
      status: 'warning',
      title: `Deleted project ${project.name}`,
      detail: 'Launchpad removed the saved project configuration.',
    })

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
  .post('/projects/:id/health', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const project = db.data.projects.find((item) => item.id === params.id)
    if (!project) {
      set.status = 404
      return { message: 'Project not found' }
    }

    const server = db.data.servers.find((item) => item.id === project.serverId)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    const status = await runProjectHealthCheck(project, server)
    project.healthStatus = status
    project.updatedAt = new Date().toISOString()
    await saveDb()
    await recordActivity({
      serverId: project.serverId,
      projectId: project.id,
      type: status.status === 'healthy' ? 'health_check_passed' : 'health_check_failed',
      status: status.status === 'healthy' ? 'success' : 'warning',
      title:
        status.status === 'healthy'
          ? `Health check passed for ${project.name}`
          : `Health check needs attention for ${project.name}`,
      detail: status.message,
    })

    return status
  })
  .get('/projects/:id/activity', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const project = db.data.projects.find((item) => item.id === params.id)
    if (!project) {
      set.status = 404
      return { message: 'Project not found' }
    }

    return db.data.activity
      .filter((event) => event.projectId === params.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50)
  })
