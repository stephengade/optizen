/**
 * Launchpad Auth Routes
 *
 * POST /auth/setup   — first-run master password setup
 * POST /auth/login   — authenticate with master password
 * POST /auth/logout  — destroy session
 * GET  /auth/status  — check if setup complete + session valid
 */
import { Elysia, t } from 'elysia'
import { randomBytes, createHash, timingSafeEqual } from 'crypto'
import { getDb, saveDb } from '../lib/db'
import { clearKey, deriveKey, hasKey, setKey, generateSalt } from '../lib/crypto'
import { createSession, validateSession, destroySession, SESSION_COOKIE, SESSION_TTL_MS } from '../lib/session'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '../lib/rateLimit'

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex')
}

const isProduction = process.env.NODE_ENV === 'production'

export const authRoutes = new Elysia({ prefix: '/auth' })

  // ── GET /auth/status ──────────────────────────────────────────────────────
  .get('/status', async ({ cookie }) => {
    const db = await getDb()
    const isSetup = db.data.auth?.isSetup ?? false
    if (!isSetup) return { isSetup: false, authenticated: false }

    const token = cookie[SESSION_COOKIE]?.value
    const authenticated = typeof token === 'string' ? (await validateSession(token)) && hasKey() : false
    return { isSetup, authenticated }
  })

  // ── POST /auth/setup ──────────────────────────────────────────────────────
  .post(
    '/setup',
    async ({ body, cookie, set }) => {
      const db = await getDb()

      if (db.data.auth?.isSetup) {
        set.status = 409
        return { success: false, error: 'Launchpad is already set up' }
      }

      const { password } = body
      if (password.length < 12) {
        set.status = 400
        return { success: false, error: 'Password must be at least 12 characters' }
      }

      const cryptoSalt = generateSalt()
      const hashSalt = randomBytes(16).toString('hex')
      const key = deriveKey(password, cryptoSalt)
      setKey(key)

      db.data.auth = {
        passwordHash: hashPassword(password, hashSalt),
        salt: JSON.stringify({ crypto: cryptoSalt.toString('hex'), hash: hashSalt }),
        isSetup: true,
        totpEnabled: false,
      }
      await saveDb()

      const token = await createSession()
      const sessionCookie = cookie[SESSION_COOKIE]
      sessionCookie.value = token
      sessionCookie.httpOnly = true
      sessionCookie.secure = isProduction
      sessionCookie.sameSite = 'strict'
      sessionCookie.maxAge = SESSION_TTL_MS / 1000
      sessionCookie.path = '/'

      return { success: true }
    },
    { body: t.Object({ password: t.String() }) }
  )

  // ── POST /auth/login ──────────────────────────────────────────────────────
  .post(
    '/login',
    async ({ body, cookie, set }) => {
      const db = await getDb()

      if (!db.data.auth?.isSetup) {
        set.status = 400
        return { success: false, error: 'Launchpad is not set up yet' }
      }

      const limit = await checkRateLimit()
      if (!limit.allowed) {
        set.status = 429
        const until = limit.lockedUntil
          ? `Try again after ${limit.lockedUntil.toLocaleTimeString()}`
          : 'Try again later'
        return { success: false, error: `Too many failed attempts. ${until}` }
      }

      const { password } = body
      const auth = db.data.auth
      const salts = JSON.parse(auth.salt)

      const expected = Buffer.from(auth.passwordHash, 'hex')
      const actual = Buffer.from(hashPassword(password, salts.hash), 'hex')

      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        const result = await recordFailedAttempt()
        set.status = 401
        const msg = result.attemptsRemaining > 0
          ? `Incorrect password. ${result.attemptsRemaining} attempt${result.attemptsRemaining === 1 ? '' : 's'} remaining`
          : `Too many failed attempts. Account locked for 15 minutes`
        return { success: false, error: msg }
      }

      const cryptoSalt = Buffer.from(salts.crypto, 'hex')
      setKey(deriveKey(password, cryptoSalt))
      await resetRateLimit()

      const token = await createSession()
      const sessionCookie = cookie[SESSION_COOKIE]
      sessionCookie.value = token
      sessionCookie.httpOnly = true
      sessionCookie.secure = isProduction
      sessionCookie.sameSite = 'strict'
      sessionCookie.maxAge = SESSION_TTL_MS / 1000
      sessionCookie.path = '/'

      return { success: true }
    },
    { body: t.Object({ password: t.String() }) }
  )

  // ── POST /auth/logout ─────────────────────────────────────────────────────
  .post('/logout', async ({ cookie, set }) => {
    const token = cookie[SESSION_COOKIE]?.value
    if (typeof token === 'string') await destroySession(token)
    clearKey()
    cookie[SESSION_COOKIE].value = ''
    cookie[SESSION_COOKIE].maxAge = 0
    set.status = 204
    return null
  })
