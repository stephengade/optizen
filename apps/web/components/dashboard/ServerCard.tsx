'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Server as ServerRecord, ServerResourceStatus } from '@launchpad/shared'
import { ArrowRight, Boxes, Clock, EyeOff, KeyRound, Server } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SensitiveText } from '@/components/ui/SensitiveText'
import { Meter } from '@/components/ui/Meter'
import { formatBytes, formatPercent, formatUptime } from '@/lib/format'
import { ConnectionBadge } from './ConnectionBadge'

interface ServerCardProps {
  server: ServerRecord & { projectCount?: number }
  status?: { connected?: boolean; latencyMs?: number; error?: string }
  resources?: ServerResourceStatus
  onTest: () => void
  testing?: boolean
}

const finite = (n: number | undefined): n is number => Number.isFinite(n)

export function ServerCard({ server, status, resources, onTest, testing }: ServerCardProps) {
  const [showSshKey, setShowSshKey] = useState(false)
  const r = resources
  const loadAvg = Array.isArray(r?.loadAverage) ? r.loadAverage : null
  const cores = finite(r?.cpuCoreCount) && r.cpuCoreCount > 0 ? r.cpuCoreCount : null
  const memPct = finite(r?.memoryUsedBytes) && finite(r?.memoryTotalBytes) && r.memoryTotalBytes > 0 ? (r.memoryUsedBytes / r.memoryTotalBytes) * 100 : null
  const diskPct = finite(r?.diskUsedBytes) && finite(r?.diskTotalBytes) && r.diskTotalBytes > 0 ? (r.diskUsedBytes / r.diskTotalBytes) * 100 : null

  return (
    <article className="overflow-hidden rounded-(--radius-lg) border border-(--border) bg-(--surface) transition-colors hover:border-(--border-strong)">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 pt-4.5 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] border border-(--border) bg-(--surface-3) text-(--text-muted)">
            <Server size={15} />
          </div>
          <div className="min-w-0">
            <Link href={`/servers/${server.id}`} className="block truncate text-[14.5px] font-semibold text-(--text) hover:underline underline-offset-4">
              {server.name}
            </Link>
            <div className="mt-0.5 flex min-w-0 items-center gap-2 font-mono text-xs text-(--text-subtle)">
              <span className="truncate">
                {showSshKey ? <SensitiveText value={server.sshKeyPath} /> : <SensitiveText value={`${server.user}@${server.host}:${server.port}`} />}
              </span>
              <button
                type="button"
                onClick={() => setShowSshKey((v) => !v)}
                className="shrink-0 rounded p-0.5 transition-colors hover:text-(--text)"
                title={showSshKey ? 'Show host' : 'Show SSH key path'}
                aria-label={showSshKey ? 'Show host' : 'Show SSH key path'}
              >
                {showSshKey ? <EyeOff size={12} /> : <KeyRound size={12} />}
              </button>
            </div>
          </div>
        </div>
        <ConnectionBadge {...status} />
      </div>

      {/* Meters */}
      <div className="grid gap-4.5 px-5 pb-4.5 sm:grid-cols-3">
        <Meter
          label="CPU"
          value={finite(r?.cpuUsagePercent) ? `${formatPercent(r.cpuUsagePercent, 1)}${cores ? ` · ${cores}c` : ''}` : cores ? `${cores} cores` : '—'}
          percent={finite(r?.cpuUsagePercent) ? r.cpuUsagePercent : 0}
        />
        <Meter
          label="Memory"
          value={memPct !== null ? `${formatBytes(r!.memoryUsedBytes!)} / ${formatBytes(r!.memoryTotalBytes!)}` : '—'}
          percent={memPct ?? 0}
        />
        <Meter
          label="Disk"
          value={diskPct !== null ? `${formatBytes(r!.diskUsedBytes!)} / ${formatBytes(r!.diskTotalBytes!)}` : '—'}
          percent={diskPct ?? 0}
        />
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--border) bg-(--bg-subtle) px-5 py-2.5 text-[12.5px] text-(--text-muted)">
        <div className="flex flex-wrap items-center gap-x-4.5 gap-y-1">
          <span className="flex items-center gap-1.5"><Boxes size={14} />{server.projectCount ?? 0} projects</span>
          {finite(r?.uptimeSeconds) && <span className="flex items-center gap-1.5"><Clock size={14} />up {formatUptime(r.uptimeSeconds)}</span>}
          {loadAvg && <span className="font-mono">load {loadAvg.map((v) => v.toFixed(2)).join(' ')}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onTest} loading={testing}>
            Test SSH
          </Button>
          <Link
            href={`/servers/${server.id}`}
            className="inline-flex h-[30px] items-center gap-1.5 rounded-(--radius-sm) px-2.5 text-[12.5px] font-medium text-(--text) transition-colors hover:bg-white/[0.05]"
          >
            Open
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  )
}
