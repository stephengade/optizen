import { Elysia, t } from 'elysia'
import type { DeployRecord, Project, Server } from '@launchpad/shared'
import { hasKey } from '../lib/crypto'
import { requireDangerousActionAuth } from '../lib/dangerousAction'
import { getDb } from '../lib/db'
import { runDeploy } from '../lib/deployments'
import { execCommand, getConnection } from '../lib/ssh'

function requireCryptoReady(set: { status?: number | string }) {
  if (!hasKey()) {
    set.status = 401
    throw new Error('Encryption key not loaded. Please log in again.')
  }
}

function parseTag(image: string) {
  const match = image.match(/:([^/:]+)$/)
  return match?.[1] ?? 'latest'
}

async function loadProjectServer(projectId: string) {
  const db = await getDb()
  const project = db.data.projects.find((item) => item.id === projectId)
  if (!project) {
    return { db, project: null, server: null as Server | null }
  }

  const server = db.data.servers.find((item) => item.id === project.serverId) ?? null
  return { db, project, server }
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

async function getStatus(project: Project, server: Server) {
  return withSsh(server, async (ssh) => {
    const result = await execCommand(
      ssh,
      `docker ps --filter ancestor=${project.repoImage} --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.RunningFor}}\t{{.Ports}}\t{{.Status}}" | head -n 1`,
      { cwd: project.workingDir }
    )

    if (result.code !== 0 || !result.stdout.trim()) {
      return {
        containerId: '',
        name: '',
        image: project.repoImage,
        tag: 'unknown',
        status: 'not_running',
        uptime: '',
        ports: [] as string[],
        restartCount: 0,
      }
    }

    const [containerId, name, image, uptime, ports, status] = result.stdout.split('\t')
    return {
      containerId,
      name,
      image,
      tag: parseTag(image),
      status,
      uptime,
      ports: ports ? ports.split(',').map((value) => value.trim()).filter(Boolean) : [],
      restartCount: 0,
    }
  })
}

export const imageRoutes = new Elysia({ prefix: '/images' })
  .get('/:projectId/status', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const { project, server } = await loadProjectServer(params.projectId)
    if (!project) {
      set.status = 404
      return { message: 'Project not found' }
    }
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    return getStatus(project, server)
  })
  .post(
    '/:projectId/pull',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)
      const denied = await requireDangerousActionAuth(context)
      if (denied) return denied

      const { project, server } = await loadProjectServer(params.projectId)
      if (!project) {
        set.status = 404
        return { message: 'Project not found' }
      }
      if (!server) {
        set.status = 404
        return { message: 'Server not found' }
      }

      const tag = body.tag?.trim() || 'latest'
      const imageRef = `${project.repoImage}:${tag}`

      return withSsh(server, async (ssh) => {
        const result = await execCommand(ssh, `docker pull ${imageRef}`, { cwd: project.workingDir })
        if (result.code !== 0) {
          set.status = 500
          return { message: result.stderr || result.stdout || `Failed to pull ${imageRef}` }
        }

        return {
          success: true,
          tag,
          output: result.stdout,
        }
      })
    },
    { body: t.Object({ tag: t.Optional(t.String()) }) }
  )
  .post(
    '/:projectId/rollback',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)
      const denied = await requireDangerousActionAuth(context)
      if (denied) return denied

      const { db, project, server } = await loadProjectServer(params.projectId)
      if (!project) {
        set.status = 404
        return { message: 'Project not found' }
      }
      if (!server) {
        set.status = 404
        return { message: 'Server not found' }
      }

      const candidates = db.data.deployHistory.filter(
        (record) => record.projectId === project.id && record.status === 'success'
      )
      const target = body.deployId
        ? candidates.find((record) => record.id === body.deployId)
        : candidates.find((record) => record.imageTag)

      if (!target?.imageTag) {
        set.status = 400
        return { message: 'No successful deploy with an image tag was found for rollback' }
      }

      void runDeploy({
        project,
        server,
        imageTag: target.imageTag,
        trigger: 'ui',
      })

      set.status = 202
      return {
        success: true,
        deployId: target.id,
        imageTag: target.imageTag,
      }
    },
    { body: t.Object({ deployId: t.Optional(t.String()) }) }
  )
  .post('/:projectId/prune', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)
    const denied = await requireDangerousActionAuth(context)
    if (denied) return denied

    const { project, server } = await loadProjectServer(params.projectId)
    if (!project) {
      set.status = 404
      return { message: 'Project not found' }
    }
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    return withSsh(server, async (ssh) => {
      const result = await execCommand(ssh, 'docker image prune -f', { cwd: project.workingDir })
      if (result.code !== 0) {
        set.status = 500
        return { message: result.stderr || result.stdout || 'Failed to prune images' }
      }

      return {
        success: true,
        output: result.stdout,
      }
    })
  })
  .get('/:projectId/tags', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const { project, server } = await loadProjectServer(params.projectId)
    if (!project) {
      set.status = 404
      return { message: 'Project not found' }
    }
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    return withSsh(server, async (ssh) => {
      const result = await execCommand(
        ssh,
        `docker image ls ${project.repoImage} --format "{{.Tag}}"`,
        { cwd: project.workingDir }
      )

      if (result.code !== 0) {
        set.status = 500
        return { message: result.stderr || result.stdout || 'Failed to list image tags' }
      }

      const tags = Array.from(new Set(result.stdout.split('\n').map((tag) => tag.trim()).filter(Boolean)))
      return { tags }
    })
  })
