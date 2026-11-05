'use client'

import { cn } from '@/lib/utils'

interface ConnectionBadgeProps {
  connected?: boolean
  latencyMs?: number
  error?: string
}

export function ConnectionBadge({ connected, latencyMs, error }: ConnectionBadgeProps) {
  const dot =
    connected === undefined
      ? 'bg-(--text-muted)'
      : connected
        ? 'bg-(--accent)'
        : 'bg-(--red)'

  const label =
    connected === undefined
      ? 'unknown'
      : connected
        ? latencyMs ? `online · ${latencyMs}ms` : 'online'
        : 'offline'

  return (
    <span
      title={error || label}
      className="inline-flex items-center gap-1.5 border border-(--border) px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-(--text-muted)"
    >
      <span className={cn('h-1.5 w-1.5 shrink-0', dot)} />
      {label}
    </span>
  )
}
