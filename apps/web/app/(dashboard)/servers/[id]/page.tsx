'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { ActivityEvent, DeployRecord, Project, Server, ServerConnectionStatus, ServerResourceStatus } from '@launchpad/shared'
import { HardDrive, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { ActivityTimeline } from '@/components/dashboard/ActivityTimeline'
import { ConnectionBadge } from '@/components/dashboard/ConnectionBadge'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { ProjectForm } from '@/components/dashboard/ProjectForm'
import { ServerForm } from '@/components/dashboard/ServerForm'
import { DeployStatusBadge } from '@/components/dashboard/DeployStatusBadge'
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal'
import { ReauthModal } from '@/components/ui/ReauthModal'
import { SensitiveText } from '@/components/ui/SensitiveText'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { api, ApiError, isReauthRequiredError } from '@/lib/api'
import {
  demoServers,
  getDemoActivityForServer,
  getDemoProjectsForServer,
  getDemoServer,
  isDemoId,
} from '@/lib/demo-fixtures'
import { useDemoPrivacy } from '@/lib/demo-privacy-context'
import { formatBytes, formatPercent, formatUptime } from '@/lib/format'
import { formatRelative } from '@/lib/utils'

type ServerSummary = Server & { projectCount?: number; recentDeployOutcomes?: DeployRecord[] }

export default function ServerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { demoMode } = useDemoPrivacy()
  const [server, setServer] = useState<ServerSummary | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [status, setStatus] = useState<ServerConnectionStatus | null>(null)
  const [resources, setResources] = useState<ServerResourceStatus | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [reclassifying, setReclassifying] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addProjectOpen, setAddProjectOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)

  async function loadData() {
    if (demoMode && isDemoId(params.id)) {
      const serverData = getDemoServer(params.id)
      if (!serverData) {
        toast.error('Demo server not found')
        router.push('/servers')
        return
      }
      setServer(serverData)
      setProjects(getDemoProjectsForServer(params.id))
      setActivity(getDemoActivityForServer(params.id))
      setStatus(serverData.lastConnectionStatus ?? null)
      setResources(serverData.lastResourceStatus ?? null)
      setLoading(false)
      return
    }

    try {
      const [serverData, projectData, activityData] = await Promise.all([
        api.get<ServerSummary>(`/servers/${params.id}`),
        api.get<Project[]>(`/servers/${params.id}/projects`),
        api.get<ActivityEvent[]>(`/servers/${params.id}/activity`),
      ])
      setServer(serverData)
      setProjects(projectData)
      setActivity(activityData)
      setStatus(serverData.lastConnectionStatus ?? null)
      setResources(serverData.lastResourceStatus ?? null)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load server'
      toast.error(message)
      router.push('/servers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [params.id])

  async function handleUpdate(payload: {
    name: string
    host: string
    port: number
    user: string
    sshKeyPath: string
    sshPassphrase?: string
    diskAlertThresholdPercent?: number
  }) {
    if (demoMode) {
      toast.success('Demo mode is active. Seeded server data stays read-only.')
      return
    }
    const updated = await api.patch<ServerSummary>(`/servers/${params.id}`, payload)
    setServer(updated)
    toast.success('Server updated')
  }

  async function handleDelete() {
    if (demoMode) {
      toast.success('Demo mode is active. Seeded server data stays read-only.')
      return
    }
    try {
      await api.delete(`/servers/${params.id}`)
      toast.success('Server deleted')
      router.push('/servers')
    } catch (error) {
      if (isReauthRequiredError(error)) {
        setReauthOpen(true)
        toast.error('Verify your session to delete this server.')
        return
      }
      const message = error instanceof ApiError ? error.message : 'Failed to delete server'
      toast.error(message)
      throw error
    }
  }

  async function handleCreateProject(payload: {
    name: string
    source: Project['source']
    runtime: Project['runtime']
    repoImage: string
    deployCommands: string[]
    envPath?: string
    workingDir?: string
    proxyType: Project['proxyType']
    healthCheck?: Project['healthCheck']
    webhookEnabled: boolean
    notifications: Project['notifications']
  }) {
    if (demoMode) {
      toast.success('Demo mode is active. Seeded project data stays read-only.')
      return
    }
    const created = await api.post<Project>(`/servers/${params.id}/projects`, payload)
    setProjects((current) => [created, ...current])
    setServer((current) => (current ? { ...current, projectCount: (current.projectCount ?? 0) + 1 } : current))
    toast.success('Project created')
  }

  async function handleTest() {
    if (demoMode) {
      toast.success('Demo mode is active. Telemetry is already seeded for this server.')
      return
    }
    setTesting(true)
    try {
      const nextStatus = await api.post<ServerConnectionStatus>(`/servers/${params.id}/test`)
      setStatus(nextStatus)
      setServer((current) => (current ? { ...current, lastConnectionStatus: nextStatus } : current))
      try {
        const resource = await api.get<ServerResourceStatus>(`/servers/${params.id}/resources`)
        setResources(resource)
        setServer((current) => (current ? { ...current, lastResourceStatus: resource } : current))
      } catch {
        // Keep existing memory snapshot if resource refresh fails.
      }
      toast.success(nextStatus.connected ? 'SSH connection succeeded' : nextStatus.error ?? 'SSH connection failed')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to test connection'
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  async function handleReclassifyProjects() {
    if (demoMode) {
      toast.success('Demo mode is active. Seeded project labels are already curated.')
      return
    }
    setReclassifying(true)
    try {
      const result = await api.post<{ success: boolean; updated: number }>(`/servers/${params.id}/reclassify-projects`)
      await loadData()
      toast.success(result.updated > 0 ? `Updated ${result.updated} imported project types` : 'Project types were already up to date')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to refresh project types'
      toast.error(message)
    } finally {
      setReclassifying(false)
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-8 lg:px-8">
        <LoadingState label="Loading server" detail="Gathering server details, projects, activity, and telemetry." />
      </div>
    )
  }

  if (!server) return null

  const loadAverage = Array.isArray(resources?.loadAverage) ? resources.loadAverage : null
  const hasMemoryStats =
    Number.isFinite(resources?.memoryUsedBytes) &&
    Number.isFinite(resources?.memoryTotalBytes)
  const hasDiskStats =
    Number.isFinite(resources?.diskUsedBytes) &&
    Number.isFinite(resources?.diskTotalBytes)
  const hasUptime = Number.isFinite(resources?.uptimeSeconds)
  const hasInodeStats = Number.isFinite(resources?.diskInodesUsedPercent)
  const hasCpuUsage = Number.isFinite(resources?.cpuUsagePercent)
  const hasCpuCapacity = Number.isFinite(resources?.cpuCoreCount) && (resources?.cpuCoreCount ?? 0) > 0
  const hasContainerStats =
    Number.isFinite(resources?.runningContainers) &&
    Number.isFinite(resources?.exitedContainers)
  const containersAvailable = resources?.containersAvailable !== false

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8 space-y-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/servers" className="text-xs uppercase tracking-[0.24em] text-(--text-muted) hover:text-(--text) transition-colors">
            ← Servers
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-(--text)">{server.name}</h1>
          <p className="mt-1 text-sm text-(--text-muted) font-mono">
            <SensitiveText value={`${server.user}@${server.host}:${server.port}`} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ConnectionBadge connected={status?.connected} latencyMs={status?.latencyMs} error={status?.error} />
          <Button variant="ghost" size="sm" onClick={() => void handleTest()} loading={testing}>
            Test SSH
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Link
            href={`/servers/${params.id}/proxy`}
            className="inline-flex h-8 items-center border border-(--border) px-3 text-xs text-(--text-muted) hover:text-(--text) hover:border-(--border-strong) transition-colors"
          >
            Proxy
          </Link>
          <Link
            href={`/storage?server=${params.id}`}
            className="inline-flex h-8 items-center gap-1.5 border border-(--border) px-3 text-xs text-(--text-muted) hover:text-(--text) hover:border-(--border-strong) transition-colors"
          >
            <HardDrive size={12} />
            Storage
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-(--border) divide-x divide-(--border)">
        <Metric
          label="CPU"
          value={hasCpuUsage ? formatPercent(resources!.cpuUsagePercent!, 1) : '—'}
          sub={loadAverage ? loadAverage.map((v) => v.toFixed(2)).join(' / ') : hasCpuCapacity ? `${resources!.cpuCoreCount}c` : 'no data'}
        />
        <Metric
          label="Memory"
          value={hasMemoryStats ? formatBytes(resources!.memoryUsedBytes!) : '—'}
          sub={hasMemoryStats ? `of ${formatBytes(resources!.memoryTotalBytes!)}` : 'no data'}
        />
        <Metric
          label="Disk"
          value={hasDiskStats ? formatBytes(resources!.diskUsedBytes!) : '—'}
          sub={hasDiskStats ? `of ${formatBytes(resources!.diskTotalBytes!)}${hasInodeStats ? ` · ${formatPercent(resources!.diskInodesUsedPercent!)} inodes` : ''}` : 'no data'}
        />
        <Metric
          label="Uptime"
          value={hasUptime ? formatUptime(resources!.uptimeSeconds!) : '—'}
          sub={containersAvailable && hasContainerStats ? `${resources!.runningContainers} running / ${resources!.exitedContainers} exited` : 'no data'}
        />
      </div>

      {/* Projects */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-(--text)">
              Projects
              <span className="ml-2 text-(--text-muted) font-normal">{projects.length}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void handleReclassifyProjects()} loading={reclassifying}>
              Reclassify
            </Button>
            <button
              type="button"
              onClick={() => setAddProjectOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 border border-(--border) text-xs text-(--text-muted) hover:text-(--text) hover:border-(--border-strong) transition-colors"
            >
              <Plus size={13} />
              Add project
            </button>
          </div>
        </div>

        {projects.length > 0 ? (
          <div className="grid gap-px md:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-(--border) px-5 py-8 text-center">
            <p className="text-sm text-(--text-muted)">No projects yet.</p>
            <p className="mt-1 text-xs text-(--text-subtle)">Add one manually or import from the scan workspace.</p>
          </div>
        )}
      </section>

      {/* Recent deploys + Activity */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-(--text) mb-3">Recent deploys</h2>
          {server.recentDeployOutcomes?.length ? (
            <div className="border border-(--border) divide-y divide-(--border)">
              {server.recentDeployOutcomes.map((record) => (
                <div key={record.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <DeployStatusBadge status={record.status} />
                    <span className="text-xs text-(--text-muted)">{record.trigger}{record.imageTag ? ` · ${record.imageTag}` : ''}</span>
                  </div>
                  <span className="text-xs text-(--text-muted) shrink-0">{formatRelative(record.triggeredAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-(--border) px-4 py-6 text-sm text-(--text-muted)">
              No deploys yet.
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-(--text) mb-3">Activity</h2>
          <ActivityTimeline events={activity.slice(0, 8)} emptyLabel="No activity yet." />
        </section>
      </div>

      {/* Modals */}
      <Modal
        open={editOpen}
        title="Edit server"
        description="Update connection details. Deleting removes all attached projects from Optizen."
        onClose={() => setEditOpen(false)}
      >
        <ServerForm
          title="Edit server"
          description=""
          submitLabel="Save changes"
          initialValue={server}
          inModal
          onSubmit={async (payload) => {
            await handleUpdate(payload)
            setEditOpen(false)
          }}
          onDelete={async () => {
            setEditOpen(false)
            setConfirmDeleteOpen(true)
          }}
        />
      </Modal>

      <Modal
        open={addProjectOpen}
        title="Add project"
        description="Define deploy commands, image source, proxy mode, and notification defaults."
        onClose={() => setAddProjectOpen(false)}
      >
        <ProjectForm
          title="Add project"
          description=""
          submitLabel="Create project"
          inModal
          onSubmit={async (payload) => {
            await handleCreateProject(payload)
            setAddProjectOpen(false)
          }}
        />
      </Modal>

      <ConfirmActionModal
        open={confirmDeleteOpen}
        title="Delete server"
        description="Removes the server record and all Optizen projects attached to it. Remote containers and files are unaffected."
        confirmLabel="Delete server"
        confirmKeyword={server.name}
        details={[
          `Server: ${server.name}`,
          `Projects removed from Optizen: ${projects.length}`,
          'Remote containers and files stay on the server.',
        ]}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          await handleDelete()
          setConfirmDeleteOpen(false)
        }}
      />

      <ReauthModal open={reauthOpen} onClose={() => setReauthOpen(false)} />
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-(--text-muted)">{label}</div>
      <div className="mt-1 text-base font-semibold text-(--text)">{value}</div>
      <div className="mt-0.5 text-xs text-(--text-muted) truncate">{sub}</div>
    </div>
  )
}
