import type { Server, ServerResourceStatus } from '@launchpad/shared'
import { execCommand, getConnection } from './ssh'

function parseResourceSnapshot(output: string, serverId: string): ServerResourceStatus {
  const [memoryLine = '', diskLine = ''] = output
    .trim()
    .split('\n')
    .map((line) => line.trim())

  const [totalKbRaw, availableKbRaw] = memoryLine.split(/\s+/).map((value) => Number(value))
  const [diskTotalRaw, diskUsedRaw] = diskLine.split(/\s+/).map((value) => Number(value))

  if (!Number.isFinite(totalKbRaw) || !Number.isFinite(availableKbRaw) || totalKbRaw <= 0 || availableKbRaw < 0) {
    throw new Error('Failed to parse server memory usage')
  }

  if (!Number.isFinite(diskTotalRaw) || !Number.isFinite(diskUsedRaw) || diskTotalRaw <= 0 || diskUsedRaw < 0) {
    throw new Error('Failed to parse server disk usage')
  }

  const memoryTotalBytes = totalKbRaw * 1024
  const memoryUsedBytes = Math.max(0, (totalKbRaw - availableKbRaw) * 1024)
  const diskTotalBytes = diskTotalRaw
  const diskUsedBytes = Math.max(0, diskUsedRaw)

  return {
    serverId,
    memoryTotalBytes,
    memoryUsedBytes,
    diskTotalBytes,
    diskUsedBytes,
    checkedAt: new Date().toISOString(),
  }
}

export async function fetchServerResources(server: Server): Promise<ServerResourceStatus> {
  let ssh: Awaited<ReturnType<typeof getConnection>> | null = null

  try {
    ssh = await getConnection(server)
    const result = await execCommand(
      ssh,
      "awk '/MemTotal:/ { total=$2 } /MemAvailable:/ { available=$2 } END { printf \"%s %s\\n\", total, available }' /proc/meminfo && df -B1 --output=size,used / | tail -n 1"
    )

    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || 'Failed to read server resources')
    }

    return parseResourceSnapshot(result.stdout, server.id)
  } finally {
    ssh?.dispose()
  }
}
