'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DatabaseBackupFile, DatabaseBackupList, DatabaseConnection } from '@launchpad/shared'
import { DatabaseBackup, Download, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal'
import { ReauthModal } from '@/components/ui/ReauthModal'
import { api, ApiError, isReauthRequiredError } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import { formatDateTime, formatRelative } from '@/lib/utils'

const RESTORE_HINT: Record<DatabaseConnection['engine'], (name: string, connection: DatabaseConnection) => string> = {
  postgres: (name, connection) =>
    connection.access === 'docker'
      ? `gunzip -c ${name} | docker exec -i ${connection.container} psql -U ${connection.user || 'postgres'} -d ${connection.database || connection.user || 'postgres'}`
      : `gunzip -c ${name} | psql -U ${connection.user || 'postgres'} -d ${connection.database || connection.user || 'postgres'}`,
  mysql: (name, connection) =>
    connection.access === 'docker'
      ? `gunzip -c ${name} | docker exec -i ${connection.container} mysql -u ${connection.user || 'root'} -p`
      : `gunzip -c ${name} | mysql -u ${connection.user || 'root'} -p`,
  sqlite: (name, connection) => `gunzip -c ${name} | sqlite3 ${connection.database || 'restored.db'}`,
}

async function download(databaseId: string, name: string) {
  const res = await fetch(`/api/databases/${databaseId}/backups/${encodeURIComponent(name)}/download`, { credentials: 'include' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string }
    throw new ApiError(res.status, body.code, body.message ?? 'Download failed')
  }
  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function BackupsPanel({ connection }: { connection: DatabaseConnection }) {
  const [list, setList] = useState<DatabaseBackupList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DatabaseBackupFile | null>(null)
  const [reauthOpen, setReauthOpen] = useState(false)
  const pending = useRef<(() => Promise<void>) | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setList(await api.get<DatabaseBackupList>(`/databases/${connection.id}/backups`))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to list backups')
    } finally {
      setLoading(false)
    }
  }, [connection.id])

  useEffect(() => {
    void load()
  }, [load])

  /** Runs an action; if the session needs re-checking first, asks for it and retries after. */
  async function guarded(key: string, action: () => Promise<void>) {
    setBusy(key)
    try {
      await action()
    } catch (err) {
      if (isReauthRequiredError(err)) {
        pending.current = action
        setReauthOpen(true)
        return
      }
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  async function createBackup() {
    setCreating(true)
    try {
      const backup = await api.post<DatabaseBackupFile>(`/databases/${connection.id}/backups`)
      toast.success(`Backed up ${connection.name} (${formatBytes(backup.sizeBytes)} compressed)`)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Backup failed')
    } finally {
      setCreating(false)
    }
  }

  const latest = list?.backups[0]

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-[15px] font-semibold text-(--text)">Backups</h2>
          <p className="mt-1 text-[13px] text-(--text-muted)">
            A full dump made with {connection.engine === 'postgres' ? 'pg_dump' : connection.engine === 'mysql' ? 'mysqldump' : 'sqlite3 .dump'},
            compressed and stored on the server
            {list?.directory ? (
              <>
                {' '}in <span className="font-mono text-[12px] text-(--text)">{list.directory}</span>
              </>
            ) : null}
            . The newest 20 are kept. The database stays online while it runs.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()} aria-label="Refresh backups">
            <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} />
          </Button>
          <Button size="sm" onClick={() => void createBackup()} loading={creating}>
            <DatabaseBackup size={13} />
            Back up now
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-(--radius) border border-[rgba(242,109,109,0.25)] bg-(--red-dim) px-4 py-3 text-[13px] whitespace-pre-wrap text-(--text)">{error}</div>
      )}

      <div className="overflow-hidden rounded-(--radius) border border-(--border) bg-(--surface)">
        {list === null && !error ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-6 animate-pulse rounded bg-white/[0.04]" />
            ))}
          </div>
        ) : !list || list.backups.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-(--text-muted)">
            No backups yet. Click <span className="text-(--text)">Back up now</span> to make the first one.
          </div>
        ) : (
          <ul className="divide-y divide-(--border)">
            {list.backups.map((backup) => (
              <li key={backup.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[12.5px] text-(--text)">{backup.name}</div>
                  <div className="mt-0.5 text-[12px] text-(--text-muted)" title={formatDateTime(backup.createdAt)}>
                    {formatRelative(backup.createdAt)} · {formatBytes(backup.sizeBytes)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busy === `download:${backup.name}`}
                  onClick={() => void guarded(`download:${backup.name}`, () => download(connection.id, backup.name))}
                >
                  <Download size={13} />
                  Download
                </Button>
                <Button variant="ghost" size="sm" aria-label={`Delete ${backup.name}`} onClick={() => setDeleteTarget(backup)}>
                  <Trash2 size={13} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {latest && (
        <div className="rounded-(--radius) border border-(--border) bg-(--bg-subtle) px-4 py-3">
          <div className="text-[12.5px] font-medium text-(--text-muted)">To restore, run this on the server from the backups folder:</div>
          <pre className="mt-2 overflow-x-auto font-mono text-[12px] text-(--text)">{RESTORE_HINT[connection.engine](latest.name, connection)}</pre>
        </div>
      )}

      <ConfirmActionModal
        open={deleteTarget !== null}
        title="Delete this backup?"
        description="The dump file is removed from the server. This cannot be undone."
        confirmLabel="Delete backup"
        details={deleteTarget ? [deleteTarget.name] : []}
        loading={busy === 'delete'}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const target = deleteTarget
          if (!target) return
          await guarded('delete', async () => {
            await api.delete(`/databases/${connection.id}/backups/${encodeURIComponent(target.name)}`)
            toast.success('Backup deleted')
            setDeleteTarget(null)
            await load()
          })
        }}
      />

      <ReauthModal
        open={reauthOpen}
        onClose={() => {
          setReauthOpen(false)
          pending.current = null
        }}
      />
    </div>
  )
}
