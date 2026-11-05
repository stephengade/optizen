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

const SSH_CONNECT_ATTEMPTS = [20_000, 40_000] as const

function isRetryableHandshakeError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return (
    message.includes('timed out while waiting for handshake') ||
    message.includes('connection lost before handshake') ||
    message.includes('handshake failed')
  )
}

function describeConnectionFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return 'SSH connection failed'
  }

  const message = error.message.trim()
  if (isRetryableHandshakeError(error)) {
    return `${message}. The SSH server did not complete the handshake in time. Check the host, port, firewall, and whether the server is reachable from Launchpad.`
  }

  const lower = message.toLowerCase()
  if (lower.includes('no passphrase given')) {
    return 'This SSH key is protected by a passphrase. Edit the server and enter the key passphrase.'
  }
  if (lower.includes('bad passphrase') || lower.includes('bad decrypt') || lower.includes('failed to decrypt')) {
    return 'The SSH key passphrase is incorrect. Edit the server and re-enter the key passphrase.'
  }
  if (lower.includes('cannot parse privatekey') || lower.includes('unsupported key format')) {
    return `${message}. The key file is not a supported private key, or the passphrase is wrong.`
  }
  if (lower.includes('all configured authentication methods failed')) {
    return 'The server rejected the SSH key. Check the SSH user and that the matching public key is in ~/.ssh/authorized_keys on the server.'
  }

  return message
}

export interface SshConnectionConfig {
  host: string
  port: number
  user: string
  sshKeyPath: string
  /** Plaintext passphrase (already decrypted) */
  passphrase?: string
}

function readPrivateKey(keyPath: string) {
  try {
    return readFileSync(keyPath, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') {
      throw new Error(
        `SSH key file not found at ${keyPath}. The path is read on the machine running the Launchpad API (inside its container when deployed with Docker).`
      )
    }
    if (code === 'EACCES') {
      throw new Error(`Launchpad cannot read the SSH key at ${keyPath} (permission denied).`)
    }
    throw error
  }
}

/**
 * Get an authenticated SSH connection for a server.
 * Private keys are read from disk at runtime — never stored in the DB.
 */
export async function getConnection(server: Server): Promise<NodeSSH> {
  return getConnectionFromConfig({
    host: server.host,
    port: server.port,
    user: server.user,
    sshKeyPath: server.sshKeyPath,
    passphrase: server.sshPassphrase ? decrypt(server.sshPassphrase) : undefined,
  })
}

export async function getConnectionFromConfig(config: SshConnectionConfig): Promise<NodeSSH> {
  const privateKey = readPrivateKey(config.sshKeyPath)
  const passphrase = config.passphrase || undefined

  async function connectWithTimeout(readyTimeout: number) {
    const ssh = new NodeSSH()
    let timer: NodeJS.Timeout | undefined

    try {
      await Promise.race([
        ssh.connect({
          host: config.host,
          port: config.port,
          username: config.user,
          privateKey,
          passphrase,
          readyTimeout,
          keepaliveInterval: 10_000,
          keepaliveCountMax: 3,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`SSH connection timed out after ${Math.round(readyTimeout / 1000)}s before the session became ready`))
          }, readyTimeout + 5_000)
        }),
      ])

      return ssh
    } catch (error) {
      ssh.dispose()
      throw error
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }

  let lastError: unknown

  for (let index = 0; index < SSH_CONNECT_ATTEMPTS.length; index += 1) {
    try {
      return await connectWithTimeout(SSH_CONNECT_ATTEMPTS[index])
    } catch (error) {
      lastError = error
      if (!isRetryableHandshakeError(error) || index === SSH_CONNECT_ATTEMPTS.length - 1) {
        break
      }
    }
  }

  throw new Error(describeConnectionFailure(lastError))
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
  let passphrase: string | undefined
  try {
    passphrase = server.sshPassphrase ? decrypt(server.sshPassphrase) : undefined
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : 'Failed to decrypt the stored passphrase' }
  }

  return testConnectionConfig({
    host: server.host,
    port: server.port,
    user: server.user,
    sshKeyPath: server.sshKeyPath,
    passphrase,
  })
}

export async function testConnectionConfig(config: SshConnectionConfig): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now()
  let ssh: NodeSSH | null = null

  try {
    ssh = await getConnectionFromConfig(config)
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
