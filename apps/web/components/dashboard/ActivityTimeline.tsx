'use client'

import type { ActivityEvent } from '@launchpad/shared'
import { formatDateTime, formatRelative } from '@/lib/utils'

interface ActivityTimelineProps {
  events: ActivityEvent[]
  emptyLabel: string
}

export function ActivityTimeline({ events, emptyLabel }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className=" border border-dashed border-(--border) bg-(--surface) p-5 text-sm text-(--text-muted)">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-(--border) bg-(--surface)">
      {events.map((event, index) => (
        <div key={event.id} className={`px-5 py-4 ${index === events.length - 1 ? '' : 'border-b border-(--border)'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-medium text-(--text)">{event.title}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-(--text-muted)" title={formatDateTime(event.createdAt)}>
              {formatRelative(event.createdAt)}
            </div>
          </div>
          {event.detail ? <p className="mt-1 text-sm text-(--text-muted)">{event.detail}</p> : null}
        </div>
      ))}
    </div>
  )
}
