/**
 * Refuse to start a production server with settings that would quietly weaken security.
 */

const MIN_SECRET_LENGTH = 32
const PLACEHOLDER_SECRETS = new Set(['changeme', 'change-me', 'secret', 'your-secret-here', 'replace-me'])

export function securityProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV !== 'production') return []
  const problems: string[] = []

  const secret = env.SESSION_SECRET?.trim() ?? ''
  if (!secret) {
    problems.push('SESSION_SECRET is not set. Generate one with: openssl rand -hex 32')
  } else if (secret.length < MIN_SECRET_LENGTH || PLACEHOLDER_SECRETS.has(secret.toLowerCase())) {
    problems.push(`SESSION_SECRET is too weak (needs ${MIN_SECRET_LENGTH}+ random characters). Generate one with: openssl rand -hex 32`)
  }

  const webUrl = env.WEB_URL?.trim() ?? ''
  if (!webUrl.startsWith('https://')) {
    problems.push(`WEB_URL must be an https:// address in production (got "${webUrl || 'unset'}"). Session cookies are only sent over HTTPS.`)
  }

  return problems
}

export function assertSecureConfig(): void {
  const problems = securityProblems()
  if (problems.length === 0) return
  console.error(['Refusing to start: insecure production settings.', ...problems.map((p) => `  - ${p}`)].join('\n'))
  process.exit(1)
}
