export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string            // stored encrypted
  from: string
  to: string[]
}

export interface NotificationSettings {
  email: SmtpConfig | null
  globalWebhooks: GlobalWebhook[]
}

export interface GlobalWebhook {
  id: string
  name: string
  url: string
  secret?: string
  enabled: boolean
  events: NotificationEvent[]
}

export type NotificationEvent =
  | 'deploy.success'
  | 'deploy.failed'
  | 'env.changed'
