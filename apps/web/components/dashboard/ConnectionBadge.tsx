'use client'

import { StatusPill } from '@/components/ui/StatusPill'

interface ConnectionBadgeProps {
  connected?: boolean
  latencyMs?: number
  error?: string
}

export function ConnectionBadge({ connected, latencyMs, error }: ConnectionBadgeProps) {
  const label =
    connected === undefined
      ? 'Not tested'
      : connected
        ? latencyMs ? `Connected · ${latencyMs} ms` : 'Connected'
        : 'Offline'

  return (
    <StatusPill tone={connected === undefined ? 'neutral' : connected ? 'ok' : 'bad'} title={error || label}>
      {label}
    </StatusPill>
  )
}
