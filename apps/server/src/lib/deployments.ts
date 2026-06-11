import { randomUUID } from 'crypto'
import type { DeployLogEvent, DeployRecord, DeployStatus, DeployTrigger, Project, Server } from '@launchpad/shared'
import { getDb, saveDb } from './db'
import { sendDeployNotifications } from './notifications'
import { execCommands, getConnection } from './ssh'

type DeployListener = (event: DeployLogEvent) => void

const listeners = new Map<string, Set<DeployListener>>()
const activeDeploys = new Map<string, { deployId: string; startedAt: number }>()

function emit(projectId: string, event: DeployLogEvent) {
  const projectListeners = listeners.get(projectId)
  if (!projectListeners) return

  for (const listener of projectListeners) {
    listener(event)
  }
}

function addLog(logs: string[], line: string) {
  logs.push(line)
  if (logs.length > 500) {
    logs.splice(0, logs.length - 500)
  }
}

async function saveDeployRecord(record: DeployRecord) {
  const db = await getDb()
  db.data.deployHistory.unshift(record)
  db.data.deployHistory = db.data.deployHistory.slice(0, 200)
  await saveDb()
}

export function subscribeToDeploy(projectId: string, listener: DeployListener) {
  const existing = listeners.get(projectId) ?? new Set<DeployListener>()
  existing.add(listener)
  listeners.set(projectId, existing)

  return () => {
    const projectListeners = listeners.get(projectId)
    if (!projectListeners) return
    projectListeners.delete(listener)
    if (projectListeners.size === 0) {
      listeners.delete(projectId)
    }
  }
}

export function isProjectDeploying(projectId: string) {
  return activeDeploys.has(projectId)
}

export async function runDeploy(options: {
  project: Project
  server: Server
  imageTag?: string
  trigger: DeployTrigger
}) {
  const { project, server, imageTag, trigger } = options

  if (activeDeploys.has(project.id)) {
    throw new Error('A deploy is already running for this project')
  }

  const deployId = randomUUID()
  const startedAt = Date.now()
  activeDeploys.set(project.id, { deployId, startedAt })

  const logs: string[] = []
  let finalStatus: DeployStatus = 'failed'
  let error: string | undefined
  let ssh: Awaited<ReturnType<typeof getConnection>> | null = null

  emit(project.id, { type: 'status', status: 'deploying' })
  addLog(logs, `Deploy triggered via ${trigger}`)
  emit(project.id, { type: 'log', line: `Deploy triggered via ${trigger}` })

  if (imageTag) {
    addLog(logs, `Requested image tag: ${imageTag}`)
    emit(project.id, { type: 'log', line: `Requested image tag: ${imageTag}` })
  }

  try {
    ssh = await getConnection(server)
    const result = await execCommands(ssh, project.deployCommands, {
      cwd: project.workingDir,
      onLine: (line) => {
        addLog(logs, line)
        emit(project.id, { type: 'log', line })
      },
    })

    if (!result.success) {
      const failedResult = result.results.at(-1)
      error = failedResult?.stderr || failedResult?.stdout || 'Deploy command failed'
      emit(project.id, { type: 'error', error })
      finalStatus = 'failed'
    } else {
      finalStatus = 'success'
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown deploy error'
    addLog(logs, `[error] ${error}`)
    emit(project.id, { type: 'error', error })
    finalStatus = 'failed'
  } finally {
    ssh?.dispose()

    const completedAt = new Date().toISOString()
    const durationMs = Date.now() - startedAt

    const record: DeployRecord = {
      id: deployId,
      projectId: project.id,
      serverId: server.id,
      status: finalStatus,
      trigger,
      triggeredAt: new Date(startedAt).toISOString(),
      completedAt,
      durationMs,
      logSnapshot: logs.slice(-50),
      imageTag,
      error,
    }

    await saveDeployRecord(record)
    emit(project.id, { type: 'done', status: finalStatus, durationMs })

    await sendDeployNotifications({ project, server, record })

    activeDeploys.delete(project.id)
  }
}
