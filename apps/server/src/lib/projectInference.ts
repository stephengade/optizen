import type { Project, ProjectRuntime, ProjectSource, ProxyType } from '@launchpad/shared'

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

export function inferProjectRuntime(input: {
  name?: string
  repoImage?: string
  workingDir?: string
  deployCommands?: string[]
  proxyType?: ProxyType
}) {
  const haystack = [
    input.name ?? '',
    input.repoImage ?? '',
    input.workingDir ?? '',
    ...(input.deployCommands ?? []),
  ]
    .join(' ')
    .toLowerCase()

  if (input.proxyType && input.proxyType !== 'none') {
    return 'proxy' satisfies ProjectRuntime
  }

  if (haystack.includes('caddy') || haystack.includes('nginx') || haystack.includes('traefik')) {
    return 'proxy' satisfies ProjectRuntime
  }

  if (haystack.includes('docker compose') || haystack.includes('compose.yaml') || haystack.includes('docker-compose')) {
    return 'compose' satisfies ProjectRuntime
  }

  if (haystack.includes('docker pull') || Boolean(input.repoImage)) {
    return 'image' satisfies ProjectRuntime
  }

  return 'custom' satisfies ProjectRuntime
}

export function inferProjectSource(input: { imported?: boolean }) {
  return (input.imported ? 'imported' : 'manual') satisfies ProjectSource
}

export function inferAndApplyProjectProxyType(project: Project) {
  return inferProxyTypeFromProject(project)
}
