import { randomUUID } from 'crypto'
import type { ActivityEvent, ActivityStatus, ActivityType } from '@launchpad/shared'
import { getDb, saveDb } from './db'

export async function recordActivity(input: {
  serverId: string
  projectId?: string
  type: ActivityType
  status: ActivityStatus
  title: string
  detail?: string
}) {
  const db = await getDb()
  const event: ActivityEvent = {
    id: randomUUID(),
    serverId: input.serverId,
    projectId: input.projectId,
    type: input.type,
    status: input.status,
    title: input.title,
    detail: input.detail,
    createdAt: new Date().toISOString(),
  }

  db.data.activity.unshift(event)
  db.data.activity = db.data.activity.slice(0, 400)
  await saveDb()
  return event
}
