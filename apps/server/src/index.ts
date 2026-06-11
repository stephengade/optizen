import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { authRoutes } from './routes/auth'
import { authMiddleware } from './lib/authMiddleware'
import { purgeExpired } from './lib/session'
import { serverRoutes } from './routes/servers'
import { projectRoutes } from './routes/projects'

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000'

// Purge expired sessions every hour
setInterval(purgeExpired, 60 * 60 * 1000)

const app = new Elysia()
  .use(
    cors({
      origin: WEB_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )
  .use(authMiddleware)

  // Health check (no auth required)
  .get('/health', () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }))

  // Auth routes (no session guard — handles its own logic)
  .use(authRoutes)
  .use(serverRoutes)
  .use(projectRoutes)

  // Future routes — each will use requireAuth() at the top of their handlers:
  // .use(deployRoutes)    — Phase 4
  // .use(webhookRoutes)   — Phase 5
  // .use(envRoutes)       — Phase 6
  // .use(imageRoutes)     — Phase 7
  // .use(proxyRoutes)     — Phase 8
  // .use(notificationRoutes) — Phase 9

  .listen(PORT)

console.log(`🚀 Launchpad server running at http://localhost:${PORT}`)

export type App = typeof app
