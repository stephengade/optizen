/**
 * Databases on managed servers: run SQL, list tables, page through rows.
 *
 * Nothing listens on a new port. Each request opens SSH to the server and runs the engine's own
 * command-line client there (psql, mysql, sqlite3), either installed on the host or inside the
 * database's Docker container. The SQL and the password travel over stdin, so neither shows up in
 * the remote process list or shell history.
 *
 * Read-only is enforced by the database itself (a read-only session or a read-only file handle),
 * not only by looking at the SQL.
 */
import type { NodeSSH } from 'node-ssh'
import { findClientCommand } from '@launchpad/shared'
import type {
  DatabaseConnection,
  DatabaseQueryResult,
  DatabaseResultSet,
  DatabaseTable,
  DetectedDatabase,
  Server,
} from '@launchpad/shared'
import { decrypt } from './crypto'
import { getConnection } from './ssh'

export class DatabaseError extends Error {
  constructor(message: string, public status = 400, public code?: string) {
    super(message)
  }
}

/** Rows kept per result set; the rest are counted but not sent to the browser. */
export const MAX_ROWS = 1000
/** Cap on client output read back over SSH. */
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024
const QUERY_TIMEOUT_SECONDS = 60

// Separators for psql's unaligned output. Control characters never appear in normal text.
const FIELD = '\x1f'
const RECORD = '\x1e'
const NULL = '\x1a'

export function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

/* ------------------------------------------------------------------ */
/* Command building                                                    */
/* ------------------------------------------------------------------ */

interface ClientCommand {
  /** Shell script run on the server; reads the password line, then hands stdin to the client */
  script: string
  /** Text written to stdin after the password line */
  stdin: string
}

function clientInvocation(connection: DatabaseConnection, readOnly: boolean): { env: Record<string, string>; passEnv: string[]; argv: string[] } {
  const db = connection.database
  switch (connection.engine) {
    case 'postgres': {
      const options = [`-c statement_timeout=${QUERY_TIMEOUT_SECONDS * 1000}`]
      if (readOnly) options.push('-c default_transaction_read_only=on')
      const argv = ['psql', '-X', '-w', '-v', 'ON_ERROR_STOP=1', '-A', '-F', FIELD, '-R', RECORD, '-P', `null=${NULL}`, '-P', 'footer=on', '-P', 'pager=off']
      if (connection.host) argv.push('-h', connection.host)
      if (connection.port) argv.push('-p', String(connection.port))
      argv.push('-U', connection.user || 'postgres')
      if (db) argv.push('-d', db)
      return {
        env: { PGOPTIONS: options.join(' '), PGCLIENTENCODING: 'UTF8', LC_ALL: 'C', PGAPPNAME: 'optizen' },
        passEnv: ['PGPASSWORD'],
        argv,
      }
    }
    case 'mysql': {
      // The time limit comes from `timeout` around the client: MySQL and MariaDB name the
      // server-side setting differently (max_execution_time / max_statement_time).
      const argv = ['mysql', '--xml', '--batch', '--default-character-set=utf8mb4']
      if (readOnly) argv.push('--init-command=SET SESSION TRANSACTION READ ONLY')
      if (connection.host) argv.push('-h', connection.host, '--protocol=TCP')
      if (connection.port) argv.push('-P', String(connection.port))
      argv.push('-u', connection.user || 'root')
      if (db) argv.push(db)
      return { env: {}, passEnv: ['MYSQL_PWD'], argv }
    }
    case 'sqlite': {
      const argv = ['sqlite3', '-bail', '-json']
      if (readOnly) argv.push('-readonly')
      argv.push(db ?? '')
      return { env: {}, passEnv: [], argv }
    }
  }
}

export function buildClientCommand(connection: DatabaseConnection, sql: string, readOnly: boolean, password?: string): ClientCommand {
  const { env, passEnv, argv } = clientInvocation(connection, readOnly)
  const lines = ['IFS= read -r OPTZ_PW']
  for (const name of passEnv) lines.push(`if [ -n "$OPTZ_PW" ]; then export ${name}="$OPTZ_PW"; fi`)
  lines.push('unset OPTZ_PW')
  for (const [name, value] of Object.entries(env)) lines.push(`export ${name}=${shellEscape(value)}`)

  // MariaDB images and newer distros ship `mariadb` and may drop the `mysql` name, so try both.
  const candidates = connection.engine === 'mysql' ? ['mariadb', 'mysql'] : [argv[0]]
  const docker = connection.access === 'docker'
  const missing = docker
    ? `No ${candidates.join(' or ')} client was found inside the container.`
    : `${candidates.join(' or ')} is not installed on this server. Install the client, or connect through the database's Docker container instead.`
  const pick = `B=""; for c in ${candidates.join(' ')}; do if command -v "$c" >/dev/null 2>&1; then B="$c"; break; fi; done; if [ -z "$B" ]; then echo ${shellEscape(missing)} >&2; exit 127; fi; exec "$B" "$@"`
  const client = `sh -c ${shellEscape(pick)} sh ${argv.slice(1).map(shellEscape).join(' ')}`

  let run: string
  if (docker) {
    const dockerEnv = [...Object.keys(env), ...passEnv].map((name) => `-e ${name}`).join(' ')
    lines.push('if command -v docker >/dev/null 2>&1; then D=docker; elif sudo -n docker version >/dev/null 2>&1; then D="sudo -n docker"; else echo "Docker is not available to the SSH user on this server." >&2; exit 127; fi')
    run = `$D exec -i ${dockerEnv} ${shellEscape(connection.container ?? '')} ${client}`
  } else {
    run = client
  }

  // head caps the output; the client's exit code is reported on stderr since it is lost in the pipe.
  lines.push(`( timeout ${QUERY_TIMEOUT_SECONDS + 15} ${run}; echo "__OPTZ_EXIT=$?" >&2 ) | head -c ${MAX_OUTPUT_BYTES}`)
  return { script: lines.join('\n'), stdin: `${password ?? ''}\n${sql}\n` }
}

/* ------------------------------------------------------------------ */
/* Output parsing                                                      */
/* ------------------------------------------------------------------ */

function capRows(columns: string[], rows: (string | null)[][], rowCount = rows.length): DatabaseResultSet {
  return { columns, rows: rows.slice(0, MAX_ROWS), rowCount, truncated: rowCount > MAX_ROWS }
}

/** Parse psql unaligned output: command tags end in a newline, result sets in "(N rows)". */
export function parsePsqlOutput(out: string): { results: DatabaseResultSet[]; messages: string[] } {
  const results: DatabaseResultSet[] = []
  const messages: string[] = []
  const footer = /^\((\d+) rows?\)\n?/
  let pos = 0

  while (pos < out.length) {
    const nl = out.indexOf('\n', pos)
    const rs = out.indexOf(RECORD, pos)
    const lineEnd = nl === -1 ? out.length : nl

    // A line that ends before any record separator is a command tag such as "UPDATE 3".
    if (rs === -1 || lineEnd < rs) {
      const line = out.slice(pos, lineEnd).trim()
      const bare = footer.exec(out.slice(pos))
      if (bare) {
        // A result with no columns, e.g. "SELECT;"
        results.push(capRows([], [], Number(bare[1])))
      } else if (line) {
        messages.push(line)
      }
      pos = lineEnd + 1
      continue
    }

    const header = out.slice(pos, rs)
    const columns = header ? header.split(FIELD) : []
    pos = rs + 1
    const rows: (string | null)[][] = []
    let rowCount = 0
    while (pos < out.length) {
      const end = footer.exec(out.slice(pos, pos + 32))
      if (end) {
        rowCount = Number(end[1])
        pos += end[0].length
        break
      }
      const next = out.indexOf(RECORD, pos)
      const stop = next === -1 ? out.length : next
      if (rows.length < MAX_ROWS) {
        rows.push(out.slice(pos, stop).split(FIELD).map((value) => (value === NULL ? null : value)))
      }
      rowCount += 1
      pos = stop + 1
    }
    results.push(capRows(columns, rows, Math.max(rowCount, rows.length)))
  }

  return { results, messages }
}

function decodeXml(value: string): string {
  return value.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, entity: string) => {
    if (entity === 'lt') return '<'
    if (entity === 'gt') return '>'
    if (entity === 'amp') return '&'
    if (entity === 'quot') return '"'
    if (entity === 'apos') return "'"
    return String.fromCodePoint(entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10))
  })
}

/** Parse `mysql --xml` output: one <resultset> per statement that returns rows. */
export function parseMysqlXml(out: string): { results: DatabaseResultSet[]; messages: string[] } {
  const results: DatabaseResultSet[] = []
  const setPattern = /<resultset\b[^>]*?(?:\/>|>([\s\S]*?)<\/resultset>)/g
  for (const set of out.matchAll(setPattern)) {
    const columns: string[] = []
    const rows: (string | null)[][] = []
    let rowCount = 0
    for (const row of (set[1] ?? '').matchAll(/<row>([\s\S]*?)<\/row>/g)) {
      const values: (string | null)[] = []
      const fieldPattern = /<field name="([^"]*)"(\s+xsi:nil="true"\s*\/>|>([\s\S]*?)<\/field>|\s*\/>)/g
      for (const field of row[1].matchAll(fieldPattern)) {
        if (rowCount === 0) columns.push(decodeXml(field[1]))
        values.push(field[2].includes('xsi:nil') ? null : decodeXml(field[3] ?? ''))
      }
      if (rows.length < MAX_ROWS) rows.push(values)
      rowCount += 1
    }
    results.push(capRows(columns, rows, rowCount))
  }
  return { results, messages: [] }
}

/**
 * Parse `sqlite3 -json` output: one array of flat objects per statement, printed back to back.
 * JSON.parse would merge duplicate column names (select a.id, b.id) and reorder numeric ones,
 * so this reads the objects key by key instead.
 */
export function parseSqliteJson(out: string): { results: DatabaseResultSet[]; messages: string[] } {
  const results: DatabaseResultSet[] = []
  let i = 0
  const skipSpace = () => {
    while (i < out.length && /[\s,]/.test(out[i])) i += 1
  }
  const readString = () => {
    const start = i
    i += 1
    while (i < out.length && out[i] !== '"') i += out[i] === '\\' ? 2 : 1
    i += 1
    return JSON.parse(out.slice(start, i)) as string
  }
  const readValue = (): string | null => {
    if (out[i] === '"') return readString()
    const match = /^(null|true|false|-?[0-9][0-9.eE+-]*)/.exec(out.slice(i, i + 64))
    if (!match) throw new Error(`Unexpected sqlite output near: ${out.slice(i, i + 20)}`)
    i += match[0].length
    return match[0] === 'null' ? null : match[0]
  }

  skipSpace()
  while (i < out.length) {
    if (out[i] !== '[') throw new Error('Unexpected sqlite output')
    i += 1
    let columns: string[] = []
    const rows: (string | null)[][] = []
    let rowCount = 0
    skipSpace()
    while (out[i] === '{') {
      i += 1
      const keys: string[] = []
      const values: (string | null)[] = []
      skipSpace()
      while (out[i] !== '}') {
        keys.push(readString())
        while (out[i] !== ':') i += 1
        i += 1
        while (/\s/.test(out[i])) i += 1
        values.push(readValue())
        skipSpace()
      }
      i += 1
      if (rowCount === 0) columns = keys
      if (rows.length < MAX_ROWS) rows.push(values)
      rowCount += 1
      skipSpace()
    }
    i += 1 // ]
    results.push(capRows(columns, rows, rowCount))
    skipSpace()
  }
  return { results, messages: [] }
}

function parseOutput(engine: DatabaseConnection['engine'], out: string) {
  if (engine === 'postgres') return parsePsqlOutput(out)
  if (engine === 'mysql') return parseMysqlXml(out)
  return parseSqliteJson(out)
}

/** Turn client stderr into a readable message. */
function cleanError(stderr: string): string {
  return stderr
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith('__OPTZ_EXIT=') && !/^(mysql|mariadb): (\[Warning\]|Deprecated)/.test(line) && !/^WARNING: option --ssl/.test(line))
    .join('\n')
    .replace(/^psql:<stdin>:\d+: /gm, '')
    .trim()
}

/* ------------------------------------------------------------------ */
/* Running                                                             */
/* ------------------------------------------------------------------ */

async function withSsh<T>(server: Server, fn: (ssh: NodeSSH) => Promise<T>): Promise<T> {
  let ssh: NodeSSH
  try {
    ssh = await getConnection(server)
  } catch (error) {
    throw new DatabaseError(error instanceof Error ? error.message : 'SSH connection failed', 502, 'ssh_failed')
  }
  try {
    return await fn(ssh)
  } finally {
    ssh.dispose()
  }
}

export async function runQuery(
  server: Server,
  connection: DatabaseConnection,
  sql: string,
  options: { readOnly: boolean }
): Promise<DatabaseQueryResult> {
  const clientCommand = findClientCommand(connection.engine, sql)
  if (clientCommand) {
    throw new DatabaseError(`Client commands such as ${clientCommand} are not allowed here. Use plain SQL.`, 400, 'client_command')
  }
  const password = connection.password ? decrypt(connection.password) : undefined
  const command = buildClientCommand(connection, sql, options.readOnly, password)
  const started = Date.now()

  const { stdout, stderr } = await withSsh(server, (ssh) =>
    ssh.execCommand(command.script, { stdin: command.stdin, execOptions: {} })
  )
  const durationMs = Date.now() - started
  const exitCode = Number(/__OPTZ_EXIT=(\d+)/.exec(stderr)?.[1] ?? '0')
  const message = cleanError(stderr)

  let parsed: { results: DatabaseResultSet[]; messages: string[] }
  try {
    parsed = parseOutput(connection.engine, stdout)
  } catch {
    parsed = { results: [], messages: [] }
  }

  if (exitCode !== 0) {
    if (exitCode === 124) throw new DatabaseError(`The query ran longer than ${QUERY_TIMEOUT_SECONDS} seconds and was stopped.`, 408, 'timeout')
    if (stdout.length >= MAX_OUTPUT_BYTES) {
      parsed.messages.push('Output was cut off at 8 MB. Add a LIMIT to see a smaller result.')
    } else {
      throw new DatabaseError(describeFailure(connection, message), 400, 'query_failed')
    }
  }

  return { ...parsed, messages: [...parsed.messages, ...(message ? [message] : [])], durationMs, readOnly: options.readOnly }
}

function describeFailure(connection: DatabaseConnection, message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('read-only transaction') || lower.includes('read only transaction') || lower.includes('readonly database')) {
    return `${message}\n\nThe console is in read-only mode. Turn on "Allow writes" to change data.`
  }
  if (connection.access === 'docker' && lower.includes('no such container')) {
    return `No container named "${connection.container}" is running on this server.`
  }
  if (lower.includes('permission denied') && lower.includes('docker.sock')) {
    return 'The SSH user cannot use Docker. Add it to the docker group, or allow passwordless sudo for docker.'
  }
  return message || 'The query failed without an error message.'
}

/* ------------------------------------------------------------------ */
/* Tables and rows                                                     */
/* ------------------------------------------------------------------ */

function quoteIdent(engine: DatabaseConnection['engine'], name: string): string {
  if (engine === 'mysql') return `\`${name.replace(/`/g, '``')}\``
  return `"${name.replace(/"/g, '""')}"`
}

function tablesQuery(engine: DatabaseConnection['engine']): string {
  if (engine === 'postgres') {
    return `select c.table_schema, c.table_name, t.table_type, c.column_name, c.data_type,
  coalesce((select greatest(cl.reltuples, 0)::bigint from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
            where n.nspname = c.table_schema and cl.relname = c.table_name), 0) as estimate
from information_schema.columns c
join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
where c.table_schema not in ('pg_catalog', 'information_schema') and c.table_schema not like 'pg_toast%'
order by c.table_schema, c.table_name, c.ordinal_position`
  }
  if (engine === 'mysql') {
    return `select c.table_schema, c.table_name, t.table_type, c.column_name, c.column_type, coalesce(t.table_rows, 0)
from information_schema.columns c
join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
where c.table_schema = database()
order by c.table_name, c.ordinal_position`
  }
  return `select 'main', m.name, m.type, p.name, p.type, null
from sqlite_master m join pragma_table_info(m.name) p
where m.type in ('table', 'view') and m.name not like 'sqlite_%'
order by m.name, p.cid`
}

export type TableSummary = DatabaseTable & { rowEstimate?: number }

export async function listTables(server: Server, connection: DatabaseConnection): Promise<TableSummary[]> {
  const result = await runQuery(server, connection, tablesQuery(connection.engine), { readOnly: true })
  const rows = result.results[0]?.rows ?? []
  const tables = new Map<string, TableSummary>()
  for (const [schema, name, type, column, columnType, estimate] of rows) {
    const key = `${schema}.${name}`
    let table = tables.get(key)
    if (!table) {
      table = {
        schema: schema ?? '',
        name: name ?? '',
        kind: /view/i.test(type ?? '') ? 'view' : 'table',
        columns: [],
        rowEstimate: estimate === null || estimate === undefined ? undefined : Number(estimate),
      }
      tables.set(key, table)
    }
    table.columns.push({ name: column ?? '', type: columnType ?? '' })
  }
  return [...tables.values()]
}

export interface TablePage {
  columns: string[]
  rows: (string | null)[][]
  page: number
  pageSize: number
  /** Exact row count of the table */
  total: number
  durationMs: number
}

export async function browseTable(
  server: Server,
  connection: DatabaseConnection,
  options: { schema: string; table: string; page: number; pageSize: number; orderBy?: string; desc?: boolean }
): Promise<TablePage> {
  const engine = connection.engine
  const pageSize = Math.min(Math.max(Math.floor(options.pageSize) || 50, 1), 500)
  const page = Math.max(Math.floor(options.page) || 1, 1)
  const target =
    engine === 'postgres' && options.schema
      ? `${quoteIdent(engine, options.schema)}.${quoteIdent(engine, options.table)}`
      : quoteIdent(engine, options.table)
  const order = options.orderBy ? ` order by ${quoteIdent(engine, options.orderBy)} ${options.desc ? 'desc' : 'asc'}` : ''

  const sql = [
    `select count(*) as total from ${target}`,
    `select * from ${target}${order} limit ${pageSize} offset ${(page - 1) * pageSize}`,
  ].join(';\n')

  const result = await runQuery(server, connection, `${sql};`, { readOnly: true })
  const [countSet, rowSet] = result.results
  const total = Number(countSet?.rows[0]?.[0] ?? 0)
  return {
    columns: rowSet?.columns ?? [],
    rows: rowSet?.rows ?? [],
    page,
    pageSize,
    total,
    durationMs: result.durationMs,
  }
}

/* ------------------------------------------------------------------ */
/* Detection                                                           */
/* ------------------------------------------------------------------ */

const DETECT_SCRIPT = [
  'if command -v docker >/dev/null 2>&1; then D=docker; elif sudo -n docker version >/dev/null 2>&1; then D="sudo -n docker"; else exit 0; fi',
  `for c in $($D ps --format '{{.Names}}'); do`,
  `  $D inspect --format '{{.Name}}|{{.Config.Image}}|{{range .Config.Env}}{{println .}}{{end}}' "$c" | grep -E '^/|^(POSTGRES_USER|POSTGRES_DB|MYSQL_USER|MYSQL_DATABASE|MARIADB_USER|MARIADB_DATABASE)='`,
  '  echo "__END__"',
  'done',
].join('\n')

/** Find database containers running on a server. Passwords are never read. */
export async function detectDatabases(server: Server): Promise<DetectedDatabase[]> {
  const { stdout } = await withSsh(server, (ssh) => ssh.execCommand(DETECT_SCRIPT))
  const found: DetectedDatabase[] = []
  for (const block of stdout.split('__END__')) {
    const lines = block.trim().split('\n').filter(Boolean)
    const head = lines.shift()
    if (!head) continue
    const [rawName, image] = head.split('|')
    const env = Object.fromEntries(lines.map((line) => line.split(/=(.*)/s).slice(0, 2)))
    const container = rawName.replace(/^\//, '')
    const imageName = (image ?? '').toLowerCase()
    if (/postgres|postgis|timescale|supabase\/postgres/.test(imageName)) {
      found.push({ container, image, engine: 'postgres', user: env.POSTGRES_USER || 'postgres', database: env.POSTGRES_DB || env.POSTGRES_USER || 'postgres' })
    } else if (/mysql|mariadb|percona/.test(imageName)) {
      found.push({
        container,
        image,
        engine: 'mysql',
        user: env.MYSQL_USER || env.MARIADB_USER || 'root',
        database: env.MYSQL_DATABASE || env.MARIADB_DATABASE || undefined,
      })
    }
  }
  return found
}
