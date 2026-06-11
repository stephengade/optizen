'use client'

import type { ProjectHealthStatus } from '@launchpad/shared'

interface HealthBadgeProps {
  status?: ProjectHealthStatus
}

const classes: Record<ProjectHealthStatus, string> = {
  unknown: 'border-[var(--border)] text-[var(--text-muted)]',
  healthy: 'border-[var(--green)] text-[var(--green)] bg-[var(--green-dim)]',
  degraded: 'border-[var(--yellow)] text-[var(--yellow)]',
  down: 'border-[var(--red)] text-[var(--red)] bg-[var(--red-dim)]',
}

export function HealthBadge({ status = 'unknown' }: HealthBadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${classes[status]}`}>
      {status}
    </span>
  )
}
