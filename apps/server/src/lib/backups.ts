/**
 * Backups of the Optizen data file.
 *
 * A backup is the data store written out as JSON, in the same shape as launchpad.db.json, so it can
 * also be restored by hand (stop the server, copy it over the data file). Secrets inside it stay
 * encrypted with the master password, and sessions are left out.
 *
 * Files live in BACKUP_DIR (default: a "backups" folder next to the data file, ./data/backups with
 * Docker). Names are generated here and checked against a strict pattern, so a request can never
 * point outside that folder.
 */
import { chmod, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { BackupInfo, BackupKind, BackupSettings } from '@launchpad/shared'
import { DB_PATH, getDb, saveDb, type DbSchema } from './db'

export const BACKUP_DIR = process.env.BACKUP_DIR ?? join(dirname(DB_PATH), 'backups')

const NAME_PATTERN = /^optizen-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-(manual|auto|pre-restore|uploaded)\.json$/
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_RETAIN = 365
// Keep only the most recent safety copies taken before restores.
const KEEP_PRE_RESTORE = 5

export class BackupError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export function isBackupName(name: string): boolean {
  return NAME_PATTERN.test(name)
}

function parseName(name: string): { kind: BackupKind; createdAt: string } | null {
  const match = NAME_PATTERN.exec(name)
  if (!match) return null
  const [, date, h, m, s, ms, kind] = match
  return { kind: kind as BackupKind, createdAt: `${date}T${h}:${m}:${s}.${ms}Z` }
}

function nameFor(kind: BackupKind, at = new Date()): string {
  return `optizen-${at.toISOString().replace(/:/g, '-').replace('.', '-')}-${kind}.json`
}

function pathFor(name: string): string {
  if (!isBackupName(name)) throw new BackupError('Unknown backup', 404)
  return join(BACKUP_DIR, name)
}

/** What goes into a backup: everything except live sessions and login throttling. */
function snapshot(data: DbSchema): DbSchema {
  return { ...structuredClone(data), sessions: {}, rateLimit: { attempts: 0 } }
}

async function writeBackupFile(kind: BackupKind, content: string): Promise<BackupInfo> {
  await mkdir(BACKUP_DIR, { recursive: true })
  let at = new Date()
  // Two backups in the same millisecond would collide; nudge the timestamp.
  while (await exists(join(BACKUP_DIR, nameFor(kind, at)))) at = new Date(at.getTime() + 1)
  const name = nameFor(kind, at)
  const target = join(BACKUP_DIR, name)
  const temp = `${target}.tmp`
  await writeFile(temp, content, { mode: 0o600 })
  await rename(temp, target)
  await chmod(target, 0o600).catch(() => undefined)
  return { name, kind, createdAt: at.toISOString(), sizeBytes: Buffer.byteLength(content) }
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false)
}

export async function createBackup(kind: BackupKind): Promise<BackupInfo> {
  const db = await getDb()
  return writeBackupFile(kind, JSON.stringify(snapshot(db.data), null, 2))
}

export async function listBackups(): Promise<BackupInfo[]> {
  const names = await readdir(BACKUP_DIR).catch(() => [] as string[])
  const backups: BackupInfo[] = []
  for (const name of names) {
    const parsed = parseName(name)
    if (!parsed) continue
    const info = await stat(join(BACKUP_DIR, name)).catch(() => null)
    if (info) backups.push({ name, ...parsed, sizeBytes: info.size })
  }
  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function readBackup(name: string): Promise<string> {
  try {
    return await readFile(pathFor(name), 'utf-8')
  } catch (error) {
    if (error instanceof BackupError) throw error
    throw new BackupError('Backup not found', 404)
  }
}

export async function deleteBackup(name: string): Promise<void> {
  try {
    await unlink(pathFor(name))
  } catch (error) {
    if (error instanceof BackupError) throw error
    throw new BackupError('Backup not found', 404)
  }
}

/**
 * Parse and sanity-check backup content. Rejects anything that is not an Optizen data file with a
 * master password, so a restore can never leave the instance unclaimed or half-empty.
 */
export function parseBackup(content: string): DbSchema {
  let data: unknown
  try {
    data = JSON.parse(content)
  } catch {
    throw new BackupError('This file is not valid JSON.')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new BackupError('This file is not an Optizen backup.')
  }
  const record = data as Record<string, unknown>
  for (const key of ['servers', 'projects', 'deployHistory', 'activity'] as const) {
    if (key in record && !Array.isArray(record[key])) {
      throw new BackupError(`This file is not an Optizen backup ("${key}" is not a list).`)
    }
  }
  if (!Array.isArray(record.servers) || !Array.isArray(record.projects)) {
    throw new BackupError('This file is not an Optizen backup (no servers or projects).')
  }
  const auth = record.auth as Record<string, unknown> | null | undefined
  if (!auth || auth.isSetup !== true || typeof auth.passwordHash !== 'string' || typeof auth.salt !== 'string') {
    throw new BackupError('This backup has no master password, so it cannot be restored.')
  }
  try {
    const salts = JSON.parse(auth.salt) as { crypto?: unknown }
    if (typeof salts.crypto !== 'string') throw new Error('missing')
  } catch {
    throw new BackupError('This backup has a damaged master password record.')
  }
  return data as DbSchema
}

/** Store an uploaded backup file in the backup folder (validated first), ready to restore. */
export async function saveUploadedBackup(content: string): Promise<BackupInfo> {
  const data = parseBackup(content)
  return writeBackupFile('uploaded', JSON.stringify(snapshot(data), null, 2))
}

export function clampBackupSettings(input: Partial<BackupSettings>): BackupSettings {
  const retain = Math.round(Number(input.retainDaily))
  return {
    autoEnabled: Boolean(input.autoEnabled),
    retainDaily: Number.isFinite(retain) ? Math.min(MAX_RETAIN, Math.max(1, retain)) : 14,
  }
}

export async function getBackupSettings(): Promise<BackupSettings> {
  const db = await getDb()
  return clampBackupSettings(db.data.backupSettings ?? { autoEnabled: true, retainDaily: 14 })
}

export async function saveBackupSettings(input: Partial<BackupSettings>): Promise<BackupSettings> {
  const db = await getDb()
  db.data.backupSettings = clampBackupSettings(input)
  await saveDb()
  return db.data.backupSettings
}

/** Delete automatic backups beyond the retention count, and old pre-restore copies. */
export async function pruneBackups(retainDaily: number): Promise<string[]> {
  const backups = await listBackups()
  const doomed = [
    ...backups.filter((b) => b.kind === 'auto').slice(retainDaily),
    ...backups.filter((b) => b.kind === 'pre-restore').slice(KEEP_PRE_RESTORE),
  ]
  for (const backup of doomed) await deleteBackup(backup.name).catch(() => undefined)
  return doomed.map((b) => b.name)
}

/** Take the daily automatic backup if one is due. Safe to call often. */
export async function runScheduledBackup(now = Date.now()): Promise<BackupInfo | null> {
  const settings = await getBackupSettings()
  if (!settings.autoEnabled) return null
  const db = await getDb()
  // Nothing worth keeping before the instance is set up.
  if (!db.data.auth?.isSetup) return null

  const latest = (await listBackups()).find((b) => b.kind === 'auto')
  if (latest && now - new Date(latest.createdAt).getTime() < DAY_MS) return null

  const created = await createBackup('auto')
  await pruneBackups(settings.retainDaily)
  return created
}

export function startBackupScheduler(): void {
  const tick = () => {
    runScheduledBackup().catch((error) => console.error('Automatic backup failed:', error))
  }
  tick()
  setInterval(tick, 60 * 60 * 1000)
}
