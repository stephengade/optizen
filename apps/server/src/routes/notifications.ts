import { Elysia, t } from 'elysia'
import type { GlobalWebhook, SmtpConfig } from '@launchpad/shared'
import { hasKey } from '../lib/crypto'
import { getDb, saveDb } from '../lib/db'
import {
  buildGlobalWebhook,
  prepareNotificationSettings,
  saveNotificationSettings,
  serializeNotificationSettings,
} from '../lib/notifications'
import { sendEmail } from '../lib/mailer'

function requireCryptoReady(set: { status?: number | string }) {
  if (!hasKey()) {
    set.status = 401
    throw new Error('Encryption key not loaded. Please log in again.')
  }
}

const smtpSchema = t.Object({
  host: t.String(),
  port: t.Number(),
  secure: t.Boolean(),
  user: t.String(),
  password: t.String(),
  from: t.String(),
  to: t.Array(t.String()),
})

const webhookSchema = t.Object({
  id: t.Optional(t.String()),
  name: t.String(),
  url: t.String(),
  secret: t.Optional(t.String()),
  enabled: t.Boolean(),
  events: t.Array(t.Union([t.Literal('deploy.success'), t.Literal('deploy.failed'), t.Literal('env.changed')])),
})

export const notificationRoutes = new Elysia({ prefix: '/notifications' })
  .get('/settings', async (context: any) => {
    const { requireAuth, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    return serializeNotificationSettings(db.data.notifications)
  })
  .put(
    '/settings',
    async (context: any) => {
      const { requireAuth, body, set } = context
      await requireAuth()
      requireCryptoReady(set)

      return saveNotificationSettings({
        email: body.email,
        globalWebhooks: body.globalWebhooks,
      })
    },
    {
      body: t.Object({
        email: t.Union([smtpSchema, t.Null()]),
        globalWebhooks: t.Array(webhookSchema),
      }),
    }
  )
  .post(
    '/test-email',
    async (context: any) => {
      const { requireAuth, body, set } = context
      await requireAuth()
      requireCryptoReady(set)

      try {
        await sendEmail({
          smtp: body.smtp,
          subject: '[Launchpad] Test email',
          text: 'Launchpad SMTP test succeeded.',
          html: '<p>Launchpad SMTP test succeeded.</p>',
        })
        return { success: true }
      } catch (error) {
        set.status = 500
        return { message: error instanceof Error ? error.message : 'Failed to send test email' }
      }
    },
    { body: t.Object({ smtp: smtpSchema }) }
  )
  .get('/webhooks', async (context: any) => {
    const { requireAuth, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    return serializeNotificationSettings(db.data.notifications).globalWebhooks
  })
  .post(
    '/webhooks',
    async (context: any) => {
      const { requireAuth, body, set } = context
      await requireAuth()
      requireCryptoReady(set)

      const db = await getDb()
      const webhook = buildGlobalWebhook(body as Partial<GlobalWebhook>)
      const next = serializeNotificationSettings(db.data.notifications).globalWebhooks
      next.push({ ...webhook, secret: webhook.secret ?? '' })
      const saved = await saveNotificationSettings({
        email: serializeNotificationSettings(db.data.notifications).email,
        globalWebhooks: next,
      })

      set.status = 201
      return saved.globalWebhooks.at(-1)
    },
    { body: webhookSchema }
  )
  .patch(
    '/webhooks/:id',
    async (context: any) => {
      const { requireAuth, params, body, set } = context
      await requireAuth()
      requireCryptoReady(set)

      const db = await getDb()
      const current = serializeNotificationSettings(db.data.notifications)
      const index = current.globalWebhooks.findIndex((item) => item.id === params.id)
      if (index === -1) {
        set.status = 404
        return { message: 'Webhook not found' }
      }

      current.globalWebhooks[index] = {
        ...buildGlobalWebhook({
          ...current.globalWebhooks[index],
          ...(body as Partial<GlobalWebhook>),
          id: params.id,
        }),
        secret:
          buildGlobalWebhook({
            ...current.globalWebhooks[index],
            ...(body as Partial<GlobalWebhook>),
            id: params.id,
          }).secret ?? '',
      }
      const saved = await saveNotificationSettings(current)
      return saved.globalWebhooks[index]
    },
    { body: webhookSchema }
  )
  .delete('/webhooks/:id', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const current = serializeNotificationSettings(db.data.notifications)
    current.globalWebhooks = current.globalWebhooks.filter((item) => item.id !== params.id)
    await saveNotificationSettings(current)
    return { success: true }
  })
