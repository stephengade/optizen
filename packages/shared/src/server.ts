export interface Server {
  id: string
  name: string
  host: string
  port: number
  user: string
  sshKeyPath: string
  sshPassphrase?: string // stored encrypted
  lastConnectionStatus?: ServerConnectionStatus
  lastResourceStatus?: ServerResourceStatus
  createdAt: string
  updatedAt: string
}

export type ServerCreateInput = Omit<Server, 'id' | 'createdAt' | 'updatedAt'>
export type ServerUpdateInput = Partial<ServerCreateInput>

export interface ServerConnectionStatus {
  serverId: string
  connected: boolean
  latencyMs?: number
  error?: string
  checkedAt: string
}

export interface ServerResourceStatus {
  serverId: string
  cpuUsagePercent?: number
  cpuCoreCount?: number
  memoryTotalBytes?: number
  memoryUsedBytes?: number
  diskTotalBytes?: number
  diskUsedBytes?: number
  uptimeSeconds?: number
  loadAverage?: [number, number, number]
  diskInodesUsedPercent?: number
  runningContainers?: number
  exitedContainers?: number
  containersAvailable?: boolean
  checkedAt: string
}
