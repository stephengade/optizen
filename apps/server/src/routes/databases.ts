import { randomUUID } from 'crypto'
import { Elysia, t } from 'elysia'
import { findClientCommand, isReadOnlySql, type DatabaseConnection, type Server } from '@launchpad/shared'
import { recordActivity } from '../lib/activity'
import { encrypt, hasKey } from '../lib/crypto'
import { requireDangerousActionAuth } from '../lib/dangerousAction'
import { getDb, saveDb } from '../lib/db'
import { browseTable, detectDatabases, DatabaseError, listTables, runQuery } from '../lib/databases'

const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/
const HOST = /^[A-Za-z0-9._:-]{1,253}$/
const USER = /^[A-Za-z0-9_.@$-]{1,128}$/

function serialize(connection: DatabaseConnection) {
  const { password, ...rest } = connection
  return { ...rest, hasPassword: Boolean(password) }
}

/** Common guard: signed in, key loaded. Returns an error body or null. */
async function guard(context: any) {
  await context.requireAuth()
  if (!hasKey()) {
    context.set.status = 401
    return { message: 'Encryption key not loaded. Please log in again.' }
  }
  return null
}

async function loadConnection(context: any): Promise<{ connection: DatabaseConnection; server: Server } | { message: string }> {
  const denied = await guard(context)
  if (denied) return denied
  const db = await getDb()
  const connection = db.data.databases.find((item) => item.id === context.params.id)
  const server = connection && db.data.servers.find((item) => item.id === connection.serverId)
  if (!connection || !server) {
    context.set.status = 404
    return { message: 'Database not found' }
  }
  return { connection, server }
}

function fail(context: any, error: unknown, fallback: string) {
  context.set.status = error instanceof DatabaseError ? error.status : 500
  if (!(error instanceof DatabaseError)) console.error('[databases]', error)
  return {
    message: error instanceof Error ? error.message : fallback,
    code: error instanceof DatabaseError ? error.code : undefined,
  }
}

/** Validate the fields that end up on a remote command line (they are also shell-escaped). */
function validate(input: Partial<DatabaseConnection>): string | null {
  if (input.access === 'docker' && !(input.container && NAME.test(input.container))) return 'Enter the container name or id.'
  if (input.host && !HOST.test(input.host)) return 'The host can only contain letters, digits, dots, colons, dashes and underscores.'
  if (input.user && !USER.test(input.user)) return 'The user name contains characters that are not allowed.'
  if (input.engine === 'sqlite' && !input.database?.trim()) return 'Enter the path to the SQLite file.'
  if (input.database && (input.database.length > 1024 || /[\0\n\r]/.test(input.database))) return 'The database name or path is not valid.'
  return null
}

const connectionBody = t.Object({
  serverId: t.String({ minLength: 1 }),
  name: t.String({ minLength: 1, maxLength: 80 }),
  engine: t.Union([t.Literal('postgres'), t.Literal('mysql'), t.Literal('sqlite')]),
  access: t.Union([t.Literal('docker'), t.Literal('host')]),
  container: t.Optional(t.String({ maxLength: 128 })),
  host: t.Optional(t.String({ maxLength: 253 })),
  port: t.Optional(t.Integer({ minimum: 1, maximum: 65535 })),
  user: t.Optional(t.String({ maxLength: 128 })),
  password: t.Optional(t.String({ maxLength: 1024 })),
  clearPassword: t.Optional(t.Boolean()),
  database: t.Optional(t.String({ maxLength: 1024 })),
})

function clean(body: any): Partial<DatabaseConnection> {
  const trim = (value?: string) => value?.trim() || undefined
  return {
    serverId: body.serverId,
    name: body.name.trim(),
    engine: body.engine,
    access: body.access,
    container: body.access === 'docker' ? trim(body.container) : undefined,
    host: body.engine === 'sqlite' ? undefined : trim(body.host),
    port: body.engine === 'sqlite' ? undefined : body.port,
    user: body.engine === 'sqlite' ? undefined : trim(body.user),
    database: trim(body.database),
  }
}

export const databaseRoutes = new Elysia()
  .get('/databases', async (context: any) => {
    const denied = await guard(context)
    if (denied) return denied
    const db = await getDb()
    return db.data.databases.map(serialize)
  })
  .get('/databases/:id', async (context: any) => {
    const loaded = await loadConnection(context)
    if ('message' in loaded) return loaded
    return serialize(loaded.connection)
  })
  .post(
    '/databases',
    async (context: any) => {
      const denied = await guard(context)
      if (denied) return denied
      const db = await getDb()
      const server = db.data.servers.find((item) => item.id === context.body.serverId)
      if (!server) {
        context.set.status = 404
        return { message: 'Server not found' }
      }
      const fields = clean(context.body)
      const invalid = validate(fields)
      if (invalid) {
        context.set.status = 400
        return { message: invalid }
      }
      const now = new Date().toISOString()
      const connection = {
        ...fields,
        id: randomUUID(),
        password: context.body.password ? encrypt(context.body.password) : undefined,
        createdAt: now,
        updatedAt: now,
      } as DatabaseConnection
      db.data.databases.push(connection)
      await saveDb()
      await recordActivity({
        serverId: server.id,
        type: 'database_added',
        status: 'info',
        title: `Added database ${connection.name}`,
      })
      return serialize(connection)
    },
    { body: connectionBody }
  )
  .put(
    '/databases/:id',
    async (context: any) => {
      const loaded = await loadConnection(context)
      if ('message' in loaded) return loaded
      const db = await getDb()
      if (!db.data.servers.some((item) => item.id === context.body.serverId)) {
        context.set.status = 404
        return { message: 'Server not found' }
      }
      const fields = clean(context.body)
      const invalid = validate(fields)
      if (invalid) {
        context.set.status = 400
        return { message: invalid }
      }
      const connection = loaded.connection
      const password = context.body.clearPassword
        ? undefined
        : context.body.password
          ? encrypt(context.body.password)
          : connection.password
      Object.assign(connection, fields, { password, updatedAt: new Date().toISOString() })
      await saveDb()
      return serialize(connection)
    },
    { body: connectionBody }
  )
  .delete('/databases/:id', async (context: any) => {
    const loaded = await loadConnection(context)
    if ('message' in loaded) return loaded
    const db = await getDb()
    db.data.databases = db.data.databases.filter((item) => item.id !== loaded.connection.id)
    await saveDb()
    await recordActivity({
      serverId: loaded.server.id,
      type: 'database_removed',
      status: 'info',
      title: `Removed database ${loaded.connection.name}`,
      detail: 'Only the saved connection was removed. The database itself was not touched.',
    })
    return { success: true }
  })
  .post('/databases/:id/test', async (context: any) => {
    const loaded = await loadConnection(context)
    if ('message' in loaded) return loaded
    const versionQuery = loaded.connection.engine === 'sqlite' ? 'select sqlite_version() as version' : 'select version() as version'
    try {
      const result = await runQuery(loaded.server, loaded.connection, versionQuery, { readOnly: true })
      return { ok: true, version: result.results[0]?.rows[0]?.[0] ?? undefined, latencyMs: result.durationMs }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  })
  .get('/databases/:id/tables', async (context: any) => {
    const loaded = await loadConnection(context)
    if ('message' in loaded) return loaded
    try {
      return await listTables(loaded.server, loaded.connection)
    } catch (error) {
      return fail(context, error, 'Failed to list tables')
    }
  })
  .get(
    '/databases/:id/rows',
    async (context: any) => {
      const loaded = await loadConnection(context)
      if ('message' in loaded) return loaded
      const { schema, table, page, pageSize, orderBy, desc } = context.query
      try {
        return await browseTable(loaded.server, loaded.connection, {
          schema: schema ?? '',
          table,
          page: Number(page ?? 1),
          pageSize: Number(pageSize ?? 50),
          orderBy: orderBy || undefined,
          desc: desc === 'true',
        })
      } catch (error) {
        return fail(context, error, 'Failed to load rows')
      }
    },
    {
      query: t.Object({
        schema: t.Optional(t.String({ maxLength: 128 })),
        table: t.String({ minLength: 1, maxLength: 128 }),
        page: t.Optional(t.Numeric({ minimum: 1, maximum: 1_000_000 })),
        pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 500 })),
        orderBy: t.Optional(t.String({ maxLength: 128 })),
        desc: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/databases/:id/query',
    async (context: any) => {
      const loaded = await loadConnection(context)
      if ('message' in loaded) return loaded
      const { sql, allowWrites } = context.body
      const clientCommand = findClientCommand(loaded.connection.engine, sql)
      if (clientCommand) {
        context.set.status = 400
        return { message: `Client commands such as ${clientCommand} are not allowed here. Use plain SQL.`, code: 'client_command' }
      }
      const readOnly = isReadOnlySql(sql)

      if (!readOnly) {
        if (!allowWrites) {
          context.set.status = 400
          return {
            message: 'This query changes data. Turn on "Allow writes" to run it.',
            code: 'write_blocked',
          }
        }
        const denied = await requireDangerousActionAuth(context)
        if (denied) return denied
      }

      try {
        // Even a script that looks read-only runs in a read-only session unless writes are allowed.
        const result = await runQuery(loaded.server, loaded.connection, sql, { readOnly: !allowWrites })
        if (!readOnly) {
          await recordActivity({
            serverId: loaded.server.id,
            type: 'database_write',
            status: 'warning',
            title: `Ran a write query on ${loaded.connection.name}`,
            detail: sql.length > 400 ? `${sql.slice(0, 400)}…` : sql,
          })
        }
        return result
      } catch (error) {
        return fail(context, error, 'Query failed')
      }
    },
    {
      body: t.Object({
        sql: t.String({ minLength: 1, maxLength: 200_000 }),
        allowWrites: t.Optional(t.Boolean()),
      }),
    }
  )
  .get('/servers/:id/databases/detect', async (context: any) => {
    const denied = await guard(context)
    if (denied) return denied
    const db = await getDb()
    const server = db.data.servers.find((item) => item.id === context.params.id)
    if (!server) {
      context.set.status = 404
      return { message: 'Server not found' }
    }
    try {
      return await detectDatabases(server)
    } catch (error) {
      return fail(context, error, 'Failed to look for databases')
    }
  })
