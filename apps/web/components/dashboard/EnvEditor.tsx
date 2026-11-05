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
  const preview = useMemo(() => {
    const before = original.split('\n')
    const after = value.split('\n')
    const rows: Array<{ type: 'added' | 'removed' | 'changed'; text: string }> = []

    const max = Math.max(before.length, after.length)
    for (let index = 0; index < max; index += 1) {
      const previous = before[index]
      const next = after[index]
      if (previous === next) continue
      if (previous === undefined && next !== undefined) rows.push({ type: 'added', text: `+ ${next}` })
      else if (previous !== undefined && next === undefined) rows.push({ type: 'removed', text: `- ${previous}` })
      else rows.push({ type: 'changed', text: `~ ${next ?? previous ?? ''}` })
      if (rows.length >= 10) break
    }

    return rows
  }, [original, value])

  return (
    <section className="border border-(--border) bg-(--surface) p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
                    <h2 className="mt-2 text-lg font-semibold text-(--text)">Env editor</h2>
          <p className="mt-1 text-sm text-(--text-muted)">
            Editing <span className="font-mono text-(--text)">{path}</span> live over SSH. Content is kept in memory only.
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
            className="min-h-112 w-full  border border-(--border) bg-[#0b0b0d] px-4 py-3 font-mono text-sm text-(--text) outline-none focus:border-(--border-strong)"
            spellCheck={false}
          />
        </div>

        <div className="space-y-4">
          <div className=" border border-(--border) bg-(--surface-2) p-4">
            <h3 className="text-sm font-medium text-(--text)">Change summary</h3>
            <div className="mt-3 space-y-2 text-sm text-(--text-muted)">
              <div>Added lines: {diff.added}</div>
              <div>Removed lines: {diff.removed}</div>
              <div>Changed lines: {diff.changed}</div>
              <div>Status: {dirty ? 'Unsaved changes' : 'Synced with server'}</div>
            </div>
          </div>

          <div className=" border border-(--border) bg-(--surface-2) p-4 text-sm text-(--text-muted)">
            Saving validates the env format, creates a remote backup, stores a local revision, and then overwrites
            <span className="font-mono text-(--text)"> {path}</span>.
          </div>

          <div className=" border border-(--border) bg-(--surface-2) p-4">
            <h3 className="text-sm font-medium text-(--text)">Diff preview</h3>
            <div className="mt-3 space-y-2 font-mono text-xs">
              {preview.length > 0 ? (
                preview.map((row, index) => (
                  <div
                    key={`${row.type}-${index}`}
                    className={
                      row.type === 'added'
                        ? 'text-(--accent)'
                        : row.type === 'removed'
                          ? 'text-(--red)'
                          : 'text-(--yellow)'
                    }
                  >
                    {row.text}
                  </div>
                ))
              ) : (
                <div className="text-(--text-muted)">No changes to preview.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
