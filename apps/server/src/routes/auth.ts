/**
 * Launchpad Auth Routes
 *
 * POST /auth/setup   — first-run master password setup
 * POST /auth/login   — authenticate with master password
 * POST /auth/logout  — destroy session
 * GET  /auth/status  — check if setup complete + session valid
 */
import { Elysia, t } from 'elysia'
import { recordActivity } from '../lib/activity'
import { getDb, saveDb } from '../lib/db'
import { clearKey, deriveKey, hasKey, setKey, generateSalt } from '../lib/crypto'
import { createSession, destroySession, elevateSession, SESSION_COOKIE, validateSession } from '../lib/session'
import { checkRateLimit, clientKey, recordFailedAttempt, resetRateLimit, type RateLimitResult } from '../lib/rateLimit'
import { clampSecuritySettings, getSecuritySettings } from '../lib/securitySettings'
import { hashPassword, isLegacyHash, verifyPassword } from '../lib/password'
import { clearSetupCode, verifySetupCode } from '../lib/setupCode'

type RequestIp = { requestIP(request: Request): { address: string } | null } | null

function lockedMessage(limit: RateLimitResult) {
  // Minutes, not a clock time: the server's timezone is usually not the visitor's.
  const minutes = limit.lockedUntil ? Math.max(1, Math.ceil((limit.lockedUntil.getTime() - Date.now()) / 60_000)) : 0
  const until = minutes ? `Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` : 'Try again later.'
  return `Too many failed attempts from your network. ${until}`
}

function readSalts(salt: string): { crypto: string; hash?: string } {
  return JSON.parse(salt)
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
    async ({ body, cookie, set, request, server }) => {
      const db = await getDb()

      if (db.data.auth?.isSetup) {
        set.status = 409
        return { success: false, error: 'Launchpad is already set up' }
      }

      const ip = `setup:${clientKey(request, (server as RequestIp)?.requestIP(request)?.address)}`
      const limit = checkRateLimit(ip)
      if (!limit.allowed) {
        set.status = 429
        return { success: false, error: lockedMessage(limit) }
      }

      if (!verifySetupCode(body.setupCode ?? '')) {
        const result = recordFailedAttempt(ip)
        set.status = 403
        return {
          success: false,
          error: result.allowed
            ? 'Setup code is wrong. Find it in the server log (docker compose logs server).'
            : lockedMessage(result),
        }
      }

      const { password } = body
      if (password.length < 12) {
        set.status = 400
        return { success: false, error: 'Password must be at least 12 characters' }
      }

      const cryptoSalt = generateSalt()
      const passwordHash = await hashPassword(password)
      // Another request may have finished setup while this one was hashing.
      if (db.data.auth?.isSetup) {
        set.status = 409
        return { success: false, error: 'Launchpad is already set up' }
      }
      setKey(deriveKey(password, cryptoSalt))
      clearSetupCode()
      resetRateLimit(ip)

      db.data.auth = {
        passwordHash,
        salt: JSON.stringify({ crypto: cryptoSalt.toString('hex') }),
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
    { body: t.Object({ password: t.String(), setupCode: t.Optional(t.String()) }) }
  )

  // ── POST /auth/login ──────────────────────────────────────────────────────
  .post(
    '/login',
    async ({ body, cookie, set, request, server }) => {
      const db = await getDb()

      if (!db.data.auth?.isSetup) {
        set.status = 400
        return { success: false, error: 'Launchpad is not set up yet' }
      }

      const ip = clientKey(request, (server as RequestIp)?.requestIP(request)?.address)
      const limit = checkRateLimit(ip)
      if (!limit.allowed) {
        set.status = 429
        return { success: false, error: lockedMessage(limit) }
      }

      const { password } = body
      const auth = db.data.auth
      const salts = readSalts(auth.salt)

      if (!(await verifyPassword(password, auth.passwordHash, salts.hash))) {
        const result = recordFailedAttempt(ip)
        set.status = 401
        const msg = result.allowed
          ? `Incorrect password. ${result.attemptsRemaining} attempt${result.attemptsRemaining === 1 ? '' : 's'} remaining`
          : lockedMessage(result)
        return { success: false, error: msg }
      }

      const cryptoSalt = Buffer.from(salts.crypto, 'hex')
      setKey(deriveKey(password, cryptoSalt))
      resetRateLimit(ip)

      // Upgrade hashes from older versions (single SHA-256) to scrypt. The encryption key is
      // derived separately from salts.crypto, so stored secrets are unaffected.
      if (isLegacyHash(auth.passwordHash)) {
        db.data.auth = {
          ...auth,
          passwordHash: await hashPassword(password),
          salt: JSON.stringify({ crypto: salts.crypto }),
        }
        await saveDb()
      }

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
    async ({ body, cookie, set, request, server }) => {
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

      const ip = `reauth:${clientKey(request, (server as RequestIp)?.requestIP(request)?.address)}`
      const limit = checkRateLimit(ip)
      if (!limit.allowed) {
        set.status = 429
        return { success: false, error: lockedMessage(limit) }
      }

      const salts = readSalts(db.data.auth.salt)
      if (!(await verifyPassword(body.password, db.data.auth.passwordHash, salts.hash))) {
        recordFailedAttempt(ip)
        set.status = 401
        return { success: false, error: 'Re-authentication failed. Password did not match.' }
      }
      resetRateLimit(ip)

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
