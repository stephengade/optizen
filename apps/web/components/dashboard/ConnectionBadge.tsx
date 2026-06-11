'use client'

import { cn } from '@/lib/utils'

interface ConnectionBadgeProps {
  connected?: boolean
  latencyMs?: number
  error?: string
}

export function ConnectionBadge({ connected, latencyMs, error }: ConnectionBadgeProps) {
  const tone =
    connected === undefined
      ? 'bg-[var(--text-muted)]'
      : connected
        ? 'bg-[var(--green)]'
        : 'bg-[var(--red)]'

  const label =
    connected === undefined
      ? 'Unknown'
      : connected
        ? latencyMs
          ? `${latencyMs}ms`
          : 'Online'
        : 'Offline'

  return (
    <span
      title={error || label}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--text-muted)]"
    >
      <span className={cn('h-2 w-2 rounded-full', tone)} />
      <span>{label}</span>
    </span>
  )
}
