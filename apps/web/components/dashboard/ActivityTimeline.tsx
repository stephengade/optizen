'use client'

import { useState } from 'react'
import type { ActivityEvent } from '@launchpad/shared'
import { formatDateTime, formatRelative } from '@/lib/utils'
import { Check, ChevronDown, ChevronUp, Copy, Terminal } from 'lucide-react'

interface ActivityTimelineProps {
  events: ActivityEvent[]
  emptyLabel: string
}

function StatusDot({ status }: { status: ActivityEvent['status'] }) {
  const colorMap = {
    success: 'bg-(--accent) shadow-[0_0_8px_rgba(200,255,87,0.4)]',
    error: 'bg-(--red) shadow-[0_0_8px_rgba(255,82,82,0.4)]',
    warning: 'bg-(--yellow) shadow-[0_0_8px_rgba(245,166,35,0.4)]',
    info: 'bg-(--blue) shadow-[0_0_8px_rgba(91,156,246,0.4)]',
  }

  const bgClass = colorMap[status] || colorMap.info

  return <div className={`h-2.5 w-2.5 rounded-full ${bgClass}`} />
}

function EventDetail({ detail }: { detail: string }) {
  const isLog = detail.includes('\n') || detail.trim().startsWith('$')
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  if (!isLog) {
    return <p className="mt-1.5 text-sm text-(--text-muted) leading-relaxed">{detail}</p>
  }

  const lines = detail.split('\n')
  const hasManyLines = lines.length > 5
  const displayedLines = isExpanded ? lines : lines.slice(0, 5)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(detail)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  return (
    <div className="mt-3 overflow-hidden border border-(--border) bg-[#0b0b0d] font-mono text-xs">
      {/* Terminal header */}
      <div className="flex items-center justify-between border-b border-(--border) bg-[#121215] px-3 py-1.5 select-none">
        <div className="flex items-center gap-2 text-(--text-muted)">
          <Terminal className="h-3.5 w-3.5" />
          <span className="text-[10px] uppercase tracking-wider font-semibold">Console Output</span>
        </div>
        <button
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium text-(--text-muted) hover:bg-(--surface-2) hover:text-(--text) transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-(--accent)" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Log lines */}
      <div className="relative p-3">
        <pre className="max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all text-(--text-muted) leading-5 pr-2">
          {displayedLines.join('\n')}
          {!isExpanded && hasManyLines ? '\n...' : ''}
        </pre>
      </div>

      {/* Expand/Collapse Toggle if many lines */}
      {hasManyLines && (
        <div className="border-t border-(--border) bg-[#121215]/50">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex w-full items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium text-(--text-muted) hover:bg-(--surface-2) hover:text-(--text) transition-colors cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Collapse Output</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Expand Output ({lines.length - 5} more lines)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export function ActivityTimeline({ events, emptyLabel }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="border border-dashed border-(--border) bg-(--surface) p-5 text-sm text-(--text-muted)">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="border border-(--border) bg-(--surface) divide-y divide-(--border)">
      {events.map((event) => (
        <div key={event.id} className="p-5 transition-colors duration-200 hover:bg-(--bg-subtle)/40">
          <div className="flex items-start gap-3">
            {/* Status Dot */}
            <div className="mt-1.5 shrink-0">
              <StatusDot status={event.status} />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-(--text)">{event.title}</div>
                <div 
                  className="text-xs uppercase tracking-[0.18em] text-(--text-muted) select-none" 
                  title={formatDateTime(event.createdAt)}
                >
                  {formatRelative(event.createdAt)}
                </div>
              </div>
              {event.detail ? <EventDetail detail={event.detail} /> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

