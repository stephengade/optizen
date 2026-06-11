/**
 * Launchpad SSH Layer
 * node-ssh wrapper for executing commands on VPS servers
 * Extended in Phase 4 (Deploy), Phase 6 (Env), Phase 7 (Images), Phase 8 (Proxy)
 */
import { NodeSSH } from 'node-ssh'
import { readFileSync } from 'fs'
import type { Server } from '@launchpad/shared'
import { decrypt } from './crypto'

export interface SshExecResult {
  stdout: string
  stderr: string
  code: number | null
}

export interface SshExecOptions {
  /** Stream stdout/stderr lines as they arrive */
  onLine?: (line: string) => void
  cwd?: string
}

/**
 * Get an authenticated SSH connection for a server.
 * Private keys are read from disk at runtime — never stored in the DB.
 */
export async function getConnection(server: Server): Promise<NodeSSH> {
  const ssh = new NodeSSH()

  const privateKey = readFileSync(server.sshKeyPath, 'utf8')
  const passphrase = server.sshPassphrase
    ? decrypt(server.sshPassphrase)
    : undefined

  await ssh.connect({
    host: server.host,
    port: server.port,
    username: server.user,
    privateKey,
    passphrase,
    readyTimeout: 15_000,
  })

  return ssh
}

/**
 * Execute a single command and return its output.
 */
export async function execCommand(
  ssh: NodeSSH,
  command: string,
  options: SshExecOptions = {}
): Promise<SshExecResult> {
  const stdoutLines: string[] = []
  const stderrLines: string[] = []

  const result = await ssh.execCommand(command, {
    cwd: options.cwd,
    onStdout: (chunk) => {
      const line = chunk.toString().trimEnd()
      stdoutLines.push(line)
      options.onLine?.(line)
    },
    onStderr: (chunk) => {
      const line = chunk.toString().trimEnd()
      stderrLines.push(line)
      options.onLine?.(`[stderr] ${line}`)
    },
  })

  return {
    stdout: stdoutLines.join('\n'),
    stderr: stderrLines.join('\n'),
    code: result.code,
  }
}

/**
 * Run multiple commands in sequence, stopping on first failure.
 * Streams each line via onLine if provided.
 */
export async function execCommands(
  ssh: NodeSSH,
  commands: string[],
  options: SshExecOptions = {}
): Promise<{ success: boolean; results: SshExecResult[] }> {
  const results: SshExecResult[] = []

  for (const command of commands) {
    options.onLine?.(`$ ${command}`)
    const result = await execCommand(ssh, command, options)
    results.push(result)

    if (result.code !== 0) {
      return { success: false, results }
    }
  }

  return { success: true, results }
}

/**
 * Test SSH connectivity to a server. Returns latency in ms.
 */
export async function testConnection(server: Server): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now()
  let ssh: NodeSSH | null = null

  try {
    ssh = await getConnection(server)
    const result = await execCommand(ssh, 'echo ok')
    const latencyMs = Date.now() - start

    return {
      connected: result.code === 0,
      latencyMs,
    }
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  } finally {
    ssh?.dispose()
  }
}
