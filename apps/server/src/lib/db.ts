/**
 * Launchpad DB Layer
 * lowdb JSON store — sensitive fields encrypted via crypto.ts
 * Fully wired in Phase 2 (Auth) + Phase 3 (Config)
 */
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join } from 'path'
import type {
  ActivityEvent,
  AuthConfig,
  AuthSession,
  FileRevision,
  Server,
  Project,
  DeployRecord,
  NotificationSettings,
  RateLimitState,
  BackupSettings,
  DatabaseConnection,
} from '@launchpad/shared'

export interface DbSchema {
  auth: AuthConfig | null
  sessions: Record<string, AuthSession>
  rateLimit: RateLimitState
  servers: Server[]
  projects: Project[]
  deployHistory: DeployRecord[]
  notifications: NotificationSettings
  activity: ActivityEvent[]
  fileHistory: FileRevision[]
  backupSettings: BackupSettings
  databases: DatabaseConnection[]
}

export const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), 'launchpad.db.json')

const defaultData: DbSchema = {
  auth: null,
  sessions: {},
  rateLimit: { attempts: 0 },
  servers: [],
  projects: [],
  deployHistory: [],
  notifications: {
    email: null,
    globalWebhooks: [],
  },
  activity: [],
  fileHistory: [],
  backupSettings: { autoEnabled: true, retainDaily: 14 },
  databases: [],
}

let _db: Low<DbSchema> | null = null

export async function getDb(): Promise<Low<DbSchema>> {
  if (_db) return _db

  const adapter = new JSONFile<DbSchema>(DB_PATH)
  _db = new Low<DbSchema>(adapter, defaultData)
  await _db.read()

  // Merge defaults for any missing keys (safe upgrades)
  _db.data = { ...defaultData, ..._db.data }

  return _db
}

export async function saveDb(): Promise<void> {
  const db = await getDb()
  await db.write()
}

/** Replace everything in the store (used by backup restore), filling in any missing keys. */
export async function replaceDb(data: Partial<DbSchema>): Promise<void> {
  const db = await getDb()
  db.data = { ...structuredClone(defaultData), ...data }
  await db.write()
}
