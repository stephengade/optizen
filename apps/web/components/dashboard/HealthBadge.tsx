'use client'

import type { ProjectHealthStatus } from '@launchpad/shared'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'

const tones: Record<ProjectHealthStatus, StatusTone> = {
  unknown: 'neutral',
  healthy: 'ok',
  degraded: 'warn',
  down: 'bad',
}

const labels: Record<ProjectHealthStatus, string> = {
  unknown: 'Unknown',
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
}

export function HealthBadge({ status = 'unknown' }: { status?: ProjectHealthStatus }) {
  return <StatusPill tone={tones[status]}>{labels[status]}</StatusPill>
}
