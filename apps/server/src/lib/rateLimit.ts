/**
 * Launchpad Rate Limiter
 * Tracks failed auth attempts and enforces lockout periods.
 * State persisted in DB so lockout survives server restarts.
 */
import { getDb, saveDb } from './db'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

export interface RateLimitResult {
  allowed: boolean
  attemptsRemaining: number
  lockedUntil?: Date
}

export async function checkRateLimit(): Promise<RateLimitResult> {
  const db = await getDb()
  const state = db.data.rateLimit

  if (state.lockedUntil) {
    const lockedUntil = new Date(state.lockedUntil)
    if (new Date() < lockedUntil) {
      return {
        allowed: false,
        attemptsRemaining: 0,
        lockedUntil,
      }
    }
    // Lockout expired — reset
    db.data.rateLimit = { attempts: 0 }
    await saveDb()
  }

  return {
    allowed: true,
    attemptsRemaining: MAX_ATTEMPTS - state.attempts,
  }
}

export async function recordFailedAttempt(): Promise<RateLimitResult> {
  const db = await getDb()
  const attempts = (db.data.rateLimit.attempts ?? 0) + 1

  if (attempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MS)
    db.data.rateLimit = { attempts, lockedUntil: lockedUntil.toISOString() }
    await saveDb()
    return { allowed: false, attemptsRemaining: 0, lockedUntil }
  }

  db.data.rateLimit = { attempts }
  await saveDb()
  return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - attempts }
}

export async function resetRateLimit(): Promise<void> {
  const db = await getDb()
  db.data.rateLimit = { attempts: 0 }
  await saveDb()
}
