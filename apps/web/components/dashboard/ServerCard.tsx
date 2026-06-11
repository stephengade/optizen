'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Server, ServerResourceStatus } from '@launchpad/shared'
import { Activity, ArrowRight, Cpu, Eye, EyeOff, FolderGit2, HardDrive, PlugZap, TimerReset } from 'lucide-react'
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

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">{server.name}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            <SensitiveText value={`${server.user}@${server.host}:${server.port}`} />
          </p>
        </div>
        <ConnectionBadge {...status} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <FolderGit2 size={13} />
            Projects
          </div>
          <div className="mt-2 text-sm text-[var(--text)]">
            {server.projectCount ?? 0} project{server.projectCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <PlugZap size={13} />
              SSH Key
            </div>
            <button
              type="button"
              onClick={() => setShowSshKey((current) => !current)}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              {showSshKey ? <EyeOff size={12} /> : <Eye size={12} />}
              {showSshKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="mt-2 break-all text-sm text-[var(--text)]">
            {showSshKey ? <SensitiveText value={server.sshKeyPath} /> : '*****'}
          </div>
        </div>

        <div className="border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <Cpu size={13} />
            CPU
          </div>
          <div className="mt-2 text-sm text-[var(--text)]">
            {resources ? formatPercent(resources.cpuUsagePercent, 1) : 'n/a'}
          </div>
        </div>

        <div className="border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <Activity size={13} />
            RAM
          </div>
          <div className="mt-2 text-sm text-[var(--text)]">
            {resources ? `${formatBytes(resources.memoryUsedBytes)} / ${formatBytes(resources.memoryTotalBytes)}` : 'n/a'}
          </div>
        </div>

        <div className="border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <HardDrive size={13} />
            Disk
          </div>
          <div className="mt-2 text-sm text-[var(--text)]">
            {resources ? `${formatBytes(resources.diskUsedBytes)} / ${formatBytes(resources.diskTotalBytes)}` : 'n/a'}
          </div>
        </div>

        <div className="border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <TimerReset size={13} />
            Uptime
          </div>
          <div className="mt-2 text-sm text-[var(--text)]">
            {resources ? formatUptime(resources.uptimeSeconds) : 'n/a'}
          </div>
        </div>

        <div className="border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Load Avg</div>
          <div className="mt-2 text-sm text-[var(--text)]">
            {resources ? resources.loadAverage.map((value) => value.toFixed(2)).join(' / ') : 'n/a'}
          </div>
        </div>

        <div className="border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Inodes + Containers</div>
          <div className="mt-2 text-sm text-[var(--text)]">
            {resources
              ? `${formatPercent(resources.diskInodesUsedPercent)} inode use, ${resources.runningContainers} up`
              : 'n/a'}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button size="sm" variant="ghost" onClick={onTest} loading={testing}>
          Test SSH
        </Button>
        <Link
          href={`/servers/${server.id}`}
          className="inline-flex h-8 items-center gap-2 rounded border border-[var(--border)] px-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
        >
          Open
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  )
}
