'use client'

import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/utils'

interface LogSource {
  id: string
  label: string
}

interface ProjectLogsPanelProps {
  sources: LogSource[]
  selectedSource: string
  lines: string[]
  checkedAt?: string
  loading?: boolean
  autoRefresh?: boolean
  onSourceChange: (source: string) => void
  onRefresh: () => void
  onAutoRefreshToggle: () => void
}

export function ProjectLogsPanel({
  sources,
  selectedSource,
  lines,
  checkedAt,
  loading,
  autoRefresh,
  onSourceChange,
  onRefresh,
  onAutoRefreshToggle,
}: ProjectLogsPanelProps) {
  return (
    <section className="border border-(--border) bg-(--surface) p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-(--text)">Project logs</h2>
          <p className="mt-1 text-sm text-(--text-muted)">
            Snapshot recent runtime logs without leaving Optizen. Auto-refresh gives you a lightweight tailing experience.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" size="sm" onClick={onAutoRefreshToggle}>
            {autoRefresh ? 'Stop auto-refresh' : 'Auto-refresh'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onRefresh} loading={loading}>
            Refresh logs
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={selectedSource}
          onChange={(event) => onSourceChange(event.target.value)}
          className="h-10 border border-(--border) bg-(--surface-2) px-3 text-sm text-(--text) outline-none focus:border-(--border-strong)"
        >
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
        <div className="text-sm text-(--text-muted)">
          {checkedAt ? `Last snapshot: ${formatDateTime(checkedAt)}` : 'No snapshot loaded yet'}
        </div>
      </div>

      <div className="mt-5 h-96 overflow-auto  border border-(--border) bg-[#0b0b0d] px-4 py-3 font-mono text-xs text-(--text)">
        {lines.length > 0 ? (
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={`${selectedSource}-${index}`}>{line}</div>
            ))}
          </div>
        ) : (
          <div className="text-(--text-muted)">No project logs returned for this source yet.</div>
        )}
      </div>
    </section>
  )
}
