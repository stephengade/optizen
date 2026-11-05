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
    <section className="border rounded-(--radius) border-(--border) bg-(--surface) p-6">
      <h2 className="text-lg font-semibold text-(--text)">Related files</h2>
      <p className="mt-1 text-sm text-(--text-muted)">
        Suggested files around this project that are often useful during imports, config edits, and troubleshooting.
      </p>
      <div className="mt-4 space-y-3">
        {suggestions.map((item) => (
          <div key={item.path} className=" border rounded-(--radius) border-(--border) bg-(--surface-2) p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-(--text)">{item.label}</div>
              <div className="text-[11.5px] font-medium text-(--text-muted)">{item.kind}</div>
            </div>
            <div className="mt-2 font-mono text-xs text-(--text)">{item.path}</div>
            <div className="mt-2 text-sm text-(--text-muted)">{item.reason}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
