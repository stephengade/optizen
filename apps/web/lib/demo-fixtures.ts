import type {
  ActivityEvent,
  DeployRecord,
  Project,
  ProjectFileSuggestion,
  Server,
} from '@launchpad/shared'

type ServerSummary = Server & { projectCount?: number; recentDeployOutcomes?: DeployRecord[] }

const now = Date.now()
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString()
const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000).toISOString()
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString()

export const demoProjects: Project[] = [
  {
    id: 'demo-project-marketing',
    serverId: 'demo-server-lagos',
    name: 'marketing-site',
    source: 'manual',
    runtime: 'compose',
    repoImage: 'ghcr.io/peak/marketing-site',
    deployCommands: ['docker compose pull', 'docker compose up -d'],
    envPath: '/var/www/marketing-site/.env',
    workingDir: '/var/www/marketing-site',
    proxyType: 'caddy',
    healthCheck: { path: '/health' },
    healthStatus: {
      status: 'healthy',
      lastCheckedAt: minutesAgo(4),
      lastSuccessfulAt: minutesAgo(4),
      responseTimeMs: 92,
      message: 'Health check passed for http://127.0.0.1/health.',
    },
    lastDeploy: {
      id: 'demo-deploy-1',
      status: 'success',
      triggeredAt: hoursAgo(2),
      completedAt: hoursAgo(2),
      imageTag: 'sha-91fd0c1',
    },
    webhookEnabled: true,
    webhookSecret: 'demo-marketing-secret',
    notifications: { onSuccess: true, onFailure: true, webhooks: [] },
    createdAt: daysAgo(16),
    updatedAt: minutesAgo(4),
  },
  {
    id: 'demo-project-api',
    serverId: 'demo-server-lagos',
    name: 'core-api',
    source: 'imported',
    runtime: 'image',
    repoImage: 'ghcr.io/peak/core-api',
    deployCommands: ['docker pull ghcr.io/peak/core-api:latest', 'docker compose up -d'],
    envPath: '/srv/core-api/.env',
    workingDir: '/srv/core-api',
    proxyType: 'nginx',
    healthCheck: { port: 8080 },
    healthStatus: {
      status: 'degraded',
      lastCheckedAt: minutesAgo(7),
      lastSuccessfulAt: hoursAgo(5),
      responseTimeMs: 320,
      message: 'TCP port check is slower than usual but still responding.',
    },
    lastDeploy: {
      id: 'demo-deploy-2',
      status: 'failed',
      triggeredAt: hoursAgo(5),
      completedAt: hoursAgo(5),
      imageTag: 'sha-4d1a2ef',
    },
    webhookEnabled: false,
    webhookSecret: 'demo-api-secret',
    notifications: { onSuccess: true, onFailure: true, webhooks: [] },
    createdAt: daysAgo(10),
    updatedAt: minutesAgo(7),
  },
  {
    id: 'demo-project-proxy',
    serverId: 'demo-server-edge',
    name: 'edge-proxy',
    source: 'manual',
    runtime: 'proxy',
    repoImage: 'caddy',
    deployCommands: ['caddy validate --config /etc/caddy/Caddyfile', 'systemctl reload caddy'],
    workingDir: '/etc/caddy',
    proxyType: 'caddy',
    healthStatus: {
      status: 'healthy',
      lastCheckedAt: minutesAgo(9),
      lastSuccessfulAt: minutesAgo(9),
      message: 'Proxy config is loaded and serving.',
    },
    lastDeploy: {
      id: 'demo-deploy-3',
      status: 'success',
      triggeredAt: daysAgo(1),
      completedAt: daysAgo(1),
    },
    webhookEnabled: false,
    webhookSecret: 'demo-proxy-secret',
    notifications: { onSuccess: false, onFailure: true, webhooks: [] },
    createdAt: daysAgo(22),
    updatedAt: minutesAgo(9),
  },
]

export const demoDeployHistory: DeployRecord[] = [
  {
    id: 'demo-deploy-1',
    projectId: 'demo-project-marketing',
    serverId: 'demo-server-lagos',
    status: 'success',
    trigger: 'ui',
    triggeredAt: hoursAgo(2),
    completedAt: hoursAgo(2),
    durationMs: 84_000,
    logSnapshot: ['Deploy triggered via ui', '$ docker compose pull', 'Digest: sha256:abc123', '$ docker compose up -d', 'marketing-site  Recreated'],
    imageTag: 'sha-91fd0c1',
  },
  {
    id: 'demo-deploy-2',
    projectId: 'demo-project-api',
    serverId: 'demo-server-lagos',
    status: 'failed',
    trigger: 'github_actions',
    triggeredAt: hoursAgo(5),
    completedAt: hoursAgo(5),
    durationMs: 122_000,
    logSnapshot: ['Deploy triggered via github_actions', '$ docker pull ghcr.io/peak/core-api:latest', '[stderr] manifest unknown'],
    imageTag: 'sha-4d1a2ef',
    error: 'Registry returned manifest unknown for sha-4d1a2ef.',
  },
  {
    id: 'demo-deploy-3',
    projectId: 'demo-project-proxy',
    serverId: 'demo-server-edge',
    status: 'success',
    trigger: 'ui',
    triggeredAt: daysAgo(1),
    completedAt: daysAgo(1),
    durationMs: 17_000,
    logSnapshot: ['Deploy triggered via ui', '$ caddy validate --config /etc/caddy/Caddyfile', 'Valid configuration', '$ systemctl reload caddy'],
  },
]

export const demoServers: ServerSummary[] = [
  {
    id: 'demo-server-lagos',
    name: 'Production Lagos',
    host: '198.51.100.42',
    port: 22,
    user: 'deploy',
    sshKeyPath: 'C:\\Users\\demo\\.ssh\\lagos-ed25519',
    lastConnectionStatus: {
      serverId: 'demo-server-lagos',
      connected: true,
      latencyMs: 71,
      checkedAt: minutesAgo(3),
    },
    lastResourceStatus: {
      serverId: 'demo-server-lagos',
      cpuUsagePercent: 36.4,
      cpuCoreCount: 4,
      memoryTotalBytes: 8 * 1024 * 1024 * 1024,
      memoryUsedBytes: 4.7 * 1024 * 1024 * 1024,
      diskTotalBytes: 128 * 1024 * 1024 * 1024,
      diskUsedBytes: 73 * 1024 * 1024 * 1024,
      uptimeSeconds: 864000,
      loadAverage: [0.82, 0.77, 0.71],
      diskInodesUsedPercent: 39,
      runningContainers: 7,
      exitedContainers: 1,
      containersAvailable: true,
      checkedAt: minutesAgo(3),
    },
    projectCount: 2,
    recentDeployOutcomes: demoDeployHistory.filter((item) => item.serverId === 'demo-server-lagos'),
    createdAt: daysAgo(40),
    updatedAt: minutesAgo(3),
  },
  {
    id: 'demo-server-edge',
    name: 'Edge Gateway',
    host: '203.0.113.24',
    port: 22,
    user: 'ops',
    sshKeyPath: 'C:\\Users\\demo\\.ssh\\edge-ed25519',
    lastConnectionStatus: {
      serverId: 'demo-server-edge',
      connected: true,
      latencyMs: 48,
      checkedAt: minutesAgo(9),
    },
    lastResourceStatus: {
      serverId: 'demo-server-edge',
      cpuUsagePercent: 12.1,
      cpuCoreCount: 8,
      memoryTotalBytes: 4 * 1024 * 1024 * 1024,
      memoryUsedBytes: 1.6 * 1024 * 1024 * 1024,
      diskTotalBytes: 64 * 1024 * 1024 * 1024,
      diskUsedBytes: 21 * 1024 * 1024 * 1024,
      uptimeSeconds: 421000,
      loadAverage: [0.22, 0.17, 0.15],
      diskInodesUsedPercent: 16,
      runningContainers: 2,
      exitedContainers: 0,
      containersAvailable: true,
      checkedAt: minutesAgo(9),
    },
    projectCount: 1,
    recentDeployOutcomes: demoDeployHistory.filter((item) => item.serverId === 'demo-server-edge'),
    createdAt: daysAgo(55),
    updatedAt: minutesAgo(9),
  },
]

export const demoActivity: ActivityEvent[] = [
  {
    id: 'demo-activity-1',
    serverId: 'demo-server-lagos',
    projectId: 'demo-project-marketing',
    type: 'deploy_succeeded',
    status: 'success',
    title: 'Deploy succeeded for marketing-site',
    detail: 'Completed in 84s via UI.',
    createdAt: hoursAgo(2),
  },
  {
    id: 'demo-activity-2',
    serverId: 'demo-server-lagos',
    projectId: 'demo-project-api',
    type: 'deploy_failed',
    status: 'error',
    title: 'Deploy failed for core-api',
    detail: 'Registry returned manifest unknown for sha-4d1a2ef.',
    createdAt: hoursAgo(5),
  },
  {
    id: 'demo-activity-3',
    serverId: 'demo-server-lagos',
    projectId: 'demo-project-marketing',
    type: 'env_updated',
    status: 'info',
    title: 'Updated env for marketing-site',
    detail: '/var/www/marketing-site/.env backed up before overwrite.',
    createdAt: hoursAgo(7),
  },
  {
    id: 'demo-activity-4',
    serverId: 'demo-server-edge',
    projectId: 'demo-project-proxy',
    type: 'proxy_config_updated',
    status: 'success',
    title: 'Saved proxy config',
    detail: '/etc/caddy/Caddyfile backed up before reload.',
    createdAt: daysAgo(1),
  },
]

export const demoFileSuggestions: Record<string, ProjectFileSuggestion[]> = {
  'demo-project-marketing': [
    { label: 'Runtime env', path: '/var/www/marketing-site/.env', kind: 'env', reason: 'Configured environment file used by this project.' },
    { label: 'Compose file', path: '/var/www/marketing-site/docker-compose.yml', kind: 'compose', reason: 'Main Compose definition for the app.' },
    { label: 'Project Caddyfile', path: '/var/www/marketing-site/Caddyfile', kind: 'proxy', reason: 'Likely reverse proxy rules for the site.' },
  ],
  'demo-project-api': [
    { label: 'Runtime env', path: '/srv/core-api/.env', kind: 'env', reason: 'Configured environment file used by this project.' },
    { label: 'Dockerfile', path: '/srv/core-api/Dockerfile', kind: 'docker', reason: 'Useful for build/runtime inspection.' },
  ],
  'demo-project-proxy': [
    { label: 'Project Caddyfile', path: '/etc/caddy/Caddyfile', kind: 'proxy', reason: 'Primary Caddy configuration file.' },
  ],
}

export const demoProjectLogs: Record<string, { sources: Array<{ id: string; label: string }>; snapshots: Record<string, string[]> }> = {
  'demo-project-marketing': {
    sources: [{ id: 'compose', label: 'Compose logs' }, { id: 'container', label: 'Container logs' }],
    snapshots: {
      compose: [
        'web-1  | GET / 200 34ms',
        'web-1  | GET /pricing 200 29ms',
        'web-1  | Health check OK',
      ],
      container: [
        'next-start | listening on 0.0.0.0:3000',
        'next-start | compiled successfully',
      ],
    },
  },
  'demo-project-api': {
    sources: [{ id: 'container', label: 'Container logs' }],
    snapshots: {
      container: [
        'api | booting core-api',
        'api | warning: upstream cache is cold',
        'api | GET /health 200 112ms',
      ],
    },
  },
  'demo-project-proxy': {
    sources: [{ id: 'service', label: 'Service logs' }],
    snapshots: {
      service: [
        'caddy[201]: admin endpoint started',
        'caddy[201]: serving initial configuration',
      ],
    },
  },
}

export const demoImageStatus: Record<string, any> = {
  'demo-project-marketing': {
    containerId: 'abc123',
    name: 'marketing-site-web-1',
    image: 'ghcr.io/peak/marketing-site:sha-91fd0c1',
    tag: 'sha-91fd0c1',
    status: 'Up 2 hours',
    uptime: '2 hours',
    ports: ['0.0.0.0:3000->3000/tcp'],
    restartCount: 0,
  },
  'demo-project-api': {
    containerId: 'def456',
    name: 'core-api-1',
    image: 'ghcr.io/peak/core-api:sha-4d1a2ef',
    tag: 'sha-4d1a2ef',
    status: 'Restarting (1) 18 seconds ago',
    uptime: '18 seconds',
    ports: ['0.0.0.0:8080->8080/tcp'],
    restartCount: 4,
  },
  'demo-project-proxy': {
    containerId: 'ghi789',
    name: 'edge-caddy',
    image: 'caddy:latest',
    tag: 'latest',
    status: 'Up 1 day',
    uptime: '1 day',
    ports: ['0.0.0.0:80->80/tcp', '0.0.0.0:443->443/tcp'],
    restartCount: 0,
  },
}

export const demoImageTags: Record<string, string[]> = {
  'demo-project-marketing': ['sha-91fd0c1', 'sha-7ef92bd', 'latest'],
  'demo-project-api': ['sha-4d1a2ef', 'sha-a32bd18', 'latest'],
  'demo-project-proxy': ['latest'],
}

export function isDemoId(id: string) {
  return id.startsWith('demo-')
}

export function getDemoServer(id: string) {
  return demoServers.find((item) => item.id === id) ?? null
}

export function getDemoProject(id: string) {
  return demoProjects.find((item) => item.id === id) ?? null
}

export function getDemoProjectsForServer(serverId: string) {
  return demoProjects.filter((item) => item.serverId === serverId)
}

export function getDemoActivityForServer(serverId: string) {
  return demoActivity.filter((item) => item.serverId === serverId)
}

export function getDemoActivityForProject(projectId: string) {
  return demoActivity.filter((item) => item.projectId === projectId)
}

export function getDemoDeploysForProject(projectId: string) {
  return demoDeployHistory.filter((item) => item.projectId === projectId)
}
