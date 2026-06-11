import { Elysia } from 'elysia'
import { hasKey } from '../lib/crypto'
import { getDb } from '../lib/db'
import { execCommand, getConnection } from '../lib/ssh'

function requireCryptoReady(set: { status?: number | string }) {
  if (!hasKey()) {
    set.status = 401
    throw new Error('Encryption key not loaded. Please log in again.')
  }
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
}

function buildLogCommand(project: {
  runtime?: string
  repoImage: string
  workingDir?: string
  name: string
}, source: string, lines: number) {
  if (source === 'compose') {
    return {
      command: `docker compose logs --tail ${lines} --no-color`,
      cwd: project.workingDir,
      label: 'Compose logs',
    }
  }

  if (source === 'container') {
    return {
      command: `docker logs --tail ${lines} $(docker ps --filter ancestor=${shellEscape(project.repoImage)} --format "{{.ID}}" | head -n 1)`,
      cwd: project.workingDir,
      label: 'Container logs',
    }
  }

  return {
    command: `journalctl -n ${lines} --no-pager -u ${shellEscape(project.name)}`,
    cwd: project.workingDir,
    label: 'Service logs',
  }
}

export const logRoutes = new Elysia({ prefix: '/logs' })
  .get('/:projectId/sources', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const project = db.data.projects.find((item) => item.id === params.projectId)
    if (!project) {
      set.status = 404
      return { message: 'Project not found' }
    }

    const sources = []
    if (project.runtime === 'compose' && project.workingDir) {
      sources.push({ id: 'compose', label: 'Compose logs' })
    }

    sources.push({ id: 'container', label: 'Container logs' })
    if (project.runtime === 'custom') {
      sources.push({ id: 'service', label: 'System service logs' })
    }

    return sources
  })
  .get('/:projectId/snapshot', async (context: any) => {
    const { requireAuth, params, query, set } = context
    await requireAuth()
    requireCryptoReady(set)

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

    const source = typeof query.source === 'string' && query.source ? query.source : project.runtime === 'compose' ? 'compose' : 'container'
    const lines = typeof query.lines === 'string' ? Number(query.lines) : 120
    const { command, cwd, label } = buildLogCommand(project, source, Number.isFinite(lines) ? Math.min(Math.max(lines, 20), 300) : 120)

    let ssh: Awaited<ReturnType<typeof getConnection>> | null = null
    try {
      ssh = await getConnection(server)
      const result = await execCommand(ssh, command, { cwd })
      if (result.code !== 0) {
        set.status = 500
        return { message: result.stderr || result.stdout || 'Failed to load logs' }
      }

      const snapshot = result.stdout
        .split('\n')
        .map((line) => line.trimEnd())
        .filter(Boolean)

      return {
        source,
        label,
        checkedAt: new Date().toISOString(),
        lines: snapshot,
      }
    } finally {
      ssh?.dispose()
    }
  })
