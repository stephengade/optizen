import { Elysia } from 'elysia'
import type { ProjectFileSuggestion } from '@launchpad/shared'
import { hasKey } from '../lib/crypto'
import { getDb } from '../lib/db'

function requireCryptoReady(set: { status?: number | string }) {
  if (!hasKey()) {
    set.status = 401
    throw new Error('Encryption key not loaded. Please log in again.')
  }
}

function buildSuggestions(project: {
  envPath?: string
  workingDir?: string
  proxyType: 'caddy' | 'nginx' | 'none'
}): ProjectFileSuggestion[] {
  const suggestions: ProjectFileSuggestion[] = []
  const root = project.workingDir?.replace(/\/$/, '')

  if (project.envPath) {
    suggestions.push({
      label: 'Runtime env',
      path: project.envPath,
      kind: 'env',
      reason: 'Configured environment file used by this project.',
    })
  }

  if (!root) {
    return suggestions
  }

  suggestions.push(
    {
      label: 'Compose file',
      path: `${root}/docker-compose.yml`,
      kind: 'compose',
      reason: 'Common deploy definition for Compose-based apps.',
    },
    {
      label: 'Compose YAML',
      path: `${root}/compose.yaml`,
      kind: 'compose',
      reason: 'Alternative Compose filename used by newer setups.',
    },
    {
      label: 'Env example',
      path: `${root}/.env.example`,
      kind: 'config',
      reason: 'Useful reference when the live env file needs reconstruction.',
    },
    {
      label: 'Dockerfile',
      path: `${root}/Dockerfile`,
      kind: 'docker',
      reason: 'Helpful when deploy commands or build assumptions need verification.',
    }
  )

  if (project.proxyType === 'caddy') {
    suggestions.push({
      label: 'Project Caddyfile',
      path: `${root}/Caddyfile`,
      kind: 'proxy',
      reason: 'Likely reverse proxy config for this app.',
    })
  }

  if (project.proxyType === 'nginx') {
    suggestions.push({
      label: 'Project nginx config',
      path: `${root}/nginx.conf`,
      kind: 'proxy',
      reason: 'Likely reverse proxy config for this app.',
    })
  }

  return suggestions
}

export const fileRoutes = new Elysia({ prefix: '/files' })
  .get('/projects/:projectId/suggestions', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    requireCryptoReady(set)

    const db = await getDb()
    const project = db.data.projects.find((item) => item.id === params.projectId)
    if (!project) {
      set.status = 404
      return { message: 'Project not found' }
    }

    return buildSuggestions(project)
  })
