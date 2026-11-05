'use client'

import type { DeployStatus } from '@launchpad/shared'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'

const tones: Record<DeployStatus, StatusTone> = {
  idle: 'neutral',
  deploying: 'info',
  success: 'ok',
  failed: 'bad',
}

const labels: Record<DeployStatus, string> = {
  idle: 'Idle',
  deploying: 'Deploying',
  success: 'Success',
  failed: 'Failed',
}

export function DeployStatusBadge({ status }: { status: DeployStatus }) {
  return (
    <StatusPill tone={tones[status]} pulse={status === 'deploying'}>
      {labels[status]}
    </StatusPill>
  )
}
