'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Server } from '@launchpad/shared'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal'
import { LoadingState } from '@/components/ui/LoadingState'
import { ReauthModal } from '@/components/ui/ReauthModal'
import { api, ApiError, isReauthRequiredError } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import { formatRelative } from '@/lib/utils'
import { useDemoPrivacy } from '@/lib/demo-privacy-context'
import { demoServers, isDemoId } from '@/lib/demo-fixtures'

type StorageAuditItem = {
  key: string
  label: string
  path: string
  note: string
  sizeBytes: number
  breakdown?: Array<{ path: string; sizeBytes: number }>
}

type ServerStorageAudit = {
  checkedAt: string
  dockerAvailable: boolean
  items: StorageAuditItem[]
  dockerSystemDf?: string
  diagnostics?: Array<{ step: string; message: string }>
  cleanupCommands: string[]
}

type ServerStorageCleanupResult = {
  output: string
  reclaimedBytes: number
  afterAudit: ServerStorageAudit
}

type DockerUsageImage = {
  id: string
  repository: string
  tag: string
  reference: string
  createdSince: string
  sizeText: string
  sizeBytes: number
  inUse: boolean
  containerCount: number
}

type DockerUsageContainer = {
  id: string
  name: string
  image: string
  status: string
  running: boolean
}

type DockerUsageReport = {
  checkedAt: string
  dockerAvailable: boolean
  summaryText: string
  reclaimableBytes: number
  images: DockerUsageImage[]
  containers: DockerUsageContainer[]
  diagnostics: Array<{ step: string; message: string }>
}

const DEMO_AUDIT: ServerStorageAudit = {
  checkedAt: new Date().toISOString(),
  dockerAvailable: true,
  items: [
    {
      key: 'docker_root',
      label: 'Docker data',
      path: '/var/lib/docker',
      note: 'Images, layers, volumes, and container metadata managed by Docker.',
      sizeBytes: 82 * 1024 * 1024 * 1024,
    },
    {
      key: 'containerd_root',
      label: 'containerd data',
      path: '/var/lib/containerd',
      note: 'Runtime content store and snapshots used underneath Docker/containerd.',
      sizeBytes: 31 * 1024 * 1024 * 1024,
    },
    {
      key: 'journal_logs',
      label: 'systemd journal',
      path: '/var/log/journal',
      note: 'Persisted system logs that can quietly grow over time.',
      sizeBytes: 3.4 * 1024 * 1024 * 1024,
    },
  ],
  dockerSystemDf:
    'TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE\nImages          18        7         54.2GB    29.8GB (54%)\nContainers      9         7         1.1GB     210MB (19%)\nLocal Volumes   12        8         9.4GB     2.3GB (24%)\nBuild Cache     6         0         12.8GB    12.8GB',
  cleanupCommands: [
    'docker image prune -f',
    'docker container prune -f',
    'docker builder prune -af',
    'journalctl --vacuum-time=7d',
    'apt-get clean',
  ],
}

function formatApiDebugError(error: ApiError) {
  if (!error.rawBody) {
    return `HTTP ${error.status}: ${error.message}`
  }

  try {
    const parsed = JSON.parse(error.rawBody) as Record<string, unknown>
    return `HTTP ${error.status}: ${error.message}\n\n${JSON.stringify(parsed, null, 2)}`
  } catch {
    return `HTTP ${error.status}: ${error.message}\n\n${error.rawBody}`
  }
}

async function requestInternalStorageAudit(serverId: string): Promise<ServerStorageAudit> {
  const response = await fetch(`/internal/storage-audit/${serverId}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const rawBody = await response.text().catch(() => '')

  if (!response.ok) {
    let message = response.statusText || 'Request failed'
    if (rawBody) {
      try {
        const parsed = JSON.parse(rawBody) as { message?: string }
        message = parsed.message ?? message
      } catch {
        message = rawBody
      }
    }

    throw new ApiError(response.status, undefined, message, rawBody || undefined)
  }

  return JSON.parse(rawBody) as ServerStorageAudit
}

export default function StoragePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { demoMode } = useDemoPrivacy()

  const [servers, setServers] = useState<Server[]>([])
  const [serversLoading, setServersLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')

  const [audit, setAudit] = useState<ServerStorageAudit | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditing, setAuditing] = useState(false)
  const [deepAuditRan, setDeepAuditRan] = useState(false)

  const [cleaning, setCleaning] = useState(false)
  const [deepCleaning, setDeepCleaning] = useState(false)
  const [dockerUsage, setDockerUsage] = useState<DockerUsageReport | null>(null)
  const [dockerUsageLoading, setDockerUsageLoading] = useState(false)
  const [runningMaintenancePrune, setRunningMaintenancePrune] = useState(false)
  const [restartingService, setRestartingService] = useState<'docker' | 'containerd' | null>(null)
  const [pruningVolumes, setPruningVolumes] = useState(false)
  const [pruningExitedContainers, setPruningExitedContainers] = useState(false)
  const [removingImageId, setRemovingImageId] = useState<string | null>(null)
  const [removeImageTarget, setRemoveImageTarget] = useState<DockerUsageImage | null>(null)
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false)
  const [deepCleanupConfirmOpen, setDeepCleanupConfirmOpen] = useState(false)
  const [pruneExitedConfirmOpen, setPruneExitedConfirmOpen] = useState(false)
  const [volumePruneConfirmOpen, setVolumePruneConfirmOpen] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)

  // Load servers list
  useEffect(() => {
    async function loadServers() {
      if (demoMode) {
        setServers(demoServers)
        setServersLoading(false)
        return
      }
      try {
        const data = await api.get<Server[]>('/servers')
        setServers(data)
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : 'Failed to load servers')
      } finally {
        setServersLoading(false)
      }
    }
    void loadServers()
  }, [demoMode])

  // Pick server from query param only — don't auto-select
  useEffect(() => {
    if (servers.length === 0) return
    const fromQuery = searchParams.get('server')
    if (fromQuery) {
      const match = servers.find((s) => s.id === fromQuery)
      if (match) setSelectedId(match.id)
    }
  }, [servers, searchParams])

  // Load fast overview whenever selected server changes
  useEffect(() => {
    if (!selectedId) return
    void loadOverview()
  }, [selectedId])

  useEffect(() => {
    if (!selectedId || demoMode) {
      setDockerUsage(null)
      return
    }
    void loadDockerUsage()
  }, [selectedId, demoMode])

  function selectServer(id: string) {
    setSelectedId(id)
    setAudit(null)
    setAuditError(null)
    setDockerUsage(null)
    setDeepAuditRan(false)
    router.replace(`/storage?server=${id}`, { scroll: false })
  }

  async function loadOverview(showError = false) {
    if (!selectedId) return

    if (demoMode && isDemoId(selectedId)) {
      setAudit(DEMO_AUDIT)
      setAuditError(null)
      setAuditLoading(false)
      return
    }

    setAuditLoading(true)
    setAuditing(true)
    try {
      const data = await api.get<ServerStorageAudit>(`/servers/${selectedId}/storage-overview`)
      setAudit(data)
      setAuditError(null)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? formatApiDebugError(error)
          : error instanceof Error
            ? error.message
            : 'Failed to audit server storage'
      setAuditError(message)
      if (showError) {
        toast.error(error instanceof ApiError ? `${error.status} ${error.message}` : 'Failed to audit storage')
      }
    } finally {
      setAuditLoading(false)
      setAuditing(false)
    }
  }

  async function loadDeepAudit(showError = false) {
    if (!selectedId) return

    if (demoMode && isDemoId(selectedId)) {
      setAudit(DEMO_AUDIT)
      setAuditError(null)
      setDeepAuditRan(true)
      return
    }

    setAuditLoading(true)
    setAuditing(true)
    try {
      const data = await requestInternalStorageAudit(selectedId)
      setAudit(data)
      setAuditError(null)
      setDeepAuditRan(true)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? formatApiDebugError(error)
          : error instanceof Error
            ? error.message
            : 'Failed to audit server storage'
      setAuditError(message)
      if (showError) {
        toast.error(error instanceof ApiError ? `${error.status} ${error.message}` : 'Failed to run deep audit')
      }
    } finally {
      setAuditLoading(false)
      setAuditing(false)
    }
  }

  async function loadDockerUsage(showError = false) {
    if (!selectedId || demoMode) return

    setDockerUsageLoading(true)
    try {
      const data = await api.get<DockerUsageReport>(`/servers/${selectedId}/docker-usage`)
      setDockerUsage(data)
    } catch (error) {
      if (showError) {
        toast.error(error instanceof ApiError ? error.message : 'Failed to inspect Docker usage')
      }
    } finally {
      setDockerUsageLoading(false)
    }
  }

  async function handleCleanup() {
    if (demoMode) { toast.success('Demo mode — read-only.'); return }
    setCleaning(true)
    try {
      const result = await api.post<ServerStorageCleanupResult>(`/servers/${selectedId}/storage-cleanup`)
      setAudit(result.afterAudit ?? audit)
      void loadDockerUsage()
      toast.success(result.reclaimedBytes > 0 ? `Reclaimed ${formatBytes(result.reclaimedBytes)}.` : result.output || 'Cleanup completed')
      if (!deepAuditRan) {
        void loadOverview()
      }
    } catch (error) {
      if (isReauthRequiredError(error)) { setReauthOpen(true); toast.error('Verify your session to run cleanup.'); return }
      toast.error(error instanceof ApiError ? error.message : 'Cleanup failed')
    } finally {
      setCleaning(false)
    }
  }

  async function handleDeepCleanup() {
    if (demoMode) { toast.success('Demo mode — read-only.'); return }
    setDeepCleaning(true)
    try {
      const result = await api.post<ServerStorageCleanupResult>(`/servers/${selectedId}/storage-deep-cleanup`)
      setAudit(result.afterAudit ?? audit)
      void loadDockerUsage()
      toast.success(result.reclaimedBytes > 0 ? `Reclaimed ${formatBytes(result.reclaimedBytes)}.` : result.output || 'Deep cleanup completed')
      if (!deepAuditRan) {
        void loadOverview()
      }
    } catch (error) {
      if (isReauthRequiredError(error)) { setReauthOpen(true); toast.error('Verify your session to run cleanup.'); return }
      toast.error(error instanceof ApiError ? error.message : 'Deep cleanup failed')
    } finally {
      setDeepCleaning(false)
    }
  }

  async function handlePruneExitedContainers() {
    if (demoMode || !selectedId) { toast.success('Demo mode — read-only.'); return }
    setPruningExitedContainers(true)
    try {
      const result = await api.post<{ output: string }>(`/servers/${selectedId}/docker-prune-exited-containers`)
      await Promise.all([loadDockerUsage(), loadDeepAudit()])
      toast.success(result.output || 'Exited containers removed')
    } catch (error) {
      if (isReauthRequiredError(error)) { setReauthOpen(true); toast.error('Verify your session to prune exited containers.'); return }
      toast.error(error instanceof ApiError ? error.message : 'Failed to prune exited containers')
    } finally {
      setPruningExitedContainers(false)
    }
  }

  async function handleRemoveImage() {
    if (demoMode || !selectedId || !removeImageTarget) { toast.success('Demo mode — read-only.'); return }
    setRemovingImageId(removeImageTarget.id)
    try {
      const result = await api.post<{ output: string }>(`/servers/${selectedId}/docker-remove-image`, {
        imageId: removeImageTarget.id,
      })
      setRemoveImageTarget(null)
      await Promise.all([loadDockerUsage(), loadDeepAudit()])
      toast.success(result.output || 'Docker image removed')
    } catch (error) {
      if (isReauthRequiredError(error)) { setReauthOpen(true); toast.error('Verify your session to remove this image.'); return }
      toast.error(error instanceof ApiError ? error.message : 'Failed to remove Docker image')
    } finally {
      setRemovingImageId(null)
    }
  }

  async function handleRunMaintenancePrune() {
    if (demoMode || !selectedId) { toast.success('Demo mode — read-only.'); return }
    setRunningMaintenancePrune(true)
    try {
      const result = await api.post<{ output: string }>(`/servers/${selectedId}/maintenance/run-safe-prune`)
      await Promise.all([loadDockerUsage(), loadDeepAudit()])
      toast.success(result.output || 'Safe prune completed')
    } catch (error) {
      if (isReauthRequiredError(error)) { setReauthOpen(true); toast.error('Verify your session to run maintenance prune.'); return }
      toast.error(error instanceof ApiError ? error.message : 'Failed to run safe prune')
    } finally {
      setRunningMaintenancePrune(false)
    }
  }

  async function handleRestartService(service: 'docker' | 'containerd') {
    if (demoMode || !selectedId) { toast.success('Demo mode — read-only.'); return }
    setRestartingService(service)
    try {
      const result = await api.post<{ output: string }>(`/servers/${selectedId}/restart-service`, { service })
      await Promise.all([loadDockerUsage(), loadOverview()])
      toast.success(result.output || `${service} restarted`)
    } catch (error) {
      if (isReauthRequiredError(error)) { setReauthOpen(true); toast.error(`Verify your session to restart ${service}.`); return }
      toast.error(error instanceof ApiError ? error.message : `Failed to restart ${service}`)
    } finally {
      setRestartingService(null)
    }
  }

  async function handleVolumePrune() {
    if (demoMode || !selectedId) { toast.success('Demo mode — read-only.'); return }
    setPruningVolumes(true)
    try {
      const result = await api.post<{ output: string }>(`/servers/${selectedId}/docker-volume-prune`)
      await Promise.all([loadDockerUsage(), loadDeepAudit()])
      toast.success(result.output || 'Docker volumes pruned')
    } catch (error) {
      if (isReauthRequiredError(error)) { setReauthOpen(true); toast.error('Verify your session to prune Docker volumes.'); return }
      toast.error(error instanceof ApiError ? error.message : 'Failed to prune Docker volumes')
    } finally {
      setPruningVolumes(false)
    }
  }

  const selectedServer = servers.find((s) => s.id === selectedId)
  const exitedContainers = dockerUsage?.containers.filter((container) => !container.running) ?? []
  const runningContainers = dockerUsage?.containers.filter((container) => container.running) ?? []
  const removableImages = dockerUsage?.images.filter((image) => !image.inUse) ?? []

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 lg:px-8 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-(--text)">Storage</h1>
          <p className="mt-1 text-sm text-(--text-muted)">Load a fast storage overview first, then run a deeper directory scan only when you need it.</p>
        </div>
        {selectedId && audit && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => void loadOverview(true)} loading={auditing && !deepAuditRan}>
              Refresh overview
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void loadDeepAudit(true)} loading={auditing && deepAuditRan}>
              Run deep audit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCleanupConfirmOpen(true)} loading={cleaning}>
              Safe prune
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeepCleanupConfirmOpen(true)} loading={deepCleaning}>
              System prune -a
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void loadDockerUsage(true)} loading={dockerUsageLoading}>
              Inspect Docker
            </Button>
          </div>
        )}
      </div>

      {/* Server picker */}
      {serversLoading ? (
        <LoadingState label="Loading servers" compact />
      ) : servers.length === 0 ? (
        <div className="border rounded-(--radius) border-dashed border-(--border) px-5 py-8 text-center text-sm text-(--text-muted)">
          No servers found. Add a server first.
        </div>
      ) : (
        <div className="border rounded-(--radius) border-(--border) divide-y divide-(--border)">
          {servers.map((server) => {
            const isSelected = selectedId === server.id
            return (
              <button
                key={server.id}
                type="button"
                onClick={() => selectServer(server.id)}
                className={`w-full flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'bg-(--surface-2) text-(--text)'
                    : 'bg-(--surface) text-(--text-muted) hover:text-(--text) hover:bg-(--surface-2)'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 w-1.5 h-1.5 ${isSelected ? 'bg-(--accent)' : 'bg-(--border)'}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{server.name}</div>
                    <div className="text-xs font-mono text-(--text-muted) truncate">{server.host}</div>
                  </div>
                </div>
                {isSelected && (
                  <span className="text-[11.5px] font-medium text-(--accent) shrink-0">Selected</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Prompt when no server selected */}
      {!serversLoading && servers.length > 0 && !selectedId && (
        <div className="border rounded-(--radius) border-dashed border-(--border) px-5 py-8 text-center text-sm text-(--text-muted)">
          Select a server above to load its storage audit.
        </div>
      )}

      {/* Audit content */}
      {selectedId && (
        <>
          {auditLoading ? (
            <LoadingState
              label={`${deepAuditRan ? 'Running deep audit' : 'Loading storage overview'} for ${selectedServer?.name ?? 'server'}`}
              detail={deepAuditRan ? 'Scanning host directories and larger storage buckets. This can take longer on busy hosts.' : 'Reading root disk usage and Docker summary without scanning large directory trees.'}
            />
          ) : auditError && !audit ? (
            <div className="border rounded-(--radius) border-(--border) bg-(--surface) px-5 py-5 space-y-3">
              <div className="text-sm font-medium text-(--text)">Audit unavailable</div>
              <p className="text-sm text-(--text-muted)">Could not retrieve storage data. Common causes:</p>
              <ul className="text-sm text-(--text-muted) space-y-1">
                <li className="flex items-start gap-2"><span className="text-(--text-subtle)">·</span>The server process restarted — sign out and back in to reload the session key</li>
                <li className="flex items-start gap-2"><span className="text-(--text-subtle)">·</span>SSH connection failed — test the connection from the server page first</li>
                <li className="flex items-start gap-2"><span className="text-(--text-subtle)">·</span>The SSH key path is invalid or the key file is missing</li>
                <li className="flex items-start gap-2"><span className="text-(--text-subtle)">·</span>The SSH user lacks permission to inspect root-owned directories like <span className="font-mono">/var/lib/containerd</span> or <span className="font-mono">/var/lib/docker</span></li>
              </ul>
              <div className="font-mono text-xs text-(--text-muted) border rounded-(--radius) border-(--border) bg-(--surface-2) px-3 py-2 whitespace-pre-wrap">
                {auditError}
              </div>
            </div>
          ) : audit ? (
            <>
              {auditError ? (
                <div className="border rounded-(--radius) border-(--red) bg-[rgba(239,68,68,0.08)] px-4 py-3">
                  <div className="text-[12.5px] font-medium text-(--red) mb-2">
                    {deepAuditRan ? 'Deep Audit Error' : 'Storage Error'}
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-(--text)">{auditError}</pre>
                </div>
              ) : null}

              <div className="border rounded-(--radius) border-(--border) bg-(--surface) px-4 py-3 text-sm text-(--text-muted)">
                {deepAuditRan
                  ? 'Deep audit mode. Directory sizes may take longer to compute, especially for containerd and Docker data roots.'
                  : 'Fast overview mode. This uses root filesystem metadata and Docker summary for a quick read without recursive directory scans.'}
              </div>

              {/* Top buckets */}
              <div className="grid gap-px md:grid-cols-3 border rounded-(--radius) border-(--border)">
                {audit.items.slice(0, 3).map((item) => (
                  <div key={item.key} className="px-4 py-4 bg-(--surface)">
                    <div className="text-[11.5px] font-medium text-(--text-muted)">{item.label}</div>
                    <div className="mt-1 text-xl font-semibold text-(--text)">{formatBytes(item.sizeBytes)}</div>
                    <div className="mt-0.5 text-xs font-mono text-(--text-muted) truncate">{item.path}</div>
                  </div>
                ))}
              </div>

              {/* Full breakdown */}
              {audit.items.length > 0 && (
                <div className="border rounded-(--radius) border-(--border) bg-(--surface) divide-y divide-(--border)">
                  <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2 text-[11.5px] font-medium text-(--text-muted)">
                    <span>Path</span>
                    <span>Size</span>
                  </div>
                  {audit.items.map((item) => (
                    <div key={item.key} className="px-4 py-3">
                      <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                        <div>
                          <div className="text-sm font-medium text-(--text)">{item.label}</div>
                          <div className="mt-0.5 text-xs font-mono text-(--text-muted)">{item.path}</div>
                          <div className="mt-1 text-xs text-(--text-muted)">{item.note}</div>
                          {item.breakdown?.length ? (
                            <div className="mt-2 space-y-1 pl-2 border-l border-(--border)">
                              {item.breakdown.map((entry) => (
                                <div key={`${item.key}-${entry.path}`} className="flex items-center justify-between gap-4 text-xs">
                                  <span className="font-mono text-(--text-muted) truncate">{entry.path}</span>
                                  <span className="text-(--text) shrink-0">{formatBytes(entry.sizeBytes)}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-sm font-semibold text-(--text) whitespace-nowrap">{formatBytes(item.sizeBytes)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* docker system df */}
              {audit.dockerSystemDf ? (
                <div className="border rounded-(--radius) border-(--border) bg-[#0b0b0d]">
                  <div className="border-b border-(--border) px-4 py-2 text-[11.5px] font-medium text-(--text-muted)">
                    docker system df
                  </div>
                  <pre data-sensitive="true" className="px-4 py-3 whitespace-pre-wrap font-mono text-xs text-(--text)">
                    {audit.dockerSystemDf}
                  </pre>
                </div>
              ) : (
                <div className="border rounded-(--radius) border-dashed border-(--border) px-4 py-4 text-sm text-(--text-muted)">
                  Docker disk usage details are unavailable on this host.
                </div>
              )}

              {dockerUsage?.dockerAvailable ? (
                <div className="space-y-4">
                  <div className="border rounded-(--radius) border-(--border) bg-(--surface)">
                    <div className="border-b border-(--border) px-4 py-3">
                      <div className="text-[11.5px] font-medium text-(--text-muted)">Maintenance</div>
                      <div className="mt-1 text-sm text-(--text-muted)">
                        Run maintenance actions on demand from Launchpad without leaving the app.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 px-4 py-4">
                      <Button variant="ghost" size="sm" onClick={() => void handleRunMaintenancePrune()} loading={runningMaintenancePrune}>
                        Run safe prune now
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void handleRestartService('docker')} loading={restartingService === 'docker'}>
                        Restart docker
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void handleRestartService('containerd')} loading={restartingService === 'containerd'}>
                        Restart containerd
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-(--radius) border-(--border) bg-(--surface)">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-(--border) px-4 py-3">
                      <div>
                        <div className="text-[11.5px] font-medium text-(--text-muted)">Docker Cleanup</div>
                        <div className="mt-1 text-sm text-(--text-muted)">
                          Use this section to remove stopped-container references and delete old images directly from Launchpad.
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setPruneExitedConfirmOpen(true)} loading={pruningExitedContainers}>
                          Prune exited containers
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void loadDockerUsage(true)} loading={dockerUsageLoading}>
                          Refresh Docker
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-px md:grid-cols-3 border-b border-(--border)">
                      <div className="bg-(--surface) px-4 py-4">
                        <div className="text-[11.5px] font-medium text-(--text-muted)">Reclaimable now</div>
                        <div className="mt-1 text-xl font-semibold text-(--text)">{formatBytes(dockerUsage.reclaimableBytes)}</div>
                        <div className="mt-0.5 text-xs text-(--text-muted)">From Docker&apos;s own reclaimable estimate.</div>
                      </div>
                      <div className="bg-(--surface) px-4 py-4">
                        <div className="text-[11.5px] font-medium text-(--text-muted)">Exited containers</div>
                        <div className="mt-1 text-xl font-semibold text-(--text)">{exitedContainers.length}</div>
                        <div className="mt-0.5 text-xs text-(--text-muted)">Stopped containers can keep old images from being removable.</div>
                      </div>
                      <div className="bg-(--surface) px-4 py-4">
                        <div className="text-[11.5px] font-medium text-(--text-muted)">Tracked images</div>
                        <div className="mt-1 text-xl font-semibold text-(--text)">{dockerUsage.images.length}</div>
                        <div className="mt-0.5 text-xs text-(--text-muted)">Largest image layers on this host, sorted by size.</div>
                      </div>
                    </div>

                    {dockerUsage.images.length > 0 && removableImages.length === 0 ? (
                      <div className="border-b border-(--border) bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm text-(--text-muted)">
                        All currently tracked Docker images are still referenced by containers on this host. That is why prune can return <span className="font-mono text-(--text)">0 B removed</span> even when Docker data is large.
                      </div>
                    ) : null}

                    <div className="divide-y divide-(--border)">
                      {dockerUsage.images.length > 0 ? dockerUsage.images.map((image) => (
                        <div key={image.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-medium text-(--text) break-all">{image.reference}</div>
                              <span className={`text-[11.5px] font-medium ${image.inUse ? 'text-(--green)' : 'text-(--yellow)'}`}>
                                {image.inUse ? `In use by ${image.containerCount} container${image.containerCount === 1 ? '' : 's'}` : 'Unused'}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--text-muted)">
                              <span className="font-mono">{image.id}</span>
                              <span>{image.sizeText}</span>
                              <span>{image.createdSince}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 md:justify-end">
                            <div className="text-sm font-semibold text-(--text) whitespace-nowrap">{formatBytes(image.sizeBytes)}</div>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={image.inUse}
                              loading={removingImageId === image.id}
                              onClick={() => setRemoveImageTarget(image)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      )) : (
                        <div className="px-4 py-4 text-sm text-(--text-muted)">
                          No Docker images were returned for this host.
                        </div>
                      )}
                    </div>
                  </div>

                  {exitedContainers.length > 0 ? (
                    <div className="border rounded-(--radius) border-(--border) bg-(--surface)">
                      <div className="border-b border-(--border) px-4 py-2 text-[11.5px] font-medium text-(--text-muted)">
                        Exited Containers
                      </div>
                      <div className="divide-y divide-(--border)">
                        {exitedContainers.map((container) => (
                          <div key={container.id} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-(--text)">{container.name}</div>
                              <div className="mt-1 text-xs font-mono text-(--text-muted) break-all">{container.image}</div>
                            </div>
                            <div className="text-xs text-(--text-muted) md:text-right">
                              <div>{container.status}</div>
                              <div className="mt-1 font-mono">{container.id}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {runningContainers.length > 0 ? (
                    <div className="border rounded-(--radius) border-(--border) bg-(--surface)">
                      <div className="border-b border-(--border) px-4 py-2 text-[11.5px] font-medium text-(--text-muted)">
                        Running Containers Holding Images
                      </div>
                      <div className="divide-y divide-(--border)">
                        {runningContainers.map((container) => (
                          <div key={container.id} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-(--text)">{container.name}</div>
                              <div className="mt-1 text-xs font-mono text-(--text-muted) break-all">{container.image}</div>
                            </div>
                            <div className="text-xs text-(--text-muted) md:text-right">
                              <div>{container.status}</div>
                              <div className="mt-1 font-mono">{container.id}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="border rounded-(--radius) border-(--red) bg-[rgba(239,68,68,0.05)]">
                    <div className="border-b border-(--red) px-4 py-2 text-[11.5px] font-medium text-(--red)">
                      Danger Zone
                    </div>
                    <div className="space-y-3 px-4 py-4">
                      <p className="text-sm text-(--text-muted)">
                        Volume pruning can delete detached Docker data volumes. Use this only when you understand which workloads store persistent data in volumes.
                      </p>
                      <Button variant="danger" size="sm" onClick={() => setVolumePruneConfirmOpen(true)} loading={pruningVolumes}>
                        Prune Docker volumes
                      </Button>
                    </div>
                  </div>
                </div>
              ) : selectedId && !demoMode ? (
                <div className="border rounded-(--radius) border-dashed border-(--border) px-4 py-4 text-sm text-(--text-muted)">
                  {dockerUsageLoading ? 'Inspecting Docker images and containers…' : 'Docker inspection is unavailable for this host.'}
                </div>
              ) : null}

              {/* Diagnostics */}
              {audit.diagnostics?.length ? (
                <div className="border rounded-(--radius) border-(--yellow) bg-[rgba(245,158,11,0.08)] px-4 py-3">
                  <div className="text-[12.5px] font-medium text-(--yellow) mb-2">Diagnostics</div>
                  <div className="space-y-1">
                    {audit.diagnostics.map((entry) => (
                      <div key={`${entry.step}-${entry.message}`} className="text-sm text-(--text-muted)">
                        <span className="font-mono text-xs text-(--text)">{entry.step}</span>: {entry.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="text-xs text-(--text-muted)">Last audited {formatRelative(audit.checkedAt)}</p>
            </>
          ) : null}
        </>
      )}

      {/* Confirm modals */}
      <ConfirmActionModal
        open={cleanupConfirmOpen}
        title="Run safe prune"
        description="Conservative cleanup for reclaimable Docker data and host caches. Preserves running containers and avoids volume removal."
        confirmLabel="Run safe prune"
        details={
          audit?.cleanupCommands?.length
            ? [...audit.cleanupCommands.map((cmd) => `$ ${cmd}`), 'Equivalent to a conservative prune pass. Running containers and volumes are preserved.']
            : ['$ docker image prune -f', '$ docker container prune -f', '$ docker builder prune -af', '$ journalctl --vacuum-time=7d', '$ apt-get clean']
        }
        loading={cleaning}
        onClose={() => setCleanupConfirmOpen(false)}
        onConfirm={async () => { await handleCleanup(); setCleanupConfirmOpen(false) }}
      />

      <ConfirmActionModal
        open={deepCleanupConfirmOpen}
        title="Run docker system prune -a"
        description="Runs the strongest safe Docker prune path in Launchpad. Removes stopped containers, unused networks, unused images, and build cache. Running containers and attached volumes are preserved."
        confirmLabel="Run system prune -a"
        details={[
          '$ docker system prune -af',
          '$ docker builder prune -af',
          '$ journalctl --vacuum-time=7d',
          '$ apt-get clean',
          'Matches docker system prune --all --force plus docker builder prune --all --force.',
          'No --volumes flag — attached data volumes are preserved.',
        ]}
        loading={deepCleaning}
        onClose={() => setDeepCleanupConfirmOpen(false)}
        onConfirm={async () => { await handleDeepCleanup(); setDeepCleanupConfirmOpen(false) }}
      />

      <ConfirmActionModal
        open={pruneExitedConfirmOpen}
        title="Prune exited containers"
        description="This removes stopped containers so old image layers can be deleted more aggressively afterward. Running containers are preserved."
        confirmLabel="Prune exited containers"
        details={[
          '$ docker container prune -f',
          'Running containers are preserved.',
          'This is often the first step before removing old images.',
        ]}
        loading={pruningExitedContainers}
        onClose={() => setPruneExitedConfirmOpen(false)}
        onConfirm={async () => { await handlePruneExitedContainers(); setPruneExitedConfirmOpen(false) }}
      />

      <ConfirmActionModal
        open={Boolean(removeImageTarget)}
        title="Remove Docker image"
        description="This deletes a specific image from the server. Only images not currently referenced by containers should be removed here."
        confirmLabel="Remove image"
        confirmKeyword={removeImageTarget?.id.slice(0, 12)}
        details={removeImageTarget ? [
          removeImageTarget.reference,
          `Image ID: ${removeImageTarget.id}`,
          `Size: ${removeImageTarget.sizeText}`,
          `Created: ${removeImageTarget.createdSince}`,
        ] : []}
        loading={Boolean(removingImageId)}
        onClose={() => { if (!removingImageId) setRemoveImageTarget(null) }}
        onConfirm={handleRemoveImage}
      />

      <ConfirmActionModal
        open={volumePruneConfirmOpen}
        title="Prune Docker volumes"
        description="This removes unused Docker volumes. Detached data volumes can contain real application data, so treat this as a higher-risk cleanup action."
        confirmLabel="Prune volumes"
        confirmKeyword="DELETE VOLUMES"
        details={[
          '$ docker volume prune -f',
          'Only unused volumes are targeted, but detached data volumes can still be important.',
          'Do not run this unless you are confident the host is not relying on old detached volumes for recovery.',
        ]}
        loading={pruningVolumes}
        onClose={() => { if (!pruningVolumes) setVolumePruneConfirmOpen(false) }}
        onConfirm={async () => { await handleVolumePrune(); setVolumePruneConfirmOpen(false) }}
      />

      <ReauthModal open={reauthOpen} onClose={() => setReauthOpen(false)} />
    </div>
  )
}
