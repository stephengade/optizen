'use client'

import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  label: string
  detail?: string
  compact?: boolean
}

export function LoadingState({ label, detail, compact = false }: LoadingStateProps) {
  return (
    <div
      className={`border border-(--border) bg-(--surface) text-(--text-muted) ${
        compact ? 'px-5 py-6' : 'p-6'
      }`}
    >
      <div className="flex items-center gap-3">
        <Loader2 size={16} className="animate-spin text-(--text-muted)" />
        <div>
          <div className="text-sm text-(--text)">{label}</div>
          {detail ? <div className="mt-0.5 text-xs text-(--text-muted)">{detail}</div> : null}
        </div>
      </div>
    </div>
  )
}
