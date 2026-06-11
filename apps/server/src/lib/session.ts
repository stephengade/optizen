/**
 * Launchpad Session Layer
 * Signed session tokens stored in httpOnly cookies.
 * Sessions are kept in-memory (Map) — no DB round-trip on every request.
 * On server restart sessions are invalidated (user must re-login).
 */
import { randomBytes, createHmac, timingSafeEqual } from 'crypto'

const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours
const SESSION_COOKIE = 'lp_session'
const SIGNING_SECRET = process.env.SESSION_SECRET ?? randomBytes(32).toString('hex')

interface Session {
  id: string
  createdAt: number
  expiresAt: number
}

// In-memory session store
const _sessions = new Map<string, Session>()

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

export function createSession(): string {
  const id = randomBytes(32).toString('hex')
  const now = Date.now()
  _sessions.set(id, { id, createdAt: now, expiresAt: now + SESSION_TTL_MS })
  return sign(id)
}

export function validateSession(token: string): boolean {
  const id = verify(token)
  if (!id) return false
  const session = _sessions.get(id)
  if (!session) return false
  if (Date.now() > session.expiresAt) {
    _sessions.delete(id)
    return false
  }
  return true
}

export function destroySession(token: string): void {
  const id = verify(token)
  if (id) _sessions.delete(id)
}

export function purgeExpired(): void {
  const now = Date.now()
  for (const [id, session] of _sessions) {
    if (now > session.expiresAt) _sessions.delete(id)
  }
}

export { SESSION_COOKIE, SESSION_TTL_MS }
