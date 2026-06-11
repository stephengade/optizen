export type DeployStatus = 'idle' | 'deploying' | 'success' | 'failed'
export type DeployTrigger = 'ui' | 'github_actions' | 'webhook'

export interface DeployRecord {
  id: string
  projectId: string
  serverId: string
  status: DeployStatus
  trigger: DeployTrigger
  triggeredAt: string
  completedAt?: string
  durationMs?: number
  logSnapshot: string[]       
  imageTag?: string           
  error?: string
}

export interface DeployTriggerInput {
  projectId: string
  imageTag?: string           // defaults to 'latest'
  trigger: DeployTrigger
}

// SSE event shape streamed to the UI during deploy
export interface DeployLogEvent {
  type: 'log' | 'status' | 'done' | 'error'
  line?: string
  status?: DeployStatus
  durationMs?: number
  error?: string
}

// Outbound webhook payload fired after deploy
export interface WebhookPayload {
  event: 'deploy.success' | 'deploy.failed'
  project: { id: string; name: string }
  server: { id: string; name: string; host: string }
  triggeredBy: DeployTrigger
  timestamp: string
  durationMs: number
  logSnapshot: string
}
