'use client'

import type { ProjectHealthStatus } from '@launchpad/shared'

interface HealthBadgeProps {
  status?: ProjectHealthStatus
}

const styles: Record<ProjectHealthStatus, string> = {
  unknown: 'border-(--border) text-(--text-muted)',
  healthy: 'border-(--accent) text-(--accent)',
  degraded: 'border-(--yellow) text-(--yellow)',
  down: 'border-(--red) text-(--red)',
}

export function HealthBadge({ status = 'unknown' }: HealthBadgeProps) {
  return (
    <span className={`inline-flex border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${styles[status]}`}>
      {status}
    </span>
  )
}
