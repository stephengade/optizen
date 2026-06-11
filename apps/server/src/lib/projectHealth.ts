import type { Project, ProjectHealthState, Server } from '@launchpad/shared'
import { execCommand, getConnection } from './ssh'

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
}

export async function runProjectHealthCheck(project: Project, server: Server): Promise<ProjectHealthState> {
  if (!project.healthCheck?.path && !project.healthCheck?.port) {
    return {
      status: 'unknown',
      message: 'No health endpoint or port check is configured yet.',
      lastCheckedAt: new Date().toISOString(),
      lastSuccessfulAt: project.healthStatus?.lastSuccessfulAt,
    }
  }

  let ssh: Awaited<ReturnType<typeof getConnection>> | null = null
  const startedAt = Date.now()

  try {
    ssh = await getConnection(server)

    let command = ''
    let target = ''

    if (project.healthCheck.path) {
      const path = project.healthCheck.path.startsWith('/') ? project.healthCheck.path : `/${project.healthCheck.path}`
      target = `http://127.0.0.1${path}`
      command = `curl -fsS -o /dev/null --max-time 10 ${shellEscape(target)}`
    } else if (project.healthCheck.port) {
      target = `127.0.0.1:${project.healthCheck.port}`
      command = `sh -lc "nc -z 127.0.0.1 ${project.healthCheck.port} >/dev/null 2>&1 || bash -lc '</dev/tcp/127.0.0.1/${project.healthCheck.port}' >/dev/null 2>&1"`
    }

    const result = await execCommand(ssh, command, { cwd: project.workingDir })
    const responseTimeMs = Date.now() - startedAt

    if (result.code === 0) {
      const now = new Date().toISOString()
      return {
        status: 'healthy',
        message: `Health check passed for ${target}.`,
        responseTimeMs,
        lastCheckedAt: now,
        lastSuccessfulAt: now,
      }
    }

    return {
      status: 'down',
      message: result.stderr || result.stdout || `Health check failed for ${target}.`,
      responseTimeMs,
      lastCheckedAt: new Date().toISOString(),
      lastSuccessfulAt: project.healthStatus?.lastSuccessfulAt,
    }
  } catch (error) {
    return {
      status: 'degraded',
      message: error instanceof Error ? error.message : 'Health check failed unexpectedly.',
      responseTimeMs: Date.now() - startedAt,
      lastCheckedAt: new Date().toISOString(),
      lastSuccessfulAt: project.healthStatus?.lastSuccessfulAt,
    }
  } finally {
    ssh?.dispose()
  }
}
