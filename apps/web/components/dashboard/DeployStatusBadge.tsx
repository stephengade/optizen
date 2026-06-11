'use client'

import type { DeployStatus } from '@launchpad/shared'
import { cn } from '@/lib/utils'

interface DeployStatusBadgeProps {
  status: DeployStatus
}

const STATUS_STYLES: Record<DeployStatus, string> = {
  idle: 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]',
  deploying: 'border-[var(--blue)] bg-[color:rgba(78,158,255,0.12)] text-[var(--blue)]',
  success: 'border-[var(--green)] bg-[var(--green-dim)] text-[var(--green)]',
  failed: 'border-[var(--red)] bg-[var(--red-dim)] text-[var(--red)]',
}

export function DeployStatusBadge({ status }: DeployStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]',
        STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  )
}
