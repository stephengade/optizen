'use client'

import type { DeployStatus } from '@launchpad/shared'
import { cn } from '@/lib/utils'

interface DeployStatusBadgeProps {
  status: DeployStatus
}

const STATUS_STYLES: Record<DeployStatus, string> = {
  idle: 'border-(--border) text-(--text-muted)',
  deploying: 'border-(--blue) text-(--blue)',
  success: 'border-(--accent) text-(--accent)',
  failed: 'border-(--red) bg-(--red-dim) text-(--red)',
}

export function DeployStatusBadge({ status }: DeployStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]',
        STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  )
}
