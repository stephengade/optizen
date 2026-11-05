export interface MemoryBreakdown {
  totalBytes: number
  /** Memory actually held by programs (total − available) */
  usedBytes: number
  /** What the kernel can hand out right now without swapping (MemAvailable) */
  availableBytes: number
  freeBytes: number
  /** Page cache + buffers + reclaimable slab — released automatically under pressure */
  cacheBytes: number
  /** tmpfs / shared memory — counted as cache but NOT freed by dropping caches */
  sharedBytes: number
  swapTotalBytes: number
  swapUsedBytes: number
}

export interface MemoryProcess {
  pid: number
  user: string
  rssBytes: number
  memPercent: number
  cpuPercent: number
  command: string
  args: string
  /** Set when the process runs inside a Docker container */
  containerName?: string
  /** Launchpad refuses to kill these (sshd, systemd, dockerd, …) */
  protected: boolean
}

export interface MemoryProcessGroup {
  command: string
  processCount: number
  rssBytes: number
}

export interface MemoryContainer {
  id: string
  name: string
  image?: string
  usageBytes: number
  limitBytes?: number
  memPercent?: number
  cpuPercent?: number
}

export interface MemoryReport {
  serverId: string
  checkedAt: string
  breakdown: MemoryBreakdown
  topProcesses: MemoryProcess[]
  groups: MemoryProcessGroup[]
  containers: MemoryContainer[]
  dockerAvailable: boolean
  /** Whether Launchpad can run privileged actions (root or passwordless sudo) */
  canElevate: boolean
  /** The kernel's OOM killer fired recently (from dmesg/journal, if readable) */
  recentOomKills: string[]
}

export interface MemoryActionResult {
  success: boolean
  output: string
  availableBeforeBytes?: number
  availableAfterBytes?: number
}
