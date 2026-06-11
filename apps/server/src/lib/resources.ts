import type { Server, ServerResourceStatus } from '@launchpad/shared'
import { execCommand, getConnection } from './ssh'

function parseResourceSnapshot(output: string, serverId: string): ServerResourceStatus {
  const [cpuLine = '', memoryLine = '', diskLine = '', loadLine = '', uptimeLine = '', inodeLine = '', containerLine = ''] = output
    .trim()
    .split('\n')
    .map((line) => line.trim())

  const cpuUsagePercent = Number(cpuLine)
  const [totalKbRaw, availableKbRaw] = memoryLine.split(/\s+/).map((value) => Number(value))
  const [diskTotalRaw, diskUsedRaw] = diskLine.split(/\s+/).map((value) => Number(value))
  const loadAverage = loadLine.split(/\s+/).map((value) => Number(value)) as [number, number, number]
  const uptimeSeconds = Number(uptimeLine)
  const inodeUsedPercent = Number(inodeLine)
  const [runningContainersRaw, exitedContainersRaw] = containerLine.split(/\s+/).map((value) => Number(value))

  if (!Number.isFinite(cpuUsagePercent) || cpuUsagePercent < 0) {
    throw new Error('Failed to parse server CPU usage')
  }

  if (!Number.isFinite(totalKbRaw) || !Number.isFinite(availableKbRaw) || totalKbRaw <= 0 || availableKbRaw < 0) {
    throw new Error('Failed to parse server memory usage')
  }

  if (!Number.isFinite(diskTotalRaw) || !Number.isFinite(diskUsedRaw) || diskTotalRaw <= 0 || diskUsedRaw < 0) {
    throw new Error('Failed to parse server disk usage')
  }

  if (loadAverage.some((value) => !Number.isFinite(value)) || loadAverage.length !== 3) {
    throw new Error('Failed to parse load average')
  }

  if (!Number.isFinite(uptimeSeconds) || uptimeSeconds < 0) {
    throw new Error('Failed to parse uptime')
  }

  if (!Number.isFinite(inodeUsedPercent) || inodeUsedPercent < 0) {
    throw new Error('Failed to parse inode pressure')
  }

  if (!Number.isFinite(runningContainersRaw) || !Number.isFinite(exitedContainersRaw)) {
    throw new Error('Failed to parse container status')
  }

  const memoryTotalBytes = totalKbRaw * 1024
  const memoryUsedBytes = Math.max(0, (totalKbRaw - availableKbRaw) * 1024)
  const diskTotalBytes = diskTotalRaw
  const diskUsedBytes = Math.max(0, diskUsedRaw)

  return {
    serverId,
    cpuUsagePercent,
    memoryTotalBytes,
    memoryUsedBytes,
    diskTotalBytes,
    diskUsedBytes,
    uptimeSeconds,
    loadAverage,
    diskInodesUsedPercent: inodeUsedPercent,
    runningContainers: runningContainersRaw,
    exitedContainers: exitedContainersRaw,
    checkedAt: new Date().toISOString(),
  }
}

export async function fetchServerResources(server: Server): Promise<ServerResourceStatus> {
  let ssh: Awaited<ReturnType<typeof getConnection>> | null = null

  try {
    ssh = await getConnection(server)
    const result = await execCommand(
      ssh,
      "awk 'BEGIN { prevIdle=0; prevTotal=0 } /^cpu / { idle=$5; total=0; for (i=2; i<=8; i++) total+=$i; if (NR==1) { prevIdle=idle; prevTotal=total } } END { if (total > 0) printf \"%.2f\\n\", ((total-idle)/(total))*100; else print \"0\" }' /proc/stat && awk '/MemTotal:/ { total=$2 } /MemAvailable:/ { available=$2 } END { printf \"%s %s\\n\", total, available }' /proc/meminfo && df -B1 --output=size,used / | tail -n 1 && awk '{print $1, $2, $3}' /proc/loadavg && cut -d. -f1 /proc/uptime && df -i --output=pcent / | tail -n 1 | tr -dc '0-9\\n' && printf \"%s %s\\n\" \"$(docker ps -q | wc -l)\" \"$(docker ps -aq -f status=exited | wc -l)\""
    )

    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || 'Failed to read server resources')
    }

    return parseResourceSnapshot(result.stdout, server.id)
  } finally {
    ssh?.dispose()
  }
}
