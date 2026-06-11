import { createHmac, randomUUID } from 'crypto'
import type {
  DeployRecord,
  GlobalWebhook,
  NotificationEvent,
  NotificationSettings,
  Project,
  SmtpConfig,
  Server,
  WebhookPayload,
} from '@launchpad/shared'
import { decrypt, encrypt } from './crypto'
import { getDb, saveDb } from './db'
import { sendEmail } from './mailer'

type NotificationSettingsInput = {
  email: SmtpConfig | null
  globalWebhooks: GlobalWebhook[]
}

export function serializeNotificationSettings(settings: NotificationSettings) {
  return {
    email: settings.email
      ? {
          ...settings.email,
          password: settings.email.password ? decrypt(settings.email.password) : '',
        }
      : null,
    globalWebhooks: settings.globalWebhooks.map((webhook) => ({
      ...webhook,
      secret: webhook.secret ? decrypt(webhook.secret) : '',
    })),
  }
}

export function prepareNotificationSettings(input: NotificationSettingsInput): NotificationSettings {
  return {
    email: input.email
      ? {
          ...input.email,
          password: input.email.password?.trim() ? encrypt(input.email.password.trim()) : '',
          to: input.email.to.map((value) => value.trim()).filter(Boolean),
        }
      : null,
    globalWebhooks: input.globalWebhooks.map((webhook) => ({
      ...webhook,
      url: webhook.url.trim(),
      secret: webhook.secret?.trim() ? encrypt(webhook.secret.trim()) : undefined,
    })),
  }
}

export async function saveNotificationSettings(input: NotificationSettingsInput) {
  const db = await getDb()
  db.data.notifications = prepareNotificationSettings(input)
  await saveDb()
  return serializeNotificationSettings(db.data.notifications)
}

function renderDeployEmail(options: {
  event: NotificationEvent
  project: Project
  server: Server
  record: DeployRecord
}) {
  const { event, project, server, record } = options
  const title = event === 'deploy.success' ? 'Deploy succeeded' : 'Deploy failed'
  const summary = `${project.name} on ${server.name} finished with status ${record.status}`
  const logLines = record.logSnapshot.slice(-20).join('\n')

  return {
    subject: `[Launchpad] ${title}: ${project.name}`,
    text: `${summary}\nTrigger: ${record.trigger}\nDuration: ${record.durationMs ?? 0}ms\n\n${logLines}`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; color: #111;">
        <h2>${title}</h2>
        <p>${summary}</p>
        <p><strong>Trigger:</strong> ${record.trigger}</p>
        <p><strong>Duration:</strong> ${record.durationMs ?? 0}ms</p>
        <p><strong>Host:</strong> ${server.host}</p>
        <pre style="background:#111114;color:#E8E8EF;padding:16px;border-radius:8px;overflow:auto;">${logLines
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</pre>
      </div>
    `,
  }
}

async function postWebhook(options: {
  webhook: { url: string; secret?: string }
  payload: WebhookPayload
}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (options.webhook.secret) {
    headers['X-Launchpad-Signature'] = createHmac('sha256', options.webhook.secret)
      .update(JSON.stringify(options.payload))
      .digest('hex')
  }

  await fetch(options.webhook.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(options.payload),
  })
}

export async function sendDeployNotifications(options: {
  project: Project
  server: Server
  record: DeployRecord
}) {
  const { project, server, record } = options
  const db = await getDb()
  const settings = serializeNotificationSettings(db.data.notifications)
  const event: NotificationEvent = record.status === 'success' ? 'deploy.success' : 'deploy.failed'

  const payload: WebhookPayload = {
    event,
    project: { id: project.id, name: project.name },
    server: { id: server.id, name: server.name, host: server.host },
    triggeredBy: record.trigger,
    timestamp: record.completedAt ?? new Date().toISOString(),
    durationMs: record.durationMs ?? 0,
    logSnapshot: record.logSnapshot.join('\n'),
  }

  const tasks: Promise<unknown>[] = []

  if (
    settings.email &&
    ((record.status === 'success' && project.notifications.onSuccess) ||
      (record.status === 'failed' && project.notifications.onFailure))
  ) {
    const email = renderDeployEmail({ event, project, server, record })
    tasks.push(sendEmail({ smtp: settings.email, ...email }))
  }

  const webhookTargets = [
    ...project.notifications.webhooks.filter((webhook) => webhook.enabled),
    ...settings.globalWebhooks.filter((webhook) => webhook.enabled && webhook.events.includes(event)),
  ]

  for (const webhook of webhookTargets) {
    tasks.push(postWebhook({ webhook, payload }))
  }

  const results = await Promise.allSettled(tasks)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[notifications] failed', result.reason)
    }
  }
}

export function buildGlobalWebhook(input?: Partial<GlobalWebhook>): GlobalWebhook {
  return {
    id: input?.id ?? randomUUID(),
    name: input?.name ?? '',
    url: input?.url ?? '',
    secret: input?.secret ?? '',
    enabled: input?.enabled ?? true,
    events: input?.events ?? ['deploy.success', 'deploy.failed'],
  }
}
