import type { Project } from '@launchpad/shared'

export function inferProxyTypeFromProject(input: {
  name?: string
  repoImage?: string
  workingDir?: string
  deployCommands?: string[]
}) {
  
  const haystack = [
    input.name ?? '',
    input.repoImage ?? '',
    input.workingDir ?? '',
    ...(input.deployCommands ?? []),
  ]
    .join(' ')
    .toLowerCase()

  if (haystack.includes('caddy')) return 'caddy' as const
  if (haystack.includes('nginx')) return 'nginx' as const
  return 'none' as const
}

export function inferAndApplyProjectProxyType(project: Project) {
  return inferProxyTypeFromProject(project)
}
