/**
 * Launchpad Auth Middleware
 * Applied to all routes except /auth/* and /health.
 */
import { Elysia } from 'elysia'
import { validateSession, SESSION_COOKIE } from './session'

export const authMiddleware = new Elysia({ name: 'auth-middleware' })
  .derive({ as: 'global' }, ({ cookie, set, request }) => {
    return {
      requireAuth: (): void => {
        const url = new URL(request.url)
        if (url.pathname.startsWith('/auth') || url.pathname === '/health') return

        const token = cookie[SESSION_COOKIE]?.value
        if (typeof token !== 'string' || !validateSession(token)) {
          set.status = 401
          throw new Error('Unauthorized')
        }
      },
    }
  })
