'use client'

import type { ProjectFileSuggestion } from '@launchpad/shared'

interface FileSuggestionsProps {
  suggestions: ProjectFileSuggestion[]
}

export function FileSuggestions({ suggestions }: FileSuggestionsProps) {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-semibold text-[var(--text)]">Related files</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Suggested files around this project that are often useful during imports, config edits, and troubleshooting.
      </p>
      <div className="mt-4 space-y-3">
        {suggestions.map((item) => (
          <div key={item.path} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-[var(--text)]">{item.label}</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{item.kind}</div>
            </div>
            <div className="mt-2 font-mono text-xs text-[var(--text)]">{item.path}</div>
            <div className="mt-2 text-sm text-[var(--text-muted)]">{item.reason}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
