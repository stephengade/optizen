'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { ActivityEvent, DeployRecord, Project, Server, ServerConnectionStatus, ServerResourceStatus } from '@launchpad/shared'
import { toast } from 'sonner'
import { ActivityTimeline } from '@/components/dashboard/ActivityTimeline'
import { ConnectionBadge } from '@/components/dashboard/ConnectionBadge'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { ProjectForm } from '@/components/dashboard/ProjectForm'
import { ServerForm } from '@/components/dashboard/ServerForm'
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal'
import { ReauthModal } from '@/components/ui/ReauthModal'
import { SensitiveText } from '@/components/ui/SensitiveText'
import { Button } from '@/components/ui/Button'
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
      <div className="px-6 py-8 text-sm text-(--text-muted) lg:px-8">
        Loading server...
      </div>
    )
  }

  if (!server) return null

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/servers" className="text-xs uppercase tracking-[0.24em] text-(--text-muted)">
            Back to servers
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-(--text)">{server.name}</h1>
          <p className="mt-2 text-sm text-(--text-muted)">
            <SensitiveText value={`${server.user}@${server.host}:${server.port}`} />
          </p>
          <p className="mt-2 text-sm text-(--text-muted)">
            Launchpad now keeps servers, projects, deploys, and infra edits separate so you can reason about impact before you act.
          </p>
          <p className="mt-2 max-w-2xl text-sm text-(--text-muted)">
            Imported projects from older scans may still carry stale labels. Refresh project types to reclassify them from image, name, working directory, and proxy hints.
          </p>
          <div className="mt-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                Edit server
              </Button>
              <Button size="sm" onClick={() => setAddProjectOpen(true)}>
                Add project
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void handleReclassifyProjects()} loading={reclassifying}>
                Refresh project types
              </Button>
              <Link
                href={`/servers/${params.id}/proxy`}
                className="inline-flex h-8 items-center border border-(--border) px-3 text-xs font-medium text-(--text) transition-colors hover:bg-(--surface-2)"
              >
                Open proxy manager
              </Link>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionBadge connected={status?.connected} latencyMs={status?.latencyMs} error={status?.error} />
          <Button variant="ghost" size="sm" onClick={() => void handleTest()} loading={testing}>
            Test SSH
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-(--border) bg-(--surface) p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-(--text-muted)">CPU + Load</div>
          <div className="mt-2 text-lg font-semibold text-(--text)">
            {resources ? formatPercent(resources.cpuUsagePercent, 1) : 'n/a'}
          </div>
          <div className="mt-1 text-sm text-(--text-muted)">
            {resources ? resources.loadAverage.map((value) => value.toFixed(2)).join(' / ') : 'Run Test SSH to refresh'}
          </div>
        </div>
        <div className="rounded-2xl border border-(--border) bg-(--surface) p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-(--text-muted)">Memory + Disk</div>
          <div className="mt-2 text-lg font-semibold text-(--text)">
            {resources ? `${formatBytes(resources.memoryUsedBytes)} / ${formatBytes(resources.memoryTotalBytes)}` : 'n/a'}
          </div>
          <div className="mt-1 text-sm text-(--text-muted)">
            {resources ? `${formatBytes(resources.diskUsedBytes)} / ${formatBytes(resources.diskTotalBytes)} disk` : 'Run Test SSH to refresh'}
          </div>
        </div>
        <div className="rounded-2xl border border-(--border) bg-(--surface) p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-(--text-muted)">Uptime + Inodes</div>
          <div className="mt-2 text-lg font-semibold text-(--text)">
            {resources ? formatUptime(resources.uptimeSeconds) : 'n/a'}
          </div>
          <div className="mt-1 text-sm text-(--text-muted)">
            {resources ? `${formatPercent(resources.diskInodesUsedPercent)} inode use` : 'Run Test SSH to refresh'}
          </div>
        </div>
        <div className="rounded-2xl border border-(--border) bg-(--surface) p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-(--text-muted)">Containers</div>
          <div className="mt-2 text-lg font-semibold text-(--text)">
            {resources ? resources.runningContainers : 'n/a'}
          </div>
          <div className="mt-1 text-sm text-(--text-muted)">
            {resources ? `${resources.exitedContainers} exited` : 'Run Test SSH to refresh'}
          </div>
        </div>
      </section>

      <section className="border border-(--border) bg-(--surface) p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-(--accent)">Discovery</p>
            <h2 className="mt-2 text-lg font-semibold text-(--text)">Import running apps</h2>
            <p className="mt-1 max-w-3xl text-sm text-(--text-muted)">
              Discovery now lives in the top-level scan workspace so you can scan every server from one place and import with a server-select modal.
            </p>
          </div>
          <Link
            href="/scan"
            className="inline-flex h-10 items-center border border-(--border) px-4 text-sm text-(--text) transition-colors hover:bg-(--surface-2)"
          >
            Open scan workspace
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-(--border) bg-(--surface) p-6">
          <h2 className="text-lg font-semibold text-(--text)">Recent deploy outcomes</h2>
          <div className="mt-4 space-y-3">
            {server.recentDeployOutcomes?.length ? (
              server.recentDeployOutcomes.map((record) => (
                <div key={record.id} className="rounded-xl border border-(--border) bg-(--surface-2) px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-medium text-(--text)">{record.status}</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-(--text-muted)">
                      {formatRelative(record.triggeredAt)}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-(--text-muted)">
                    Triggered via {record.trigger}{record.imageTag ? ` using ${record.imageTag}` : ''}.
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-(--border) bg-(--surface-2) p-4 text-sm text-(--text-muted)">
                No deploys have run on this server yet.
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-(--text)">Activity timeline</h2>
          <ActivityTimeline events={activity} emptyLabel="No tracked activity yet. Deploys, imports, proxy edits, env saves, and rollbacks will show up here." />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-(--text)">Projects</h2>
          <p className="mt-1 text-sm text-(--text-muted)">
            {projects.length} project{projects.length === 1 ? '' : 's'} currently attached to this server.
          </p>
        </div>

        {projects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-(--border) bg-(--surface) p-6 text-sm text-(--text-muted)">
            No projects are attached to this server yet. Add one manually or import a running app from the scan workspace.
          </div>
        )}
      </section>

      <Modal
        open={editOpen}
        title="Edit server"
        description="Update connection details here. Deleting the server also deletes its associated projects."
        onClose={() => setEditOpen(false)}
      >
        <ServerForm
          title="Edit server"
          description="Update connection details here. Deleting the server also deletes its associated projects."
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
        description="Define deploy commands, image source, proxy mode, and notification defaults for this server."
        onClose={() => setAddProjectOpen(false)}
      >
        <ProjectForm
          title="Add project"
          description="Define deploy commands, image source, proxy mode, and notification defaults for this server."
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
        description="This removes the saved server record and every Launchpad project attached to it. It does not stop containers on the VPS, but it does remove your local control surface."
        confirmLabel="Delete server"
        confirmKeyword={server.name}
        details={[
          `Server: ${server.name}`,
          `Projects removed from Launchpad: ${projects.length}`,
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
