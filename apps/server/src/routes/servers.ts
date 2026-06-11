import { randomUUID } from 'crypto'
import { Elysia, t } from 'elysia'
import type { Server, ServerConnectionStatus } from '@launchpad/shared'
import { encrypt, hasKey } from '../lib/crypto'
import { getDb, saveDb } from '../lib/db'
import { inferProxyTypeFromProject } from '../lib/projectInference'
import { execCommand, getConnection, testConnection } from '../lib/ssh'

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

function splitImageRef(image: string) {
  const digestIndex = image.indexOf('@')
  const withoutDigest = digestIndex >= 0 ? image.slice(0, digestIndex) : image
  const lastColon = withoutDigest.lastIndexOf(':')
  const lastSlash = withoutDigest.lastIndexOf('/')

  if (lastColon > lastSlash) {
    return {
      repository: withoutDigest.slice(0, lastColon),
      tag: withoutDigest.slice(lastColon + 1),
    }
  }

  return {
    repository: withoutDigest,
    tag: 'latest',
  }
}

export const serverRoutes = new Elysia({ prefix: '/servers' })
  .get('/', async (context: any) => {
    const { requireAuth, set } = context
    await requireAuth()
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
      await requireAuth()
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
    await requireAuth()
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
      await requireAuth()
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
    await requireAuth()
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
    await requireAuth()
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

    server.lastConnectionStatus = status
    server.updatedAt = new Date().toISOString()
    await saveDb()

    return status
  })
  .post('/:id/reclassify-projects', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    const projects = db.data.projects.filter((project) => project.serverId === params.id)
    let updated = 0

    for (const project of projects) {
      const inferred = inferProxyTypeFromProject(project)
      if (project.proxyType !== inferred && inferred !== 'none') {
        project.proxyType = inferred
        project.updatedAt = new Date().toISOString()
        updated += 1
      }
    }

    if (updated > 0) {
      await saveDb()
    }

    return { success: true, updated }
  })
  .get('/:id/discover', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === params.id)
    if (!server) {
      set.status = 404
      return { message: 'Server not found' }
    }

    let ssh: Awaited<ReturnType<typeof getConnection>> | null = null

    try {
      ssh = await getConnection(server)

      const idsResult = await execCommand(ssh, 'docker ps -q')
      if (idsResult.code !== 0) {
        set.status = 500
        return { message: idsResult.stderr || idsResult.stdout || 'Failed to query running containers' }
      }

      const ids = idsResult.stdout
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean)

      if (ids.length === 0) {
        return []
      }

      const inspectResult = await execCommand(ssh, `docker inspect --format='{{json .}}' ${ids.join(' ')}`)
      if (inspectResult.code !== 0) {
        set.status = 500
        return { message: inspectResult.stderr || inspectResult.stdout || 'Failed to inspect running containers' }
      }

      const containers = inspectResult.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as any)

      const discovered = await Promise.all(
        containers.map(async (container) => {
          const image = container.Config?.Image ?? ''
          const { repository, tag } = splitImageRef(image)
          const labels = container.Config?.Labels ?? {}
          const workingDir =
            labels['com.docker.compose.project.working_dir'] ||
            container.Config?.WorkingDir ||
            undefined
          const composeService = labels['com.docker.compose.service'] || undefined
          const composeProject = labels['com.docker.compose.project'] || undefined
          const containerName = String(container.Name || '').replace(/^\//, '')
          const ports = Array.isArray(container.NetworkSettings?.Ports)
            ? []
            : Object.keys(container.NetworkSettings?.Ports ?? {})
          const envPath = workingDir ? `${workingDir.replace(/\/$/, '')}/.env` : undefined
          const importable = Boolean(composeService && workingDir)
          const proxyType = inferProxyTypeFromProject({
            name: composeService || composeProject || containerName,
            repoImage: repository,
            workingDir,
            deployCommands: workingDir
              ? ['docker compose pull', 'docker compose up -d']
              : ['docker pull ' + image],
          })
          const existingProject = db.data.projects.find(
            (project) =>
              project.serverId === server.id &&
              ((workingDir && project.workingDir === workingDir) ||
                project.name === composeService ||
                project.repoImage === repository)
          )

          let envExists = false
          if (envPath) {
            const envCheck = await execCommand(ssh!, `[ -f '${envPath.replace(/'/g, `'\"'\"'`)}' ] && echo yes || echo no`)
            envExists = envCheck.stdout.trim() === 'yes'
          }

          return {
            containerId: container.Id,
            containerName,
            image,
            imageRepository: repository,
            imageTag: tag,
            status: container.State?.Status ?? 'unknown',
            ports,
            workingDir,
            envPath: envExists ? envPath : undefined,
            composeProject,
            composeService,
            alreadyImported: Boolean(existingProject),
            importable,
            importReason: importable
              ? undefined
              : 'Automatic import currently works best for Docker Compose-managed apps with a detected working directory.',
            suggestedProject: {
              name: composeService || composeProject || containerName,
              repoImage: repository,
              deployCommands: workingDir
                ? ['docker compose pull', 'docker compose up -d']
                : ['docker pull ' + image],
              envPath: envExists ? envPath : undefined,
              workingDir,
              proxyType,
              webhookEnabled: false,
              notifications: {
                onSuccess: true,
                onFailure: true,
                webhooks: [],
              },
            },
          }
        })
      )

      return discovered
    } catch (error) {
      set.status = 500
      return { message: error instanceof Error ? error.message : 'Failed to discover projects' }
    } finally {
      ssh?.dispose()
    }
  })
