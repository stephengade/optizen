import { Elysia, t } from 'elysia'
import { listFileRevisions, saveFileRevision } from '../lib/fileHistory'
import { recordActivity } from '../lib/activity'
import { hasKey } from '../lib/crypto'
import { getDb } from '../lib/db'
import { backupRemoteFile, getConnection, readRemoteFile, writeRemoteFile } from '../lib/ssh'

const updateBody = t.Object({
  content: t.String(),
})

const restoreBody = t.Object({
  revisionId: t.String(),
})

function requireCryptoReady(set: { status?: number | string }) {
  if (!hasKey()) {
    set.status = 401
    throw new Error('Encryption key not loaded. Please log in again.')
  }
}

function validateEnvContent(content: string) {
  const lines = content.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('export ')) continue
    if (!line.includes('=')) {
      throw new Error(`Env validation failed on line ${index + 1}: expected KEY=value format.`)
    }
  }
}

export const envRoutes = new Elysia({ prefix: '/env' })
  .get('/:projectId', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const project = db.data.projects.find((item) => item.id === params.projectId)
    if (!project) {
      set.status = 404
      return { message: 'Project not found' }
    }

    if (!project.envPath) {
      set.status = 400
      return { message: 'This project does not have an env path configured' }
    }

    const server = db.data.servers.find((item) => item.id === project.serverId)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    let ssh: Awaited<ReturnType<typeof getConnection>> | null = null

    try {
      ssh = await getConnection(server)
      const content = await readRemoteFile(ssh, project.envPath)
      const revisions = await listFileRevisions({
        kind: 'env',
        projectId: project.id,
        path: project.envPath,
      })
      return {
        path: project.envPath,
        content,
        revisions,
      }
    } finally {
      ssh?.dispose()
    }
  })
  .put(
    '/:projectId',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)

      const db = await getDb()
      const project = db.data.projects.find((item) => item.id === params.projectId)
      if (!project) {
        set.status = 404
        return { message: 'Project not found' }
      }

      if (!project.envPath) {
        set.status = 400
        return { message: 'This project does not have an env path configured' }
      }

      const server = db.data.servers.find((item) => item.id === project.serverId)
      if (!server) {
        set.status = 404
        return { message: 'Server not found' }
      }

      let ssh: Awaited<ReturnType<typeof getConnection>> | null = null

      try {
        validateEnvContent(body.content)
        const previousRevisions = await listFileRevisions({
          kind: 'env',
          projectId: project.id,
          path: project.envPath,
        })
        const currentContent = previousRevisions[0]?.content
        ssh = await getConnection(server)
        const remoteBefore = await readRemoteFile(ssh, project.envPath)
        if (remoteBefore) {
          await saveFileRevision({
            kind: 'env',
            serverId: server.id,
            projectId: project.id,
            path: project.envPath,
            content: remoteBefore,
            summary: 'Snapshot before env overwrite',
          })
        }
        const backupPath = await backupRemoteFile(ssh, project.envPath)
        await writeRemoteFile(ssh, project.envPath, body.content)
        await recordActivity({
          serverId: project.serverId,
          projectId: project.id,
          type: 'env_updated',
          status: 'info',
          title: `Updated env for ${project.name}`,
          detail: `${project.envPath} backed up to ${backupPath}`,
        })
        return {
          success: true,
          path: project.envPath,
          backupPath,
          previousRevisionId: currentContent ? previousRevisions[0]?.id : undefined,
        }
      } finally {
        ssh?.dispose()
      }
    },
    { body: updateBody }
  )
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

    if (!project.envPath) {
      set.status = 400
      return { message: 'This project does not have an env path configured' }
    }

    return listFileRevisions({
      kind: 'env',
      projectId: project.id,
      path: project.envPath,
    })
  })
  .post(
    '/:projectId/restore',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)

      const db = await getDb()
      const project = db.data.projects.find((item) => item.id === params.projectId)
      if (!project) {
        set.status = 404
        return { message: 'Project not found' }
      }

      if (!project.envPath) {
        set.status = 400
        return { message: 'This project does not have an env path configured' }
      }

      const revision = db.data.fileHistory.find(
        (item) => item.id === body.revisionId && item.kind === 'env' && item.projectId === project.id
      )
      if (!revision) {
        set.status = 404
        return { message: 'Env revision not found' }
      }

      const server = db.data.servers.find((item) => item.id === project.serverId)
      if (!server) {
        set.status = 404
        return { message: 'Server not found' }
      }

      let ssh: Awaited<ReturnType<typeof getConnection>> | null = null
      try {
        ssh = await getConnection(server)
        const backupPath = await backupRemoteFile(ssh, project.envPath)
        await writeRemoteFile(ssh, project.envPath, revision.content)
        await recordActivity({
          serverId: project.serverId,
          projectId: project.id,
          type: 'env_updated',
          status: 'warning',
          title: `Restored env for ${project.name}`,
          detail: `Restored revision from ${revision.createdAt}. Backup: ${backupPath}`,
        })

        return { success: true, path: project.envPath, backupPath }
      } finally {
        ssh?.dispose()
      }
    },
    { body: restoreBody }
  )
