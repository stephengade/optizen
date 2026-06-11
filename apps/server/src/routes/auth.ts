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
import { recordActivity } from '../lib/activity'
import { getDb, saveDb } from '../lib/db'
import { clearKey, deriveKey, hasKey, setKey, generateSalt } from '../lib/crypto'
import { createSession, destroySession, elevateSession, SESSION_COOKIE, validateSession } from '../lib/session'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '../lib/rateLimit'
import { clampSecuritySettings, getSecuritySettings } from '../lib/securitySettings'

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
    return { isSetup, authenticated, security: getSecuritySettings(db.data.auth) }
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
        ...getSecuritySettings(null),
      }
      await saveDb()

      const security = getSecuritySettings(db.data.auth)
      const sessionTtlMs = security.sessionDurationHours * 60 * 60 * 1000
      const token = await createSession(sessionTtlMs)
      const sessionCookie = cookie[SESSION_COOKIE]
      sessionCookie.value = token
      sessionCookie.httpOnly = true
      sessionCookie.secure = isProduction
      sessionCookie.sameSite = 'strict'
      sessionCookie.maxAge = sessionTtlMs / 1000
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

      const security = getSecuritySettings(db.data.auth)
      const sessionTtlMs = security.sessionDurationHours * 60 * 60 * 1000
      const token = await createSession(sessionTtlMs)
      const sessionCookie = cookie[SESSION_COOKIE]
      sessionCookie.value = token
      sessionCookie.httpOnly = true
      sessionCookie.secure = isProduction
      sessionCookie.sameSite = 'strict'
      sessionCookie.maxAge = sessionTtlMs / 1000
      sessionCookie.path = '/'

      return { success: true }
    },
    { body: t.Object({ password: t.String() }) }
  )
  .get('/settings', async ({ cookie, set }) => {
    const token = cookie[SESSION_COOKIE]?.value
    if (typeof token !== 'string' || !(await validateSession(token))) {
      set.status = 401
      return { message: 'Unauthorized' }
    }

    const db = await getDb()
    return getSecuritySettings(db.data.auth)
  })
  .put(
    '/settings',
    async ({ body, cookie, set }) => {
      const token = cookie[SESSION_COOKIE]?.value
      if (typeof token !== 'string' || !(await validateSession(token))) {
        set.status = 401
        return { message: 'Unauthorized' }
      }

      const db = await getDb()
      if (!db.data.auth) {
        set.status = 400
        return { message: 'Launchpad is not set up yet' }
      }

      const next = clampSecuritySettings(body)
      db.data.auth = {
        ...db.data.auth,
        ...next,
      }
      await saveDb()
      await recordActivity({
        serverId: 'system',
        type: 'security_settings_updated',
        status: 'info',
        title: 'Updated auth security settings',
        detail: `Session: ${next.sessionDurationHours}h, re-auth: ${next.requireReauthForDangerousActions ? 'on' : 'off'}, window: ${next.reauthWindowMinutes}m`,
      })
      return next
    },
    {
      body: t.Object({
        sessionDurationHours: t.Number(),
        requireReauthForDangerousActions: t.Boolean(),
        reauthWindowMinutes: t.Number(),
      }),
    }
  )
  .post(
    '/reauth',
    async ({ body, cookie, set }) => {
      const token = cookie[SESSION_COOKIE]?.value
      if (typeof token !== 'string' || !(await validateSession(token))) {
        set.status = 401
        return { success: false, error: 'Your session is no longer valid. Please sign in again.' }
      }

      const db = await getDb()
      if (!db.data.auth?.isSetup) {
        set.status = 400
        return { success: false, error: 'Launchpad is not set up yet' }
      }

      const salts = JSON.parse(db.data.auth.salt)
      const expected = Buffer.from(db.data.auth.passwordHash, 'hex')
      const actual = Buffer.from(hashPassword(body.password, salts.hash), 'hex')
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        set.status = 401
        return { success: false, error: 'Re-authentication failed. Password did not match.' }
      }

      const settings = getSecuritySettings(db.data.auth)
      const elevatedUntil = await elevateSession(token, settings.reauthWindowMinutes * 60 * 1000)
      await recordActivity({
        serverId: 'system',
        type: 'session_elevated',
        status: 'info',
        title: 'Session elevated for dangerous actions',
        detail: elevatedUntil ? `Elevated until ${elevatedUntil}` : 'Elevation granted.',
      })
      return { success: true, elevatedUntil }
    },
    { body: t.Object({ password: t.String() }) }
  )
  .get('/audit', async ({ cookie, set }) => {
    const token = cookie[SESSION_COOKIE]?.value
    if (typeof token !== 'string' || !(await validateSession(token))) {
      set.status = 401
      return { message: 'Unauthorized' }
    }

    const db = await getDb()
    return db.data.activity
      .filter((event) => event.serverId === 'system')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50)
  })
  .post(
    '/audit/reveal',
    async ({ body, cookie, set }) => {
      const token = cookie[SESSION_COOKIE]?.value
      if (typeof token !== 'string' || !(await validateSession(token))) {
        set.status = 401
        return { message: 'Unauthorized' }
      }

      await recordActivity({
        serverId: body.serverId || 'system',
        projectId: body.projectId || undefined,
        type: 'secret_revealed',
        status: 'warning',
        title: `Sensitive value revealed: ${body.label}`,
        detail: body.detail || 'Reveal action recorded from the web UI.',
      })
      return { success: true }
    },
    {
      body: t.Object({
        label: t.String(),
        detail: t.Optional(t.String()),
        serverId: t.Optional(t.String()),
        projectId: t.Optional(t.String()),
      }),
    }
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
