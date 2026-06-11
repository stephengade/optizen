import { randomUUID } from 'crypto'
import type { FileRevision, ManagedFileKind } from '@launchpad/shared'
import { getDb, saveDb } from './db'

export async function saveFileRevision(input: {
  kind: ManagedFileKind
  serverId: string
  projectId?: string
  path: string
  content: string
  summary: string
}) {
  const db = await getDb()
  const revision: FileRevision = {
    id: randomUUID(),
    kind: input.kind,
    serverId: input.serverId,
    projectId: input.projectId,
    path: input.path,
    content: input.content,
    summary: input.summary,
    createdAt: new Date().toISOString(),
  }

  db.data.fileHistory.unshift(revision)
  db.data.fileHistory = db.data.fileHistory.slice(0, 300)
  await saveDb()
  return revision
}

export async function listFileRevisions(filter: {
  kind: ManagedFileKind
  projectId?: string
  serverId?: string
  path?: string
}) {
  const db = await getDb()
  return db.data.fileHistory
    .filter((revision) => {
      if (revision.kind !== filter.kind) return false
      if (filter.projectId && revision.projectId !== filter.projectId) return false
      if (filter.serverId && revision.serverId !== filter.serverId) return false
      if (filter.path && revision.path !== filter.path) return false
      return true
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50)
}
