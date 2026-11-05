import { Elysia, t } from 'elysia'
import type { MemoryActionResult, Server } from '@launchpad/shared'
import { recordActivity } from '../lib/activity'
import { hasKey } from '../lib/crypto'
import { requireDangerousActionAuth } from '../lib/dangerousAction'
import { getDb } from '../lib/db'
import { dropPageCache, fetchMemoryReport, killProcess, restartContainer } from '../lib/memory'

function formatMb(bytes?: number) {
  return bytes === undefined ? '?' : `${Math.round(bytes / 1024 / 1024)} MB`
}

function describeChange(result: MemoryActionResult) {
  if (result.availableBeforeBytes === undefined || result.availableAfterBytes === undefined) return result.output
  return `${result.output} Available memory: ${formatMb(result.availableBeforeBytes)} → ${formatMb(result.availableAfterBytes)}.`
}

async function loadServer(context: any): Promise<Server | { message: string }> {
  const { requireAuth, params, set } = context
  await requireAuth()
  if (!hasKey()) {
    set.status = 401
    return { message: 'Encryption key not loaded. Please log in again.' }
  }
  const db = await getDb()
  const server = db.data.servers.find((item) => item.id === params.id)
  if (!server) {
    set.status = 404
    return { message: 'Server not found' }
  }
  return server
}

function isServer(value: Server | { message: string }): value is Server {
  return 'id' in value
}

async function runAction(
  context: any,
  action: (server: Server) => Promise<MemoryActionResult>,
  title: (server: Server) => string
) {
  const server = await loadServer(context)
  if (!isServer(server)) return server
  const denied = await requireDangerousActionAuth(context)
  if (denied) return denied

  try {
    const result = await action(server)
    await recordActivity({
      serverId: server.id,
      type: 'server_memory_freed',
      status: result.success ? 'warning' : 'info',
      title: title(server),
      detail: describeChange(result),
    })
    return result
  } catch (error) {
    console.error('[memory]', { serverId: server.id, error })
    context.set.status = 500
    return { message: error instanceof Error ? error.message : 'Memory action failed' }
  }
}

export const memoryRoutes = new Elysia({ prefix: '/servers' })
  .get('/:id/memory', async (context: any) => {
    const server = await loadServer(context)
    if (!isServer(server)) return server
    try {
      return await fetchMemoryReport(server)
    } catch (error) {
      console.error('[memory:report]', { serverId: server.id, error })
      context.set.status = 500
      return { message: error instanceof Error ? error.message : 'Failed to read memory usage' }
    }
  })
  .post('/:id/memory/drop-caches', (context: any) =>
    runAction(context, dropPageCache, (server) => `Dropped page cache on ${server.name}`)
  )
  .post(
    '/:id/memory/restart-container',
    (context: any) =>
      runAction(
        context,
        (server) => restartContainer(server, context.body.container),
        (server) => `Restarted container ${context.body.container} on ${server.name}`
      ),
    { body: t.Object({ container: t.String({ minLength: 1, maxLength: 128 }) }) }
  )
  .post(
    '/:id/memory/kill-process',
    (context: any) =>
      runAction(
        context,
        (server) => killProcess(server, context.body.pid, context.body.signal),
        (server) => `Sent SIG${context.body.signal} to pid ${context.body.pid} on ${server.name}`
      ),
    {
      body: t.Object({
        pid: t.Integer({ minimum: 2 }),
        signal: t.Union([t.Literal('TERM'), t.Literal('KILL')]),
      }),
    }
  )
