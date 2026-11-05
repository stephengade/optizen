'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Server, ServerConnectionStatus, ServerResourceStatus, SmtpConfig } from '@launchpad/shared'
import { Mail, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { ServerCard } from '@/components/dashboard/ServerCard'
import { ServerForm } from '@/components/dashboard/ServerForm'
import { LoadingState } from '@/components/ui/LoadingState'
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
  const [showForm, setShowForm] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  // The form opens below the stats; bring it into view so the click visibly does something.
  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showForm])
  const [smtpConfigured, setSmtpConfigured] = useState(true)
  const [showNotificationBanner, setShowNotificationBanner] = useState(false)

  function handleDismissBanner() {
    localStorage.setItem('optizen_dismiss_smtp_alert', 'true')
    setShowNotificationBanner(false)
  }

  async function loadServers() {
    if (demoMode) {
      setServers(demoServers)
      setResources(
        Object.fromEntries(
          demoServers
            .filter((s) => s.lastResourceStatus)
            .map((s) => [s.id, s.lastResourceStatus!])
        )
      )
      setSmtpConfigured(false)
      const isDismissed = localStorage.getItem('optizen_dismiss_smtp_alert') === 'true'
      setShowNotificationBanner(!isDismissed)
      setLoading(false)
      return
    }

    try {
      const [data, notificationsData] = await Promise.all([
        api.get<ServerSummary[]>('/servers'),
        api.get<{ email: SmtpConfig | null }>('/notifications/settings').catch(() => ({ email: null }))
      ])
      setServers(data)
      setResources(
        Object.fromEntries(
          data.filter((s) => s.lastResourceStatus).map((s) => [s.id, s.lastResourceStatus!])
        )
      )

      const isConfigured = !!notificationsData?.email
      setSmtpConfigured(isConfigured)
      const isDismissed = localStorage.getItem('optizen_dismiss_smtp_alert') === 'true'
      setShowNotificationBanner(!isConfigured && !isDismissed)

      const snapshots = await Promise.allSettled(
        data.map(async (s) => {
          const resource = await api.get<ServerResourceStatus>(`/servers/${s.id}/resources`)
          return [s.id, resource] as const
        })
      )

      setResources((cur) => {
        const next = { ...cur }
        for (const snap of snapshots) {
          if (snap.status === 'fulfilled') next[snap.value[0]] = snap.value[1]
        }
        return next
      })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load servers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadServers() }, [demoMode])

  async function handleCreate(payload: {
    name: string; host: string; port: number; user: string; sshKeyPath: string; sshPassphrase?: string; clearSshPassphrase?: boolean
  }) {
    if (demoMode) {
      toast.success('Demo mode is active — data stays read-only.')
      return
    }
    const created = await api.post<ServerSummary>('/servers', payload)
    setServers((cur) => [created, ...cur])
    setShowForm(false)
    toast.success('Server added')
    // Fill in status + telemetry right away instead of leaving the new card blank.
    void handleTest(created.id)
  }

  async function handleTest(serverId: string) {
    if (demoMode) {
      toast.success('Demo mode — telemetry is seeded.')
      return
    }
    setTestingId(serverId)
    try {
      const status = await api.post<ServerConnectionStatus>(`/servers/${serverId}/test`)
      setStatuses((cur) => ({ ...cur, [serverId]: status }))
      setServers((cur) =>
        cur.map((s) => s.id === serverId ? { ...s, lastConnectionStatus: status } : s)
      )
      try {
        const resource = await api.get<ServerResourceStatus>(`/servers/${serverId}/resources`)
        setResources((cur) => ({ ...cur, [serverId]: resource }))
      } catch { /* keep previous */ }
      toast.success(status.connected ? 'SSH connected' : status.error ?? 'SSH failed')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to test connection')
    } finally {
      setTestingId(null)
    }
  }

  const onlineCount = servers.filter((s) => (statuses[s.id] ?? s.lastConnectionStatus)?.connected).length
  const totalProjects = servers.reduce((sum, s) => sum + (s.projectCount ?? 0), 0)
  const cpuSnapshots = Object.values(resources).filter((resource) => Number.isFinite(resource.cpuUsagePercent))
  const avgCpu = cpuSnapshots.length
    ? cpuSnapshots.reduce((sum, resource) => sum + (resource.cpuUsagePercent ?? 0), 0) / cpuSnapshots.length
    : null

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-(--text)">Servers</h1>
          <p className="mt-1 text-sm text-(--text-muted)">SSH trust, machine telemetry, and host-level context.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 h-8 px-3 border border-(--border) text-sm text-(--text-muted) hover:text-(--text) hover:border-(--border-strong) transition-colors"
        >
          <Plus size={14} />
          Add server
        </button>
      </div>

      {showNotificationBanner && (
        <div className="flex items-center justify-between border border-(--border) bg-(--bg-subtle) px-5 py-3 mb-8 text-sm gap-4 transition-all animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center h-8 w-8 bg-(--accent-dim) text-(--accent) shrink-0">
              <Mail size={15} />
            </span>
            <div>
              <span className="font-semibold text-(--text)">Email notifications are inactive.</span>{' '}
              <span className="text-(--text-muted)">Configure SMTP settings to get notified when deployments fail or server disks run low.</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/settings"
              className="text-xs font-semibold text-(--accent) hover:underline underline-offset-4"
            >
              Configure settings →
            </Link>
            <button
              type="button"
              onClick={handleDismissBanner}
              className="text-(--text-muted) hover:text-(--text) p-1 transition-colors"
              aria-label="Dismiss banner"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 border border-(--border) divide-x divide-(--border) mb-8">
        <div className="px-5 py-4">
          <div className="text-xs uppercase tracking-[0.16em] text-(--text-muted)">Total</div>
          <div className="mt-1.5 text-2xl font-semibold text-(--text)">{servers.length}</div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs uppercase tracking-[0.16em] text-(--text-muted)">Online</div>
          <div className="mt-1.5 text-2xl font-semibold text-(--text)">{onlineCount}</div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs uppercase tracking-[0.16em] text-(--text-muted)">Avg CPU</div>
          <div className="mt-1.5 text-2xl font-semibold text-(--text)">
            {avgCpu !== null ? formatPercent(avgCpu, 1) : '—'}
          </div>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div ref={formRef} className="mb-8 scroll-mt-20 border border-(--border) bg-(--surface)">
          <div className="px-5 py-4 border-b border-(--border)">
            <h2 className="text-sm font-semibold text-(--text)">Add server</h2>
            <p className="mt-1 text-xs text-(--text-muted)">Use a dedicated deploy user. Sensitive fields are encrypted at rest.</p>
          </div>
          <div className="p-5">
            <ServerForm
              title=""
              description=""
              submitLabel="Create server"
              inModal
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {/* Server list */}
      <div className="space-y-px">
        {loading ? (
          <LoadingState label="Loading servers" detail="Fetching server records and the latest saved telemetry." compact />
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
          <div className="border border-dashed border-(--border) px-5 py-10 text-center">
            <p className="text-sm text-(--text-muted)">No servers yet.</p>
            <p className="mt-1 text-xs text-(--text-subtle)">Add your first host to start modeling projects and deploy flows.</p>
          </div>
        )}
      </div>

      {/* Secondary info */}
      {!loading && servers.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 border border-(--border) divide-y md:divide-y-0 md:divide-x divide-(--border)">
          <div className="px-5 py-5">
            <div className="text-xs uppercase tracking-[0.16em] text-(--text-muted) mb-2">Managed projects</div>
            <div className="text-lg font-semibold text-(--text)">{totalProjects}</div>
            <p className="mt-1 text-xs text-(--text-muted)">Optizen-managed apps only — not every container on the host.</p>
          </div>
          <div className="px-5 py-5">
            <div className="text-xs uppercase tracking-[0.16em] text-(--text-muted) mb-2">Recommended order</div>
            <div className="text-sm text-(--text-muted)">Server → project → health check</div>
            <p className="mt-1 text-xs text-(--text-muted)">
              Configure heartbeats before relying on deploy status alone.{' '}
              <Link href="/help/setup" className="text-(--text) underline underline-offset-2">Setup guide →</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
