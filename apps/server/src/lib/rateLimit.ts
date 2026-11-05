/**
 * Launchpad Rate Limiter
 *
 * Failed password attempts are counted per client IP, so a stranger guessing passwords locks out
 * only themselves, never the owner signing in from elsewhere. Kept in memory: an attacker cannot
 * restart the server, and the slow password hash already caps how fast anyone can guess.
 */

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes
// Forget an IP's failures after this long without new ones.
const WINDOW_MS = 15 * 60 * 1000
const MAX_TRACKED = 10_000

export interface RateLimitResult {
  allowed: boolean
  attemptsRemaining: number
  lockedUntil?: Date
}

interface Entry {
  attempts: number
  lastFailureAt: number
  lockedUntil?: number
}

const entries = new Map<string, Entry>()

function current(key: string, now = Date.now()): Entry | undefined {
  const entry = entries.get(key)
  if (!entry) return undefined
  const lockExpired = entry.lockedUntil !== undefined && now >= entry.lockedUntil
  const stale = entry.lockedUntil === undefined && now - entry.lastFailureAt > WINDOW_MS
  if (lockExpired || stale) {
    entries.delete(key)
    return undefined
  }
  return entry
}

function prune(now: number) {
  if (entries.size < MAX_TRACKED) return
  for (const key of entries.keys()) current(key, now)
  // Still full (a flood of distinct addresses): drop the oldest entries.
  for (const key of entries.keys()) {
    if (entries.size < MAX_TRACKED) break
    entries.delete(key)
  }
}

export function checkRateLimit(key: string): RateLimitResult {
  const entry = current(key)
  if (entry?.lockedUntil !== undefined) {
    return { allowed: false, attemptsRemaining: 0, lockedUntil: new Date(entry.lockedUntil) }
  }
  return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - (entry?.attempts ?? 0) }
}

export function recordFailedAttempt(key: string): RateLimitResult {
  const now = Date.now()
  prune(now)
  const attempts = (current(key, now)?.attempts ?? 0) + 1

  if (attempts >= MAX_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_MS
    entries.set(key, { attempts, lastFailureAt: now, lockedUntil })
    return { allowed: false, attemptsRemaining: 0, lockedUntil: new Date(lockedUntil) }
  }

  entries.set(key, { attempts, lastFailureAt: now })
  return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - attempts }
}

export function resetRateLimit(key: string): void {
  entries.delete(key)
}

/**
 * The visitor's IP. In the Docker deploy, Caddy replaces any client-sent X-Forwarded-For with the
 * real address and Next.js appends its own hop, so the first entry is the visitor. Without a proxy
 * in front, fall back to the socket address.
 */
export function clientKey(request: Request, socketIp?: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip')?.trim() || socketIp || 'unknown'
}
