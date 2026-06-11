'use client'

import { useEffect, useRef } from 'react'

export interface LogLine {
  id: string
  text: string
  timestamp: string
}

interface LogStreamProps {
  lines: LogLine[]
}

export function LogStream({ lines }: LogStreamProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [lines])

  return (
    <div
      ref={containerRef}
      className="h-96 overflow-auto rounded-xl border border-[var(--border)] bg-[#0b0b0d] px-4 py-3 font-mono text-xs"
    >
      {lines.length > 0 ? (
        <div className="space-y-2">
          {lines.map((line) => {
            const isStdErr = line.text.includes('[stderr]') || line.text.includes('[error]')
            const isCommand = line.text.startsWith('$ ')
            return (
              <div key={line.id} className="grid grid-cols-[72px_1fr] gap-3">
                <span className="text-[var(--text-muted)]">{line.timestamp}</span>
                <span
                  className={
                    isStdErr
                      ? 'text-[var(--yellow)]'
                      : isCommand
                        ? 'text-[var(--green)]'
                        : 'text-[var(--text)]'
                  }
                >
                  {line.text}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-[var(--text-muted)]">No live logs yet. Trigger a deploy to start streaming output.</p>
      )}
    </div>
  )
}
