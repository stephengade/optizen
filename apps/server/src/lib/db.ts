/**
 * Launchpad DB Layer
 * lowdb JSON store — sensitive fields encrypted via crypto.ts
 * Fully wired in Phase 2 (Auth) + Phase 3 (Config)
 */
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join } from 'path'
import type {
  AuthConfig,
  Server,
  Project,
  DeployRecord,
  NotificationSettings,
  RateLimitState,
} from '@launchpad/shared'

export interface DbSchema {
  auth: AuthConfig | null
  rateLimit: RateLimitState
  servers: Server[]
  projects: Project[]
  deployHistory: DeployRecord[]
  notifications: NotificationSettings
}

const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), 'launchpad.db.json')

const defaultData: DbSchema = {
  auth: null,
  rateLimit: { attempts: 0 },
  servers: [],
  projects: [],
  deployHistory: [],
  notifications: {
    email: null,
    globalWebhooks: [],
  },
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
