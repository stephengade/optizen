import { Elysia, t } from 'elysia'
import { hasKey } from '../lib/crypto'
import { getDb } from '../lib/db'
import { getConnection, readRemoteFile, writeRemoteFile } from '../lib/ssh'

const updateBody = t.Object({
  content: t.String(),
})

function requireCryptoReady(set: { status?: number | string }) {
  if (!hasKey()) {
    set.status = 401
    throw new Error('Encryption key not loaded. Please log in again.')
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
      return {
        path: project.envPath,
        content,
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
        ssh = await getConnection(server)
        await writeRemoteFile(ssh, project.envPath, body.content)
        return {
          success: true,
          path: project.envPath,
        }
      } finally {
        ssh?.dispose()
      }
    },
    { body: updateBody }
  )
