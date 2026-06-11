'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { Project } from '@launchpad/shared'
import { toast } from 'sonner'
import { ProjectForm } from '@/components/dashboard/ProjectForm'
import { Button } from '@/components/ui/Button'
import { api, ApiError } from '@/lib/api'

export default function ProjectDetailPage() {
  const params = useParams<{ id: string; pid: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  async function loadProject() {
    try {
      const data = await api.get<Project>(`/projects/${params.pid}`)
      setProject(data)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load project'
      toast.error(message)
      router.push(`/servers/${params.id}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProject()
  }, [params.pid])

  async function handleUpdate(payload: {
    name: string
    repoImage: string
    deployCommands: string[]
    envPath?: string
    workingDir?: string
    proxyType: Project['proxyType']
    webhookEnabled: boolean
    notifications: Project['notifications']
  }) {
    const updated = await api.patch<Project>(`/projects/${params.pid}`, payload)
    setProject(updated)
    toast.success('Project updated')
  }

  async function handleDelete() {
    await api.delete(`/projects/${params.pid}`)
    toast.success('Project deleted')
    router.push(`/servers/${params.id}`)
  }

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const data = await api.post<{ webhookSecret: string }>(`/projects/${params.pid}/webhook-secret`)
      setProject((current) => (current ? { ...current, webhookSecret: data.webhookSecret } : current))
      toast.success('Webhook secret regenerated')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to regenerate secret'
      toast.error(message)
    } finally {
      setRegenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-8 text-sm text-[var(--text-muted)] lg:px-8">
        Loading project...
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8 lg:px-8">
      <section>
        <Link href={`/servers/${params.id}`} className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Back to server
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--text)]">{project.name}</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{project.repoImage}</p>
      </section>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Webhook secret</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              This will be used by the inbound deploy webhook in the next phase.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void handleRegenerate()} loading={regenerating}>
            Regenerate
          </Button>
        </div>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 font-mono text-xs text-[var(--text)]">
          {project.webhookSecret || 'No secret generated yet'}
        </pre>
      </div>

      <ProjectForm
        title="Edit project"
        description="Fine-tune deploy metadata now so the deploy engine, webhook trigger, and env tooling have the shape they need later."
        submitLabel="Save changes"
        initialValue={project}
        onSubmit={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  )
}
