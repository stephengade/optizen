'use client'

import { useState } from 'react'
import { Copy, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useDemoPrivacy } from '@/lib/demo-privacy-context'

interface SensitivePanelProps {
  label: string
  value: string
  emptyLabel?: string
  code?: boolean
}

export function SensitivePanel({ label, value, emptyLabel = 'Not available', code = false }: SensitivePanelProps) {
  const { enabled, mask } = useDemoPrivacy()
  const [revealed, setRevealed] = useState(false)
  const hasValue = Boolean(value)
  const displayValue = hasValue ? (enabled && !revealed ? mask(value) : value) : emptyLabel

  async function handleCopy() {
    if (!hasValue) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`)
    }
  }

  const contentClass = code
    ? 'font-mono text-xs whitespace-pre-wrap break-all'
    : 'text-sm break-all'

  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-medium text-[var(--text)]">{label}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            className="inline-flex items-center gap-1 rounded-[12px] border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
          >
            {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
            {revealed ? 'Hide' : 'Reveal'}
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={!hasValue}
            className="inline-flex items-center gap-1 rounded-[12px] border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)] disabled:opacity-50"
          >
            <Copy size={12} />
            Copy
          </button>
        </div>
      </div>
      <div data-sensitive="true" className={contentClass}>
        {displayValue}
      </div>
    </div>
  )
}
