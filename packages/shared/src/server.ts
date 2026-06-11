export interface Server {
  id: string
  name: string
  host: string
  port: number
  user: string
  sshKeyPath: string
  sshPassphrase?: string // stored encrypted
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
