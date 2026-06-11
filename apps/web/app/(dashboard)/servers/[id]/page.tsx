'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { Project, Server, ServerConnectionStatus, ServerResourceStatus } from '@launchpad/shared'
import { toast } from 'sonner'
import { ConnectionBadge } from '@/components/dashboard/ConnectionBadge'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { ProjectForm } from '@/components/dashboard/ProjectForm'
import { ServerForm } from '@/components/dashboard/ServerForm'
import { SensitiveText } from '@/components/ui/SensitiveText'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { api, ApiError } from '@/lib/api'
import { formatBytes } from '@/lib/format'

type ServerSummary = Server & { projectCount?: number }

export default function ServerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [server, setServer] = useState<ServerSummary | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [status, setStatus] = useState<ServerConnectionStatus | null>(null)
  const [resources, setResources] = useState<ServerResourceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [reclassifying, setReclassifying] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addProjectOpen, setAddProjectOpen] = useState(false)

  async function loadData() {
    try {
      const [serverData, projectData] = await Promise.all([
        api.get<ServerSummary>(`/servers/${params.id}`),
        api.get<Project[]>(`/servers/${params.id}/projects`),
      ])
      setServer(serverData)
      setProjects(projectData)
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
    const updated = await api.patch<ServerSummary>(`/servers/${params.id}`, payload)
    setServer(updated)
    toast.success('Server updated')
  }

  async function handleDelete() {
    await api.delete(`/servers/${params.id}`)
    toast.success('Server deleted')
    router.push('/servers')
  }

  async function handleCreateProject(payload: {
    name: string
    repoImage: string
    deployCommands: string[]
    envPath?: string
    workingDir?: string
    proxyType: Project['proxyType']
    webhookEnabled: boolean
    notifications: Project['notifications']
  }) {
    const created = await api.post<Project>(`/servers/${params.id}/projects`, payload)
    setProjects((current) => [created, ...current])
    setServer((current) => (current ? { ...current, projectCount: (current.projectCount ?? 0) + 1 } : current))
    toast.success('Project created')
  }

  async function handleTest() {
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
      <div className="px-6 py-8 text-sm text-[var(--text-muted)] lg:px-8">
        Loading server...
      </div>
    )
  }

  if (!server) return null

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/servers" className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Back to servers
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--text)]">{server.name}</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            <SensitiveText value={`${server.user}@${server.host}:${server.port}`} />
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Memory usage: {resources ? `${formatBytes(resources.memoryUsedBytes)} / ${formatBytes(resources.memoryTotalBytes)} used` : 'not available yet'}
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Disk usage: {resources ? `${formatBytes(resources.diskUsedBytes)} / ${formatBytes(resources.diskTotalBytes)} used` : 'not available yet'}
          </p>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
            Launchpad only shows projects that you add in this dashboard. A successful SSH test confirms access to the VPS, but it does not auto-import apps from the server.
          </p>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
            Imported projects from older scans may still carry a stale proxy badge. Refresh project types to reclassify them from their image, name, and working directory.
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
                className="inline-flex h-8 items-center border border-[var(--border)] px-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
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

      <section className="border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--green)]">Discovery</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Import running apps</h2>
            <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
              Discovery now lives in the top-level scan workspace so you can scan every server from one place and import with a server-select modal.
            </p>
          </div>
          <Link
            href="/scan"
            className="inline-flex h-10 items-center border border-[var(--border)] px-4 text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            Open scan workspace
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Projects</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
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
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
            No projects configured for this server yet. Use the form above to add one manually.
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
            await handleDelete()
            setEditOpen(false)
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
    </div>
  )
}
