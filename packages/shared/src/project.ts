export type ProxyType = 'caddy' | 'nginx' | 'none'

export interface Project {
  id: string
  serverId: string
  name: string
  repoImage: string           // e.g. ghcr.io/user/app
  deployCommands: string[]    // e.g. ["docker pull ...", "docker compose up -d"]
  envPath?: string            // e.g. /var/www/app/.env
  workingDir?: string         // e.g. /var/www/app
  proxyType: ProxyType
  webhookEnabled: boolean
  webhookSecret?: string      // stored encrypted
  notifications: ProjectNotificationConfig
  createdAt: string
  updatedAt: string
}

export interface ProjectNotificationConfig {
  onSuccess: boolean
  onFailure: boolean
  webhooks: OutboundWebhook[]
}

export interface OutboundWebhook {
  id: string
  url: string
  secret?: string             // for HMAC signing
  enabled: boolean
}

export type ProjectCreateInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'webhookSecret'>
export type ProjectUpdateInput = Partial<ProjectCreateInput>
