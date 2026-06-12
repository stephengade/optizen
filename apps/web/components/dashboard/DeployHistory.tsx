'use client'

import type { DeployRecord } from '@launchpad/shared'
import { formatDuration, formatRelative } from '@/lib/utils'
import { DeployStatusBadge } from './DeployStatusBadge'

interface DeployHistoryProps {
  records: DeployRecord[]
  selectedId?: string
  onSelect: (deployId: string) => void
}

export function DeployHistory({ records, selectedId, onSelect }: DeployHistoryProps) {
  if (records.length === 0) {
    return (
      <div className=" border border-dashed border-(--border) bg-(--surface) p-5 text-sm text-(--text-muted)">
        No deploy history yet.
      </div>
    )
  }

  return (
    <div className="overflow-hidden  border border-(--border) bg-(--surface)">
      <div className="grid grid-cols-[1.1fr_0.9fr_0.8fr_0.8fr] gap-4 border-b border-(--border) px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-(--text-muted)">
        <span>When</span>
        <span>Status</span>
        <span>Trigger</span>
        <span>Duration</span>
      </div>
      <div>
        {records.map((record) => (
          <button
            key={record.id}
            onClick={() => onSelect(record.id)}
            className={`grid w-full grid-cols-[1.1fr_0.9fr_0.8fr_0.8fr] gap-4 border-b border-(--border) px-4 py-3 text-left text-sm transition-colors last:border-b-0 ${
              selectedId === record.id ? 'bg-(--surface-2)' : 'hover:bg-(--surface-2)'
            }`}
          >
            <span className="text-(--text)">{formatRelative(record.triggeredAt)}</span>
            <span><DeployStatusBadge status={record.status} /></span>
            <span className="text-(--text-muted)">{record.trigger}</span>
            <span className="text-(--text-muted)">
              {record.durationMs ? formatDuration(record.durationMs) : 'Pending'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
