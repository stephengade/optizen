import { createHash, timingSafeEqual } from 'crypto'
import { Elysia, t } from 'elysia'
import { decrypt, hasKey } from '../lib/crypto'
import { getDb } from '../lib/db'
import { isProjectDeploying, runDeploy } from '../lib/deployments'

const webhookBody = t.Object({
  imageTag: t.Optional(t.String()),
  ref: t.Optional(t.String()),
  workflow: t.Optional(t.String()),
})

/** Constant-time compare (hash first so lengths always match). */
function secretsMatch(provided: string, expected: string) {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export const webhookRoutes = new Elysia({ prefix: '/webhooks' })
  .post(
    '/deploy/:projectId/:secret',
    async ({ params, body, set }) => {
      const db = await getDb()
      const project = db.data.projects.find((item) => item.id === params.projectId)
      if (!project || !project.webhookEnabled || !project.webhookSecret) {
        set.status = 404
        return { message: 'Webhook not found' }
      }

      const expectedSecret = project.webhookSecret
      if (!hasKey()) {
        set.status = 503
        return { message: 'Launchpad is locked. Sign in to enable encrypted deploy operations.' }
      }

      const actualSecret = decrypt(expectedSecret)
      if (!secretsMatch(String(params.secret), actualSecret)) {
        set.status = 404
        return { message: 'Webhook not found' }
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

      void runDeploy({
        project,
        server,
        imageTag: body.imageTag?.trim() || undefined,
        trigger: body.workflow ? 'github_actions' : 'webhook',
      })

      set.status = 202
      return {
        success: true,
        status: 'deploying',
        trigger: body.workflow ? 'github_actions' : 'webhook',
        ref: body.ref ?? null,
        workflow: body.workflow ?? null,
      }
    },
    { body: webhookBody }
  )
