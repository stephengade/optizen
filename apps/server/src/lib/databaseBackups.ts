/**
 * Database backups: dumps made with the engine's own tool (pg_dump, mysqldump / mariadb-dump,
 * sqlite3 .dump), gzipped, and kept on the database's own server under
 * ~/optizen-backups/databases/<connection id>/.
 *
 * The dump runs where the client runs for the console: on the host, or inside the database's
 * container. The password travels over stdin, never on a command line. Files can be downloaded
 * through Optizen and restored with psql / mysql / sqlite3.
 */
import { randomUUID } from 'crypto'
import { readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { NodeSSH } from 'node-ssh'
import type { DatabaseBackupFile, DatabaseBackupList, DatabaseConnection, Server } from '@launchpad/shared'
import { decrypt } from './crypto'
import { DatabaseError, shellEscape } from './databases'
import { getConnection } from './ssh'

/** Older dumps beyond this many are removed after each new one. */
export const KEEP_DATABASE_BACKUPS = 20

const NAME_PATTERN = /^[a-z0-9-]{1,40}-\d{8}T\d{6}Z\.sql\.gz$/
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/

export function isDatabaseBackupName(name: string) {
  return NAME_PATTERN.test(name)
}

export function backupNameFor(connection: Pick<DatabaseConnection, 'name'>, at = new Date()) {
  const slug =
    connection.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '') || 'db'
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return `${slug}-${stamp}.sql.gz`
}

function dirScript(connection: DatabaseConnection) {
  if (!ID_PATTERN.test(connection.id)) throw new DatabaseError('Invalid database id', 400)
  return `DIR="$HOME/optizen-backups/databases/${connection.id}"`
}

/** argv for the dump tool, plus the env var that carries the password. */
export function dumpInvocation(connection: DatabaseConnection): { candidates: string[]; args: string[]; passEnv?: string } {
  switch (connection.engine) {
    case 'postgres': {
      const args = ['--no-owner', '--no-privileges', '--clean', '--if-exists']
      if (connection.host) args.push('-h', connection.host)
      if (connection.port) args.push('-p', String(connection.port))
      args.push('-U', connection.user || 'postgres')
      args.push('-d', connection.database || connection.user || 'postgres')
      return { candidates: ['pg_dump'], args, passEnv: 'PGPASSWORD' }
    }
    case 'mysql': {
      const args = ['--single-transaction', '--quick', '--routines', '--triggers', '--no-tablespaces']
      if (connection.host) args.push('-h', connection.host, '--protocol=TCP')
      if (connection.port) args.push('-P', String(connection.port))
      args.push('-u', connection.user || 'root')
      if (connection.database) args.push('--databases', connection.database)
      else args.push('--all-databases')
      return { candidates: ['mariadb-dump', 'mysqldump'], args, passEnv: 'MYSQL_PWD' }
    }
    case 'sqlite':
      return { candidates: ['sqlite3'], args: [connection.database ?? '', '.dump'] }
  }
}

export function buildDumpScript(connection: DatabaseConnection, name: string): string {
  if (!isDatabaseBackupName(name)) throw new DatabaseError('Invalid backup name', 400)
  const { candidates, args, passEnv } = dumpInvocation(connection)
  const docker = connection.access === 'docker'
  const missing = docker
    ? `No ${candidates.join(' or ')} was found inside the container.`
    : `${candidates.join(' or ')} is not installed on this server. Install it, or connect through the database's Docker container.`
  const pick = `B=""; for c in ${candidates.join(' ')}; do if command -v "$c" >/dev/null 2>&1; then B="$c"; break; fi; done; if [ -z "$B" ]; then echo ${shellEscape(missing)} >&2; exit 127; fi; exec "$B" "$@"`
  const tool = `sh -c ${shellEscape(pick)} sh ${args.map(shellEscape).join(' ')}`

  const lines = ['IFS= read -r OPTZ_PW']
  if (passEnv) lines.push(`if [ -n "$OPTZ_PW" ]; then export ${passEnv}="$OPTZ_PW"; fi`)
  lines.push('unset OPTZ_PW', 'umask 077', dirScript(connection), 'mkdir -p "$DIR" || exit 1')

  let run = tool
  if (docker) {
    lines.push(
      'if command -v docker >/dev/null 2>&1 && docker ps -q >/dev/null 2>&1; then D=docker; elif sudo -n docker ps -q >/dev/null 2>&1; then D="sudo -n docker"; else echo "Docker is not available to the SSH user on this server." >&2; exit 127; fi'
    )
    run = `$D exec ${passEnv ? `-e ${passEnv} ` : ''}${shellEscape(connection.container ?? '')} ${tool}`
  }

  lines.push(
    `F="$DIR/${name}"`,
    'T="$F.partial"',
    // The pipe hides the dump's exit code, so it is written to a side file.
    `( ${run}; echo $? > "$T.status" ) | gzip -c > "$T"`,
    'S=$(cat "$T.status" 2>/dev/null); rm -f "$T.status"',
    'if [ "$S" = 0 ]; then mv "$T" "$F"; echo "__OPTZ_SIZE=$(wc -c < "$F")"; else rm -f "$T"; echo "__OPTZ_EXIT=$S" >&2; exit 1; fi',
    // Keep the newest dumps only.
    `ls -1t "$DIR"/*.sql.gz 2>/dev/null | tail -n +${KEEP_DATABASE_BACKUPS + 1} | while read -r old; do rm -f "$old"; done`
  )
  return lines.join('\n')
}

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

function cleanDumpError(stderr: string) {
  return stderr
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('__OPTZ_EXIT='))
    .join('\n')
    .trim()
}

export async function createDatabaseBackup(server: Server, connection: DatabaseConnection): Promise<DatabaseBackupFile> {
  const name = backupNameFor(connection)
  const script = buildDumpScript(connection, name)
  const password = connection.password ? decrypt(connection.password) : ''
  const result = await withSsh(server, (ssh) => ssh.execCommand(script, { stdin: `${password}\n` }))
  const size = /__OPTZ_SIZE=\s*(\d+)/.exec(result.stdout)?.[1]
  if (!size) {
    const message = cleanDumpError(result.stderr)
    if (message.toLowerCase().includes('docker.sock')) {
      throw new DatabaseError('The SSH user cannot use Docker. Add it to the docker group, or allow passwordless sudo for docker.', 400)
    }
    throw new DatabaseError(message || 'The backup failed without an error message.', 400, 'backup_failed')
  }
  return { name, sizeBytes: Number(size), createdAt: new Date().toISOString() }
}

export function parseBackupListing(stdout: string): DatabaseBackupList {
  let directory = ''
  const backups: DatabaseBackupFile[] = []
  for (const raw of stdout.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (line.startsWith('@@dir=')) {
      directory = line.slice('@@dir='.length)
      continue
    }
    const [name, size, mtime] = line.split('\t')
    if (!name || !isDatabaseBackupName(name)) continue
    backups.push({
      name,
      sizeBytes: Number(size) || 0,
      createdAt: new Date(Math.round(Number(mtime) * 1000) || 0).toISOString(),
    })
  }
  backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { directory, backups }
}

export async function listDatabaseBackups(server: Server, connection: DatabaseConnection): Promise<DatabaseBackupList> {
  const script = `${dirScript(connection)}; echo "@@dir=$DIR"; [ -d "$DIR" ] && find "$DIR" -maxdepth 1 -type f -name '*.sql.gz' -printf '%f\\t%s\\t%T@\\n'; true`
  const result = await withSsh(server, (ssh) => ssh.execCommand(script))
  return parseBackupListing(result.stdout)
}

export async function deleteDatabaseBackup(server: Server, connection: DatabaseConnection, name: string) {
  if (!isDatabaseBackupName(name)) throw new DatabaseError('Backup not found', 404)
  const result = await withSsh(server, (ssh) =>
    ssh.execCommand(`${dirScript(connection)}; [ -f "$DIR/${name}" ] || { echo missing; exit 1; }; rm -f "$DIR/${name}"`)
  )
  if (result.code !== 0) {
    throw new DatabaseError(result.stdout.includes('missing') ? 'Backup not found' : result.stderr || 'Failed to delete backup', result.stdout.includes('missing') ? 404 : 500)
  }
}

export async function readDatabaseBackup(server: Server, connection: DatabaseConnection, name: string): Promise<Buffer> {
  if (!isDatabaseBackupName(name)) throw new DatabaseError('Backup not found', 404)
  return withSsh(server, async (ssh) => {
    const home = await ssh.execCommand(`${dirScript(connection)}; [ -f "$DIR/${name}" ] && printf '%s' "$DIR"`)
    const dir = home.stdout.trim()
    if (!dir) throw new DatabaseError('Backup not found', 404)
    const local = join(tmpdir(), `optizen-dbdump-${randomUUID()}.gz`)
    try {
      await ssh.getFile(local, `${dir}/${name}`)
      return await readFile(local)
    } finally {
      await unlink(local).catch(() => undefined)
    }
  })
}
