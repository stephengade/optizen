export type ManagedFileKind = 'env' | 'proxy'

export interface FileRevision {
  id: string
  kind: ManagedFileKind
  serverId: string
  projectId?: string
  path: string
  content: string
  summary: string
  createdAt: string
}

export interface ProjectFileSuggestion {
  label: string
  path: string
  kind: 'env' | 'proxy' | 'compose' | 'docker' | 'config'
  reason: string
}
