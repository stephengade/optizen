'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Server, ServerConnectionStatus, ServerResourceStatus } from '@launchpad/shared'
import { ArrowRight, BookOpen, Plus, Radar, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { ServerCard } from '@/components/dashboard/ServerCard'
import { ServerForm } from '@/components/dashboard/ServerForm'
import { api, ApiError } from '@/lib/api'
import { demoServers } from '@/lib/demo-fixtures'
import { useDemoPrivacy } from '@/lib/demo-privacy-context'
import { formatPercent } from '@/lib/format'

type ServerSummary = Server & { projectCount?: number }

export default function ServersPage() {
  const { demoMode } = useDemoPrivacy()
  const [servers, setServers] = useState<ServerSummary[]>([])
  const [statuses, setStatuses] = useState<Record<string, ServerConnectionStatus>>({})
  const [resources, setResources] = useState<Record<string, ServerResourceStatus>>({})
  const [loading, setLoading] = useState(true)
  const [testingId, setTestingId] = useState<string | null>(null)

  async function loadServers() {
    if (demoMode) {
      setServers(demoServers)
      setResources(
        Object.fromEntries(
          demoServers
            .filter((server) => server.lastResourceStatus)
            .map((server) => [server.id, server.lastResourceStatus!])
        )
      )
      setLoading(false)
      return
    }

    try {
      const data = await api.get<ServerSummary[]>('/servers')
      setServers(data)
      setResources(
        Object.fromEntries(
          data
            .filter((server) => server.lastResourceStatus)
            .map((server) => [server.id, server.lastResourceStatus!])
        )
      )

      const snapshots = await Promise.allSettled(
        data.map(async (server) => {
          const resource = await api.get<ServerResourceStatus>(`/servers/${server.id}/resources`)
          return [server.id, resource] as const
        })
      )

      setResources((current) => {
        const next = { ...current }
        for (const snapshot of snapshots) {
          if (snapshot.status === 'fulfilled') {
            next[snapshot.value[0]] = snapshot.value[1]
          }
        }
        return next
      })
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load servers'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadServers()
  }, [demoMode])

  async function handleCreate(payload: {
    name: string
    host: string
    port: number
    user: string
    sshKeyPath: string
    sshPassphrase?: string
  }) {
    if (demoMode) {
      toast.success('Demo mode is active. Seeded data stays read-only for presentations.')
      return
    }
    const created = await api.post<ServerSummary>('/servers', payload)
    setServers((current) => [created, ...current])
    toast.success('Server created')
  }

  async function handleTest(serverId: string) {
    if (demoMode) {
      toast.success('Demo mode is active. Telemetry snapshots are seeded for presentation use.')
      return
    }
    setTestingId(serverId)
    try {
      const status = await api.post<ServerConnectionStatus>(`/servers/${serverId}/test`)
      setStatuses((current) => ({ ...current, [serverId]: status }))
      setServers((current) =>
        current.map((server) =>
          server.id === serverId ? { ...server, lastConnectionStatus: status } : server
        )
      )
      try {
        const resource = await api.get<ServerResourceStatus>(`/servers/${serverId}/resources`)
        setResources((current) => ({ ...current, [serverId]: resource }))
      } catch {
        // Leave the previous memory snapshot in place if refresh fails.
      }
      toast.success(status.connected ? 'SSH connection succeeded' : status.error ?? 'SSH connection failed')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to test connection'
      toast.error(message)
    } finally {
      setTestingId(null)
    }
  }

  const serverCount = servers.length
  const totalProjects = servers.reduce((sum, server) => sum + (server.projectCount ?? 0), 0)
  const onlineServers = servers.filter((server) => (statuses[server.id] ?? server.lastConnectionStatus)?.connected).length
  const avgCpu = Object.values(resources).length
    ? Object.values(resources).reduce((sum, snapshot) => sum + snapshot.cpuUsagePercent, 0) / Object.values(resources).length
    : 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 lg:px-8 lg:py-8">
      <section className="rounded-[26px] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(104,240,167,0.1),rgba(121,188,255,0.07)_45%,rgba(16,25,24,0.75))] p-6 lg:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--green)]">Phase C</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text)] lg:text-5xl">
              Your VPS fleet, made legible.
            </h1>
            <p className="mt-4 text-base leading-7 text-[var(--text-muted)]">
              Launchpad turns raw server access into a control plane: SSH trust, deploy intent, runtime health,
              and infra edits all stay visible in one place so people know what they are changing before they touch production.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
            <div className="rounded-[20px] border border-[var(--border)] bg-[rgba(7,16,15,0.45)] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Servers</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{serverCount}</div>
            </div>
            <div className="rounded-[20px] border border-[var(--border)] bg-[rgba(7,16,15,0.45)] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Online</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{onlineServers}</div>
            </div>
            <div className="rounded-[20px] border border-[var(--border)] bg-[rgba(7,16,15,0.45)] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Avg CPU</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text)]">
                {Object.values(resources).length ? formatPercent(avgCpu, 1) : 'n/a'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          <Link
            href="/scan"
            className="rounded-[20px] border border-[var(--border)] bg-[rgba(7,16,15,0.35)] p-4 transition-colors hover:bg-[var(--surface-2)]"
          >
            <div className="flex items-center gap-3 text-[var(--text)]">
              <Radar size={18} className="text-[var(--blue)]" />
              <span className="font-medium">Scan running apps</span>
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Discover importable workloads across every connected server.</p>
          </Link>
          <Link
            href="/help"
            className="rounded-[20px] border border-[var(--border)] bg-[rgba(7,16,15,0.35)] p-4 transition-colors hover:bg-[var(--surface-2)]"
          >
            <div className="flex items-center gap-3 text-[var(--text)]">
              <BookOpen size={18} className="text-[var(--yellow)]" />
              <span className="font-medium">Open help guide</span>
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Learn the product model, project types, and recommended setup sequence.</p>
          </Link>
          <div className="rounded-[20px] border border-[var(--border)] bg-[rgba(7,16,15,0.35)] p-4">
            <div className="flex items-center gap-3 text-[var(--text)]">
              <ShieldCheck size={18} className="text-[var(--green)]" />
              <span className="font-medium">Trust-first operations</span>
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Backups, previews, health checks, and activity history are now built into the workflow.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Configured projects</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--text)]">{totalProjects}</div>
          <div className="mt-2 text-sm text-[var(--text-muted)]">
            Counts only Launchpad-managed apps, not every container running on the host.
          </div>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Recommended order</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text)]">Server, then project, then health</div>
          <div className="mt-2 text-sm text-[var(--text-muted)]">
            Add the host, model each app clearly, then configure heartbeat checks before relying on deploy status alone.
          </div>
        </div>
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Next useful action</div>
          <Link href="/help#first-server" className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
            First-server checklist
            <ArrowRight size={16} className="text-[var(--green)]" />
          </Link>
          <div className="mt-2 text-sm text-[var(--text-muted)]">
            The new help page explains SSH setup, project types, and what Launchpad expects from each app style.
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="space-y-4">
          {loading ? (
            <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
              Loading servers...
            </div>
          ) : servers.length > 0 ? (
            servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                status={statuses[server.id] ?? server.lastConnectionStatus}
                resources={resources[server.id] ?? server.lastResourceStatus}
                onTest={() => void handleTest(server.id)}
                testing={testingId === server.id}
              />
            ))
          ) : (
            <div className="rounded-[22px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
              No servers yet. Add your first host to start modeling projects, telemetry, and deploy flows.
            </div>
          )}
        </section>

        <div className="space-y-4">
          <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-3 text-[var(--text)]">
              <Plus size={18} className="text-[var(--green)]" />
              <h2 className="text-lg font-semibold">Add a trusted server</h2>
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Credentials stay local to Launchpad and sensitive fields are encrypted before they touch disk.
            </p>
          </div>
          <ServerForm
            title="Add server"
            description="Use a dedicated deploy user when possible, confirm the key path exists on the Launchpad host, and test SSH right after save."
            submitLabel="Create server"
            onSubmit={handleCreate}
          />
        </div>
      </div>
    </div>
  )
}
