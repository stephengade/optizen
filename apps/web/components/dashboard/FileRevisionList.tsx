'use client'

import type { FileRevision } from '@launchpad/shared'
import { Button } from '@/components/ui/Button'
import { formatDateTime, formatRelative } from '@/lib/utils'

interface FileRevisionListProps {
  revisions: FileRevision[]
  restoring?: string | null
  onRestore: (revisionId: string) => void
}

export function FileRevisionList({ revisions, restoring, onRestore }: FileRevisionListProps) {
  if (revisions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-muted)]">
        No saved revisions yet. Launchpad will capture a snapshot before each overwrite.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {revisions.map((revision) => (
        <div key={revision.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[var(--text)]">{revision.summary}</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]" title={formatDateTime(revision.createdAt)}>
                {formatRelative(revision.createdAt)}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onRestore(revision.id)} loading={restoring === revision.id}>
              Restore
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
