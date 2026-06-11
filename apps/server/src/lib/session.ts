/**
 * Launchpad Session Layer
 * Signed session tokens stored in httpOnly cookies.
 * Sessions are persisted in the DB so restarts do not immediately sign users out.
 */
import { randomBytes, createHmac, timingSafeEqual } from 'crypto'
import { getDb, saveDb } from './db'
import type { AuthSession } from '@launchpad/shared'

const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours
const SESSION_COOKIE = 'lp_session'
const SIGNING_SECRET = process.env.SESSION_SECRET ?? randomBytes(32).toString('hex')

// ─── Token helpers ────────────────────────────────────────────────────────────

function sign(id: string): string {
  const sig = createHmac('sha256', SIGNING_SECRET).update(id).digest('base64url')
  return `${id}.${sig}`
}

function verify(token: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const id = token.slice(0, dot)
  const expected = Buffer.from(sign(id).slice(dot + 1), 'base64url')
  const actual = Buffer.from(token.slice(dot + 1), 'base64url')
  if (expected.length !== actual.length) return null
  if (!timingSafeEqual(expected, actual)) return null
  return id
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createSession(ttlMs = DEFAULT_SESSION_TTL_MS): Promise<string> {
  const id = randomBytes(32).toString('hex')
  const now = new Date()
  const session: AuthSession = {
    id,
    userId: 'launchpad-user',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  }

  const db = await getDb()
  db.data.sessions[id] = session
  await saveDb()

  return sign(id)
}

export async function validateSession(token: string): Promise<boolean> {
  const id = verify(token)
  if (!id) return false
  const db = await getDb()
  const session = db.data.sessions[id]
  if (!session) return false

  if (Date.now() > new Date(session.expiresAt).getTime()) {
    delete db.data.sessions[id]
    await saveDb()
    return false
  }

  return true
}

export async function elevateSession(token: string, windowMs: number): Promise<string | null> {
  const id = verify(token)
  if (!id) return null

  const db = await getDb()
  const session = db.data.sessions[id]
  if (!session) return null

  const elevatedUntil = new Date(Date.now() + windowMs).toISOString()
  session.elevatedUntil = elevatedUntil
  await saveDb()
  return elevatedUntil
}

export async function hasElevatedSession(token: string): Promise<boolean> {
  const id = verify(token)
  if (!id) return false

  const db = await getDb()
  const session = db.data.sessions[id]
  if (!session?.elevatedUntil) return false

  return Date.now() <= new Date(session.elevatedUntil).getTime()
}

export async function destroySession(token: string): Promise<void> {
  const id = verify(token)
  if (!id) return

  const db = await getDb()
  delete db.data.sessions[id]
  await saveDb()
}

export async function purgeExpired(): Promise<void> {
  const now = Date.now()
  const db = await getDb()
  let changed = false

  for (const [id, session] of Object.entries(db.data.sessions)) {
    if (now > new Date(session.expiresAt).getTime()) {
      delete db.data.sessions[id]
      changed = true
    }
  }

  if (changed) {
    await saveDb()
  }
}

export { SESSION_COOKIE, DEFAULT_SESSION_TTL_MS }
