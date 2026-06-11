'use client'

import { useEffect, useState } from 'react'
import type { Server, ServerConnectionStatus } from '@launchpad/shared'
import { toast } from 'sonner'
import { ServerCard } from '@/components/dashboard/ServerCard'
import { ServerForm } from '@/components/dashboard/ServerForm'
import { api, ApiError } from '@/lib/api'

type ServerSummary = Server & { projectCount?: number }

export default function ServersPage() {
  const [servers, setServers] = useState<ServerSummary[]>([])
  const [statuses, setStatuses] = useState<Record<string, ServerConnectionStatus>>({})
  const [loading, setLoading] = useState(true)
  const [testingId, setTestingId] = useState<string | null>(null)

  async function loadServers() {
    try {
      const data = await api.get<ServerSummary[]>('/servers')
      setServers(data)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load servers'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadServers()
  }, [])

  async function handleCreate(payload: {
    name: string
    host: string
    port: number
    user: string
    sshKeyPath: string
    sshPassphrase?: string
  }) {
    const created = await api.post<ServerSummary>('/servers', payload)
    setServers((current) => [created, ...current])
    toast.success('Server created')
  }

  async function handleTest(serverId: string) {
    setTestingId(serverId)
    try {
      const status = await api.post<ServerConnectionStatus>(`/servers/${serverId}/test`)
      setStatuses((current) => ({ ...current, [serverId]: status }))
      toast.success(status.connected ? 'SSH connection succeeded' : status.error ?? 'SSH connection failed')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to test connection'
      toast.error(message)
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-8">
      <section className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--green)]">Phase 3</p>
        <h1 className="text-3xl font-semibold text-[var(--text)]">Servers</h1>
        <p className="max-w-2xl text-sm text-[var(--text-muted)]">
          Add your VPS hosts, keep SSH credentials encrypted at rest, and drill into each server&apos;s project inventory.
        </p>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
              Loading servers...
            </div>
          ) : servers.length > 0 ? (
            servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                status={statuses[server.id]}
                onTest={() => void handleTest(server.id)}
                testing={testingId === server.id}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
              No servers yet. Add your first host to start modeling projects and deploy flows.
            </div>
          )}
        </section>

        <ServerForm
          title="Add server"
          description="Credentials stay local to Launchpad and sensitive fields are encrypted before they touch disk."
          submitLabel="Create server"
          onSubmit={handleCreate}
        />
      </div>
    </div>
  )
}
