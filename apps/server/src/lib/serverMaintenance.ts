import type { Server } from '@launchpad/shared'
import { asRoot, cleanStderr, describeRoute, NO_ROOT_HELP, NO_ROOT_MARKER, routeFrom } from './elevate'
import { execCommand, getConnection } from './ssh'

async function withSsh<T>(server: Server, handler: (ssh: Awaited<ReturnType<typeof getConnection>>) => Promise<T>) {
  let ssh: Awaited<ReturnType<typeof getConnection>> | null = null
  try {
    ssh = await getConnection(server)
    return await handler(ssh)
  } finally {
    ssh?.dispose()
  }
}

export async function runSafeServerPrune(server: Server) {
  return withSsh(server, async (ssh) => {
    const result = await execCommand(
      ssh,
      [
        'set +e',
        'if command -v docker >/dev/null 2>&1; then DOCKER_BIN="$(command -v docker)"; elif [ -x /usr/bin/docker ]; then DOCKER_BIN="/usr/bin/docker"; else DOCKER_BIN=""; fi',
        'if [ -n "$DOCKER_BIN" ]; then echo "$ docker image prune -f"; "$DOCKER_BIN" image prune -f 2>&1; fi',
        'if [ -n "$DOCKER_BIN" ]; then echo "$ docker container prune -f"; "$DOCKER_BIN" container prune -f 2>&1; fi',
        'if [ -n "$DOCKER_BIN" ]; then echo "$ docker builder prune -af"; "$DOCKER_BIN" builder prune -af 2>&1; fi',
        'if command -v journalctl >/dev/null 2>&1; then echo "$ journalctl --vacuum-time=7d"; journalctl --vacuum-time=7d 2>&1; fi',
        'if command -v apt-get >/dev/null 2>&1; then echo "$ apt-get clean"; apt-get clean 2>&1; fi',
      ].join('; ')
    )

    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || 'Failed to run safe prune')
    }

    return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n')
  })
}

export async function restartServerService(server: Server, service: 'docker' | 'containerd') {
  return withSsh(server, async (ssh) => {
    // --no-block: when the route is Docker, restarting Docker ends the helper container itself.
    const result = await execCommand(ssh, asRoot(`systemctl restart --no-block ${service}`))
    const route = routeFrom(result.stderr)
    if (result.code !== 0) {
      if (result.stderr.includes(NO_ROOT_MARKER)) throw new Error(`Restarting ${service}: ${NO_ROOT_HELP}`)
      throw new Error(cleanStderr(result.stderr) || result.stdout || `Failed to restart ${service}`)
    }
    // Wait for the service to come back (up to ~30s).
    const wait = await execCommand(
      ssh,
      `for i in $(seq 1 30); do s=$(systemctl is-active ${service} 2>/dev/null); [ "$s" = active ] && { echo active; exit 0; }; sleep 1; done; echo "$s"`
    )
    const state = wait.stdout.trim().split('\n').pop()
    if (state !== 'active') {
      throw new Error(`${service} was restarted${describeRoute(route)} but is "${state || 'unknown'}" after 30 seconds. Check it on the server.`)
    }
    return `Restarted ${service}${describeRoute(route)}. It is active again.`
  })
}

export async function runVolumePrune(server: Server) {
  return withSsh(server, async (ssh) => {
    const result = await execCommand(ssh, 'docker volume prune -f')
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || 'Failed to prune Docker volumes')
    }
    return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n')
  })
}
