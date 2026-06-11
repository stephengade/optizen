export type ProxyType = 'caddy' | 'nginx' | 'none'
export type ProjectSource = 'manual' | 'imported'
export type ProjectRuntime = 'compose' | 'image' | 'proxy' | 'custom'
export type ProjectHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'down'

export interface Project {
  id: string
  serverId: string
  name: string
  source: ProjectSource
  runtime: ProjectRuntime
  repoImage: string           // e.g. ghcr.io/user/app
  deployCommands: string[]    // e.g. ["docker pull ...", "docker compose up -d"]
  envPath?: string            // e.g. /var/www/app/.env
  workingDir?: string         // e.g. /var/www/app
  proxyType: ProxyType
  healthCheck?: ProjectHealthCheck
  healthStatus?: ProjectHealthState
  lastDeploy?: ProjectDeploySummary
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

export interface ProjectHealthCheck {
  path?: string
  port?: number
}

export interface ProjectHealthState {
  status: ProjectHealthStatus
  lastCheckedAt?: string
  lastSuccessfulAt?: string
  responseTimeMs?: number
  message?: string
}

export interface ProjectDeploySummary {
  id: string
  status: 'success' | 'failed' | 'deploying'
  triggeredAt: string
  completedAt?: string
  imageTag?: string
}

export type ProjectCreateInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'webhookSecret'>
export type ProjectUpdateInput = Partial<ProjectCreateInput>
