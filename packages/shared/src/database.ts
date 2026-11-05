export type DatabaseEngine = 'postgres' | 'mysql' | 'sqlite'

/**
 * How Optizen reaches the database from the server it lives on:
 * - docker: `docker exec` into the container and use the client inside it
 * - host: use the client installed on the server (psql / mysql / sqlite3)
 */
export type DatabaseAccess = 'docker' | 'host'

export interface DatabaseConnection {
  id: string
  serverId: string
  name: string
  engine: DatabaseEngine
  access: DatabaseAccess
  /** Container name or id (access = docker) */
  container?: string
  /** TCP host for postgres/mysql. Empty means the local socket. */
  host?: string
  port?: number
  user?: string
  /** Stored encrypted; API responses omit it and set hasPassword instead */
  password?: string
  hasPassword?: boolean
  /** Database name for postgres/mysql, file path for sqlite */
  database?: string
  createdAt: string
  updatedAt: string
}

export interface DatabaseConnectionInput {
  serverId: string
  name: string
  engine: DatabaseEngine
  access: DatabaseAccess
  container?: string
  host?: string
  port?: number
  user?: string
  /** Plaintext on the way in. Omit to keep the stored one. */
  password?: string
  clearPassword?: boolean
  database?: string
}

export interface DatabaseResultSet {
  columns: string[]
  /** Every value as text; null stays null */
  rows: (string | null)[][]
  /** Rows the statement returned, which can exceed rows.length when truncated */
  rowCount: number
  truncated: boolean
}

export interface DatabaseQueryResult {
  results: DatabaseResultSet[]
  /** Command tags and notices, e.g. "UPDATE 3" */
  messages: string[]
  durationMs: number
  readOnly: boolean
}

export interface DatabaseColumn {
  name: string
  type: string
}

export interface DatabaseTable {
  schema: string
  name: string
  kind: 'table' | 'view'
  columns: DatabaseColumn[]
}

export interface DetectedDatabase {
  container: string
  image: string
  engine: DatabaseEngine
  user?: string
  database?: string
}

/* ------------------------------------------------------------------ */
/* SQL statement splitting, shared by the API (read-only guard) and the */
/* console (to warn before a write runs).                               */
/* ------------------------------------------------------------------ */

/** Statements that only read. Anything else counts as a write. */
const READ_KEYWORDS = new Set(['select', 'show', 'explain', 'describe', 'desc', 'with', 'values', 'table'])

/**
 * Split a script into statements on top-level semicolons, skipping over strings,
 * quoted identifiers, comments and Postgres dollar-quoted bodies. Comments are dropped.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let i = 0

  while (i < sql.length) {
    const ch = sql[i]
    const next = sql[i + 1]

    if (ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i)
      i = end === -1 ? sql.length : end
      continue
    }
    if (ch === '#' && current.trim() === '' ) {
      // MySQL line comment at the start of a statement
      const end = sql.indexOf('\n', i)
      i = end === -1 ? sql.length : end
      continue
    }
    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2)
      i = end === -1 ? sql.length : end + 2
      current += ' '
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === '\\' && ch === "'") { j += 2; continue }
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) { j += 2; continue }
          break
        }
        j += 1
      }
      current += sql.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (ch === '$') {
      const tag = /^\$[A-Za-z_]?[A-Za-z0-9_]*\$/.exec(sql.slice(i))?.[0]
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length)
        const stop = end === -1 ? sql.length : end + tag.length
        current += sql.slice(i, stop)
        i = stop
        continue
      }
    }
    if (ch === ';') {
      if (current.trim()) statements.push(current.trim())
      current = ''
      i += 1
      continue
    }
    current += ch
    i += 1
  }

  if (current.trim()) statements.push(current.trim())
  return statements
}

export function sqlLeadingKeyword(statement: string): string {
  return /^[\s(]*([A-Za-z]+)/.exec(statement)?.[1]?.toLowerCase() ?? ''
}

/** True when every statement in the script only reads. An empty script is not read-only. */
export function isReadOnlySql(sql: string): boolean {
  const statements = splitSqlStatements(sql)
  return statements.length > 0 && statements.every((statement) => READ_KEYWORDS.has(sqlLeadingKeyword(statement)))
}

/** The script with string literals, quoted identifiers and comments blanked out (same length). */
export function maskSqlLiterals(sql: string): string {
  let out = ''
  let i = 0
  const blank = (text: string) => text.replace(/[^\n]/g, ' ')
  while (i < sql.length) {
    const ch = sql[i]
    const next = sql[i + 1]
    let end = -1
    if (ch === '-' && next === '-') {
      end = sql.indexOf('\n', i)
      end = end === -1 ? sql.length : end
    } else if (ch === '/' && next === '*') {
      end = sql.indexOf('*/', i + 2)
      end = end === -1 ? sql.length : end + 2
    } else if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === '\\' && ch === "'") { j += 2; continue }
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) { j += 2; continue }
          break
        }
        j += 1
      }
      end = Math.min(j + 1, sql.length)
    } else if (ch === '$') {
      const tag = /^\$[A-Za-z_]?[A-Za-z0-9_]*\$/.exec(sql.slice(i))?.[0]
      if (tag) {
        const close = sql.indexOf(tag, i + tag.length)
        end = close === -1 ? sql.length : close + tag.length
      }
    }
    if (end === -1) {
      out += ch
      i += 1
    } else {
      out += blank(sql.slice(i, end))
      i = end
    }
  }
  return out
}

const MYSQL_CLIENT_COMMANDS = new Set(['system', 'source', 'pager', 'nopager', 'tee', 'notee', 'connect', 'edit', 'delimiter'])

/**
 * Client-side commands (psql backslash commands, mysql "system"/"source", sqlite dot-commands)
 * can run shell commands or read files on the server, so the console refuses them.
 * Returns the offending command, or null.
 */
export function findClientCommand(engine: DatabaseEngine, sql: string): string | null {
  const masked = maskSqlLiterals(sql)
  if (engine !== 'sqlite') {
    const slash = masked.indexOf('\\')
    if (slash !== -1) return masked.slice(slash, slash + 12).split(/\s/)[0]
  }
  for (const line of masked.split('\n')) {
    const trimmed = line.trim()
    if (engine === 'sqlite' && trimmed.startsWith('.')) return trimmed.split(/\s/)[0]
    if (engine === 'mysql') {
      const word = /^([A-Za-z]+)/.exec(trimmed)?.[1]?.toLowerCase()
      if (word && MYSQL_CLIENT_COMMANDS.has(word)) return word
    }
  }
  return null
}
