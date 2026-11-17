/** Compose file and service parsing, kept free of server state so it can be unit-tested. */

export const COMPOSE_SERVICE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/

/**
 * The compose file and service a project deploys, read from its deploy commands
 * (e.g. `docker compose -f docker-compose.production.yml up -d web`).
 */
export function composeTarget(deployCommands: string[]): { files: string[]; service?: string } {
  const files: string[] = []
  let service: string | undefined
  for (const command of deployCommands) {
    const parts = command.trim().split(/\s+/)
    if (parts[0] !== 'docker' || parts[1] !== 'compose') continue
    for (let index = 2; index < parts.length; index += 1) {
      const part = parts[index]
      if ((part === '-f' || part === '--file') && parts[index + 1]) {
        if (!files.includes(parts[index + 1])) files.push(parts[index + 1])
        index += 1
      } else if (part.startsWith('--file=')) {
        const file = part.slice('--file='.length)
        if (!files.includes(file)) files.push(file)
      }
    }
    const up = parts.indexOf('up')
    if (up !== -1) {
      const last = parts[parts.length - 1]
      if (parts.length - 1 > up && !last.startsWith('-') && COMPOSE_SERVICE.test(last)) service = last
    }
  }
  return { files, service }
}
