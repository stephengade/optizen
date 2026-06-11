/**
 * Launchpad SSH Layer
 * node-ssh wrapper for executing commands on VPS servers
 * Extended in Phase 4 (Deploy), Phase 6 (Env), Phase 7 (Images), Phase 8 (Proxy)
 */
import { NodeSSH } from 'node-ssh'
import { readFileSync } from 'fs'
import { unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, posix } from 'path'
import { randomUUID } from 'crypto'
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

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
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
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []
  let stdoutRemainder = ''
  let stderrRemainder = ''

  const flushLines = (buffer: string, emit: (line: string) => void) => {
    const normalized = buffer.replace(/\r\n/g, '\n')
    const parts = normalized.split('\n')
    const complete = parts.slice(0, -1)
    const remainder = parts.at(-1) ?? ''

    for (const line of complete) {
      emit(line)
    }

    return remainder
  }

  const result = await ssh.execCommand(command, {
    cwd: options.cwd,
    onStdout: (chunk) => {
      const text = chunk.toString()
      stdoutChunks.push(text)
      stdoutRemainder = flushLines(stdoutRemainder + text, (line) => {
        options.onLine?.(line)
      })
    },
    onStderr: (chunk) => {
      const text = chunk.toString()
      stderrChunks.push(text)
      stderrRemainder = flushLines(stderrRemainder + text, (line) => {
        options.onLine?.(`[stderr] ${line}`)
      })
    },
  })

  if (stdoutRemainder.length > 0) {
    options.onLine?.(stdoutRemainder)
  }

  if (stderrRemainder.length > 0) {
    options.onLine?.(`[stderr] ${stderrRemainder}`)
  }

  return {
    stdout: stdoutChunks.join(''),
    stderr: stderrChunks.join(''),
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

export async function readRemoteFile(ssh: NodeSSH, remotePath: string): Promise<string> {
  const result = await execCommand(ssh, `cat ${shellEscape(remotePath)}`)

  if (result.code !== 0) {
    throw new Error(result.stderr || `Failed to read ${remotePath}`)
  }

  return result.stdout
}

export async function writeRemoteFile(ssh: NodeSSH, remotePath: string, content: string): Promise<void> {
  const tempFile = join(tmpdir(), `launchpad-env-${randomUUID()}.tmp`)

  try {
    await writeFile(tempFile, content, 'utf8')

    const remoteDir = posix.dirname(remotePath)
    const mkdirResult = await execCommand(ssh, `mkdir -p ${shellEscape(remoteDir)}`)
    if (mkdirResult.code !== 0) {
      throw new Error(mkdirResult.stderr || `Failed to prepare ${remoteDir}`)
    }

    await ssh.putFile(tempFile, remotePath)
  } finally {
    await unlink(tempFile).catch(() => undefined)
  }
}

export async function writeRemoteTempFile(ssh: NodeSSH, remotePath: string, content: string): Promise<string> {
  const tempFile = join(tmpdir(), `launchpad-remote-${randomUUID()}.tmp`)
  const remoteTempPath = `${remotePath}.launchpad-${randomUUID()}.tmp`

  try {
    await writeFile(tempFile, content, 'utf8')

    const remoteDir = posix.dirname(remotePath)
    const mkdirResult = await execCommand(ssh, `mkdir -p ${shellEscape(remoteDir)}`)
    if (mkdirResult.code !== 0) {
      throw new Error(mkdirResult.stderr || `Failed to prepare ${remoteDir}`)
    }

    await ssh.putFile(tempFile, remoteTempPath)
    return remoteTempPath
  } finally {
    await unlink(tempFile).catch(() => undefined)
  }
}

export async function backupRemoteFile(ssh: NodeSSH, remotePath: string): Promise<string> {
  const backupPath = `${remotePath}.launchpad-backup-${Date.now()}`
  const result = await execCommand(ssh, `cp ${shellEscape(remotePath)} ${shellEscape(backupPath)}`)
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to back up ${remotePath}`)
  }

  return backupPath
}
