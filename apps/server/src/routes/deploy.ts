import { Elysia, t } from 'elysia'
import type { DeployRecord, DeployTriggerInput } from '@launchpad/shared'
import { hasKey } from '../lib/crypto'
import { requireDangerousActionAuth } from '../lib/dangerousAction'
import { getDb } from '../lib/db'
import { isProjectDeploying, runDeploy, subscribeToDeploy } from '../lib/deployments'

const encoder = new TextEncoder()

const triggerBody = t.Object({
  projectId: t.String(),
  imageTag: t.Optional(t.String()),
  trigger: t.Union([t.Literal('ui'), t.Literal('github_actions'), t.Literal('webhook')]),
})

function requireCryptoReady(set: { status?: number | string }) {
  if (!hasKey()) {
    set.status = 401
    throw new Error('Encryption key not loaded. Please log in again.')
  }
}

export const deployRoutes = new Elysia({ prefix: '/deploy' })
  .post(
    '/:projectId',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)
      const denied = await requireDangerousActionAuth(context)
      if (denied) return denied

      if (params.projectId !== body.projectId) {
        set.status = 400
        return { message: 'Project ID mismatch' }
      }

      const db = await getDb()
      const project = db.data.projects.find((item) => item.id === params.projectId)
      if (!project) {
        set.status = 404
        return { message: 'Project not found' }
      }

      const server = db.data.servers.find((item) => item.id === project.serverId)
      if (!server) {
        set.status = 404
        return { message: 'Server not found' }
      }

      if (isProjectDeploying(project.id)) {
        set.status = 409
        return { message: 'A deploy is already running for this project' }
      }

      const input: DeployTriggerInput = {
        projectId: project.id,
        imageTag: body.imageTag?.trim() || undefined,
        trigger: body.trigger,
      }

      void runDeploy({
        project,
        server,
        imageTag: input.imageTag,
        trigger: input.trigger,
      })

      set.status = 202
      return {
        success: true,
        status: 'deploying',
      }
    },
    { body: triggerBody }
  )
  .get('/:projectId/stream', async (context: any) => {
    const { requireAuth, params, request, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const projectId = params.projectId

    const stream = new ReadableStream({
      start(controller) {
        const send = (chunk: string) => controller.enqueue(encoder.encode(chunk))
        send(': connected\n\n')

        const unsubscribe = subscribeToDeploy(projectId, (event) => {
          send(`data: ${JSON.stringify(event)}\n\n`)
        })

        const heartbeat = setInterval(() => {
          send(': heartbeat\n\n')
        }, 15_000)

        const cleanup = () => {
          clearInterval(heartbeat)
          unsubscribe()
          controller.close()
        }

        request.signal.addEventListener('abort', cleanup, { once: true })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  })
  .get('/:projectId/history', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const project = db.data.projects.find((item) => item.id === params.projectId)
    if (!project) {
      set.status = 404
      return { message: 'Project not found' }
    }

    return db.data.deployHistory
      .filter((record) => record.projectId === params.projectId)
      .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())
      .slice(0, 50)
  })
  .get('/:projectId/history/:deployId', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const record = db.data.deployHistory.find(
      (item) => item.projectId === params.projectId && item.id === params.deployId
    )

    if (!record) {
      set.status = 404
      return { message: 'Deploy record not found' }
    }

    return record as DeployRecord
  })
