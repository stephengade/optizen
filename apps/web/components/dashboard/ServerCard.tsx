'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Server, ServerResourceStatus } from '@launchpad/shared'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SensitiveText } from '@/components/ui/SensitiveText'
import { formatBytes, formatPercent, formatUptime } from '@/lib/format'
import { ConnectionBadge } from './ConnectionBadge'

interface ServerCardProps {
  server: Server & { projectCount?: number }
  status?: { connected?: boolean; latencyMs?: number; error?: string }
  resources?: ServerResourceStatus
  onTest: () => void
  testing?: boolean
}

export function ServerCard({ server, status, resources, onTest, testing }: ServerCardProps) {
  const [showSshKey, setShowSshKey] = useState(false)
  const loadAvg = Array.isArray(resources?.loadAverage) ? resources.loadAverage : null
  const hasCpuUsage = Number.isFinite(resources?.cpuUsagePercent)
  const hasCpuCapacity = Number.isFinite(resources?.cpuCoreCount) && (resources?.cpuCoreCount ?? 0) > 0
  const hasMemoryStats =
    Number.isFinite(resources?.memoryUsedBytes) &&
    Number.isFinite(resources?.memoryTotalBytes)
  const hasDiskStats =
    Number.isFinite(resources?.diskUsedBytes) &&
    Number.isFinite(resources?.diskTotalBytes)
  const hasUptime = Number.isFinite(resources?.uptimeSeconds)
  const hasInodeStats = Number.isFinite(resources?.diskInodesUsedPercent)

  return (
    <article className="border border-(--border) bg-(--surface) p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-(--text)">{server.name}</h2>
          <p className="mt-0.5 text-xs text-(--text-muted)">
            <SensitiveText value={`${server.user}@${server.host}:${server.port}`} />
          </p>
        </div>
        <ConnectionBadge {...status} />
      </div>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 border border-(--border) divide-x divide-(--border)">
        <Metric
          label="CPU"
          value={
            hasCpuUsage
              ? `${formatPercent(resources!.cpuUsagePercent!, 1)}${hasCpuCapacity ? ` / ${resources!.cpuCoreCount}c` : ''}`
              : hasCpuCapacity
                ? `${resources!.cpuCoreCount}c`
                : '—'
          }
        />
        <Metric label="RAM" value={hasMemoryStats ? `${formatBytes(resources!.memoryUsedBytes!)} / ${formatBytes(resources!.memoryTotalBytes!)}` : '—'} />
        <Metric label="Disk" value={hasDiskStats ? `${formatBytes(resources!.diskUsedBytes!)} / ${formatBytes(resources!.diskTotalBytes!)}` : '—'} />
        <Metric label="Uptime" value={hasUptime ? formatUptime(resources!.uptimeSeconds!) : '—'} />
      </div>

      {/* Secondary metrics */}
      <div className="mt-px grid grid-cols-2 md:grid-cols-3 border border-(--border) border-t-0 divide-x divide-(--border)">
        <Metric label="Load avg" value={loadAvg ? loadAvg.map((v) => v.toFixed(2)).join(' / ') : '—'} />
        <Metric label="Inodes" value={hasInodeStats ? formatPercent(resources!.diskInodesUsedPercent!) : '—'} />
        <div className="col-span-2 md:col-span-1 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-(--text-muted) mb-1">Projects</div>
          <div className="text-sm text-(--text)">{server.projectCount ?? 0}</div>
        </div>
      </div>

      {/* SSH key row */}
      <div className="mt-px border border-(--border) border-t-0 px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-(--text-muted) mb-0.5">SSH key path</div>
          <div className="text-xs text-(--text) font-mono break-all">
            {showSshKey ? <SensitiveText value={server.sshKeyPath} /> : '•••••••••••••'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSshKey((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-(--text-muted) hover:text-(--text) transition-colors shrink-0"
        >
          {showSshKey ? <EyeOff size={11} /> : <Eye size={11} />}
          {showSshKey ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onTest} loading={testing}>
          Test SSH
        </Button>
        <Link
          href={`/servers/${server.id}`}
          className="inline-flex h-7 items-center gap-1.5 border border-(--border) px-3 text-xs text-(--text-muted) hover:text-(--text) hover:border-(--border-strong) transition-colors"
        >
          Open
          <ArrowRight size={12} />
        </Link>
      </div>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-(--text-muted) mb-1">{label}</div>
      <div className="text-sm text-(--text)">{value}</div>
    </div>
  )
}
