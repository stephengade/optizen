'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'

interface EnvEditorProps {
  path: string
  original: string
  value: string
  loading?: boolean
  saving?: boolean
  onChange: (value: string) => void
  onRefresh: () => void
  onSave: () => void
}

function summarizeDiff(original: string, current: string) {
  const before = original.split('\n')
  const after = current.split('\n')
  const max = Math.max(before.length, after.length)

  let added = 0
  let removed = 0
  let changed = 0

  for (let index = 0; index < max; index += 1) {
    const previous = before[index]
    const next = after[index]

    if (previous === undefined && next !== undefined) {
      added += 1
      continue
    }

    if (previous !== undefined && next === undefined) {
      removed += 1
      continue
    }

    if (previous !== next) {
      changed += 1
    }
  }

  return { added, removed, changed }
}

export function EnvEditor({
  path,
  original,
  value,
  loading,
  saving,
  onChange,
  onRefresh,
  onSave,
}: EnvEditorProps) {
  const dirty = value !== original
  const diff = useMemo(() => summarizeDiff(original, value), [original, value])

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--green)]">Phase 6</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Env editor</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Editing <span className="font-mono text-[var(--text)]">{path}</span> live over SSH. Content is kept in memory only.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading || saving}>
            Refresh
          </Button>
          <Button size="sm" onClick={onSave} disabled={!dirty || loading || saving} loading={saving}>
            Save env file
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-[28rem] w-full rounded-xl border border-[var(--border)] bg-[#0b0b0d] px-4 py-3 font-mono text-sm text-[var(--text)] outline-none focus:border-[var(--green)]"
            spellCheck={false}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <h3 className="text-sm font-medium text-[var(--text)]">Change summary</h3>
            <div className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <div>Added lines: {diff.added}</div>
              <div>Removed lines: {diff.removed}</div>
              <div>Changed lines: {diff.changed}</div>
              <div>Status: {dirty ? 'Unsaved changes' : 'Synced with server'}</div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-muted)]">
            Saving overwrites the remote file at <span className="font-mono text-[var(--text)]">{path}</span>.
          </div>
        </div>
      </div>
    </section>
  )
}
