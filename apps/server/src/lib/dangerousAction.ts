import { hasElevatedSession, SESSION_COOKIE, validateSession } from './session'
import { getDb } from './db'
import { getSecuritySettings } from './securitySettings'

export async function requireDangerousActionAuth(context: {
  cookie: Record<string, { value?: string }>
  set: { status?: number | string }
}) {
  const token = context.cookie[SESSION_COOKIE]?.value
  if (typeof token !== 'string' || !(await validateSession(token))) {
    context.set.status = 401
    return {
      message: 'Your session is no longer valid. Please sign in again.',
      code: 'session_invalid',
    }
  }

  const db = await getDb()
  const settings = getSecuritySettings(db.data.auth)
  if (!settings.requireReauthForDangerousActions) {
    return null
  }

  const elevated = await hasElevatedSession(token)
  if (elevated) {
    return null
  }

  context.set.status = 403
  return {
    message: 'Re-authentication is required before this action can run.',
    code: 'reauth_required',
  }
}
