'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Server, ServerConnectionStatus, ServerResourceStatus, SmtpConfig } from '@launchpad/shared'
import { Boxes, Cpu, Mail, MemoryStick, Plus, ScanSearch, Server as ServerIcon, X } from 'lucide-react'
import { toast } from 'sonner'
import { ServerCard } from '@/components/dashboard/ServerCard'
import { ServerForm } from '@/components/dashboard/ServerForm'
import { LoadingState } from '@/components/ui/LoadingState'
import { api, ApiError } from '@/lib/api'
import { demoServers } from '@/lib/demo-fixtures'
import { useDemoPrivacy } from '@/lib/demo-privacy-context'
import { formatBytes, formatPercent } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { EmptyState, PageHeader, SectionHeader, StatCard } from '@/components/ui/Page'

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

  const memTotals = Object.values(resources).reduce(
    (acc, r) => Number.isFinite(r.memoryUsedBytes) && Number.isFinite(r.memoryTotalBytes)
      ? { used: acc.used + r.memoryUsedBytes!, total: acc.total + r.memoryTotalBytes! }
      : acc,
    { used: 0, total: 0 }
  )

  return (
    <div className="mx-auto max-w-310 px-6 pt-8 pb-24 lg:px-7">
      <PageHeader
        title="Servers"
        description="Connected hosts, their health, and what runs on them."
        actions={
          <>
            <Link href="/scan" className="inline-flex h-9 items-center gap-2 rounded-(--radius-sm) border border-(--border-strong) bg-white/[0.03] px-4 text-[13.5px] font-medium text-(--text) transition-colors hover:bg-white/[0.06]">
              <ScanSearch size={15} />
              Scan
            </Link>
            <Button onClick={() => setShowForm((v) => !v)}>
              <Plus size={15} />
              Add server
            </Button>
          </>
        }
      />

      {showNotificationBanner && (
        <div className="mt-7 flex items-center justify-between gap-4 rounded-(--radius-lg) border border-(--accent-border) bg-[linear-gradient(90deg,var(--accent-dim),transparent)] px-5 py-3.5 text-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-(--accent-dim) text-(--accent)">
              <Mail size={15} />
            </span>
            <div>
              <span className="font-medium text-(--text)">Email notifications are off.</span>{' '}
              <span className="text-(--text-muted)">Set up SMTP to hear about failed deploys and full disks.</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/settings" className="text-[13px] font-medium text-(--accent) underline-offset-4 hover:underline">
              Set up email
            </Link>
            <button type="button" onClick={handleDismissBanner} className="rounded p-1 text-(--text-muted) transition-colors hover:text-(--text)" aria-label="Dismiss banner">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={ServerIcon}
          label="Servers online"
          value={<>{onlineCount} <span className="text-lg text-(--text-subtle)">/ {servers.length}</span></>}
          note={servers.length === 0 ? 'No servers yet' : onlineCount === servers.length ? 'All reachable' : `${servers.length - onlineCount} not reachable`}
          tone={servers.length > 0 && onlineCount === servers.length ? 'good' : servers.length > onlineCount ? 'warn' : undefined}
        />
        <StatCard icon={Boxes} label="Projects" value={totalProjects} note="Managed by Optizen" />
        <StatCard
          icon={Cpu}
          label="Average CPU"
          value={avgCpu !== null ? formatPercent(avgCpu, 1) : '—'}
          note={cpuSnapshots.length ? `Across ${cpuSnapshots.length} server${cpuSnapshots.length === 1 ? '' : 's'}` : 'No telemetry yet'}
        />
        <StatCard
          icon={MemoryStick}
          label="Memory in use"
          value={memTotals.total ? formatPercent((memTotals.used / memTotals.total) * 100) : '—'}
          note={memTotals.total ? `${formatBytes(memTotals.used)} of ${formatBytes(memTotals.total)}` : 'No telemetry yet'}
        />
      </div>

      {/* Add form */}
      {showForm && (
        <div ref={formRef} className="mt-8 scroll-mt-20 overflow-hidden rounded-(--radius-lg) border border-(--border-strong) bg-(--surface)">
          <div className="border-b border-(--border) px-5 py-4">
            <h2 className="text-[15px] font-semibold text-(--text)">Add server</h2>
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
      <SectionHeader title="Fleet" />
      <div className="grid gap-3.5 xl:grid-cols-2">
        {loading ? (
          <div className="xl:col-span-2"><LoadingState label="Loading servers" detail="Fetching server records and the latest saved telemetry." compact /></div>
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
          <EmptyState
            icon={ServerIcon}
            title="No servers yet"
            description="Add your first host over SSH to start tracking projects and deploys."
            action={<Button onClick={() => setShowForm(true)}><Plus size={15} />Add server</Button>}
            className="xl:col-span-2"
          />
        )}
      </div>

      {/* Secondary info */}
      {!loading && servers.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-(--radius-lg) border border-(--border) bg-(--bg-subtle) px-5 py-4 text-[13px] text-(--text-muted)">
          <span>
            Recommended order: <span className="text-(--text)">server → project → health check</span>. Set up heartbeats before relying on deploy status alone.
          </span>
          <Link href="/help/setup" className="font-medium text-(--accent) underline-offset-4 hover:underline">Setup guide</Link>
        </div>
      )}
    </div>
  )
}
