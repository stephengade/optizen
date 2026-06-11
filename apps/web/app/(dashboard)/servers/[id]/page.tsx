'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { Project, Server, ServerConnectionStatus } from '@launchpad/shared'
import { toast } from 'sonner'
import { ConnectionBadge } from '@/components/dashboard/ConnectionBadge'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { ProjectForm } from '@/components/dashboard/ProjectForm'
import { ServerForm } from '@/components/dashboard/ServerForm'
import { Button } from '@/components/ui/Button'
import { api, ApiError } from '@/lib/api'

type ServerSummary = Server & { projectCount?: number }

export default function ServerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [server, setServer] = useState<ServerSummary | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [status, setStatus] = useState<ServerConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)

  async function loadData() {
    try {
      const [serverData, projectData] = await Promise.all([
        api.get<ServerSummary>(`/servers/${params.id}`),
        api.get<Project[]>(`/servers/${params.id}/projects`),
      ])
      setServer(serverData)
      setProjects(projectData)
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
      toast.success(nextStatus.connected ? 'SSH connection succeeded' : nextStatus.error ?? 'SSH connection failed')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to test connection'
      toast.error(message)
    } finally {
      setTesting(false)
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
            {server.user}@{server.host}:{server.port}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionBadge connected={status?.connected} latencyMs={status?.latencyMs} error={status?.error} />
          <Button variant="ghost" size="sm" onClick={() => void handleTest()} loading={testing}>
            Test SSH
          </Button>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
        <ServerForm
          title="Edit server"
          description="Update connection details here. Deleting the server also deletes its associated projects."
          submitLabel="Save changes"
          initialValue={server}
          onSubmit={handleUpdate}
          onDelete={handleDelete}
        />

        <ProjectForm
          title="Add project"
          description="Define deploy commands, image source, proxy mode, and notification defaults for this server."
          submitLabel="Create project"
          onSubmit={handleCreateProject}
        />
      </div>

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
            No projects yet for this server.
          </div>
        )}
      </section>
    </div>
  )
}
