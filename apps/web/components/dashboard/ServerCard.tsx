'use client'

import Link from 'next/link'
import type { Server } from '@launchpad/shared'
import { ArrowRight, FolderGit2, PlugZap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConnectionBadge } from './ConnectionBadge'

interface ServerCardProps {
  server: Server & { projectCount?: number }
  status?: { connected?: boolean; latencyMs?: number; error?: string }
  onTest: () => void
  testing?: boolean
}

export function ServerCard({ server, status, onTest, testing }: ServerCardProps) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">{server.name}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {server.user}@{server.host}:{server.port}
          </p>
        </div>
        <ConnectionBadge {...status} />
      </div>

      <div className="mt-5 flex items-center gap-4 text-sm text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2">
          <FolderGit2 size={14} />
          {server.projectCount ?? 0} project{server.projectCount === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-2 truncate">
          <PlugZap size={14} />
          {server.sshKeyPath}
        </span>
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
