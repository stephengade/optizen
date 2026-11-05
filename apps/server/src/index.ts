import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { authRoutes } from './routes/auth'
import { authMiddleware } from './lib/authMiddleware'
import { purgeExpired } from './lib/session'
import { getDb } from './lib/db'
import { printSetupCode } from './lib/setupCode'
import { assertSecureConfig } from './lib/startupChecks'
import { serverRoutes } from './routes/servers'
import { projectRoutes } from './routes/projects'
import { deployRoutes } from './routes/deploy'
import { webhookRoutes } from './routes/webhooks'
import { envRoutes } from './routes/env'
import { imageRoutes } from './routes/images'
import { proxyRoutes } from './routes/proxy'
import { notificationRoutes } from './routes/notifications'
import { fileRoutes } from './routes/files'
import { logRoutes } from './routes/logs'
import { memoryRoutes } from './routes/memory'
import { backupRoutes } from './routes/backups'
import { databaseRoutes } from './routes/databases'
import { startBackupScheduler } from './lib/backups'

assertSecureConfig()

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
  .use(deployRoutes)
  .use(webhookRoutes)
  .use(envRoutes)
  .use(imageRoutes)
  .use(proxyRoutes)
  .use(notificationRoutes)
  .use(fileRoutes)
  .use(logRoutes)
  .use(memoryRoutes)
  .use(backupRoutes)
  .use(databaseRoutes)

  // Future routes — each will use requireAuth() at the top of their handlers:

  .listen({
    port: PORT,
    // Storage audit and cleanup can take several minutes over slow SSH connections.
    // Bun caps idleTimeout at 255 seconds.
    idleTimeout: 255,
  })

console.log(`🚀 Launchpad server running at http://localhost:${PORT}`)

if (!(await getDb()).data.auth?.isSetup) printSetupCode()
startBackupScheduler()

export type App = typeof app
