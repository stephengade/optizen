'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { BackupInfo, BackupKind, BackupOverview, BackupSettings } from '@launchpad/shared'
import { ArrowLeft, Download, RotateCcw, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { ReauthModal } from '@/components/ui/ReauthModal'
import { api, ApiError, isReauthRequiredError } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { formatBytes } from '@/lib/format'
import { formatDateTime, formatRelative } from '@/lib/utils'

const KIND_LABEL: Record<BackupKind, string> = {
  manual: 'Manual',
  auto: 'Daily',
  'pre-restore': 'Before restore',
  uploaded: 'Uploaded',
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border rounded-(--radius) border-(--border) bg-(--surface)">
      <div className="px-5 py-4 border-b border-(--border)">
        <h2 className="text-sm font-semibold text-(--text)">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-(--text-muted)">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

async function downloadBackup(name: string) {
  const res = await fetch(`/api/backups/${encodeURIComponent(name)}/download`, { credentials: 'include' })
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

export default function BackupsPage() {
  const { refresh } = useAuth()
  const [overview, setOverview] = useState<BackupOverview | null>(null)
  const [settings, setSettings] = useState<BackupSettings>({ autoEnabled: true, retainDaily: 14 })
  const [creating, setCreating] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [busyName, setBusyName] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null)
  const [restorePassword, setRestorePassword] = useState('')
  const [restoreError, setRestoreError] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)
  const pendingAction = useRef<(() => Promise<void>) | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api.get<BackupOverview>('/backups')
      setOverview(data)
      setSettings(data.settings)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load backups')
    }
  }, [])

  useEffect(() => {
    api.get<BackupOverview>('/backups')
      .then((data) => {
        setOverview(data)
        setSettings(data.settings)
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load backups'))
  }, [])

  /** Run an action; if the server asks for a fresh password check, retry it after the check. */
  async function guarded(name: string, action: () => Promise<void>) {
    setBusyName(name)
    try {
      await action()
    } catch (err) {
      if (isReauthRequiredError(err)) {
        pendingAction.current = action
        setReauthOpen(true)
        return
      }
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setBusyName(null)
    }
  }

  async function handleCreate() {
    setCreating(true)
    try {
      await api.post<BackupInfo>('/backups')
      toast.success('Backup created')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Backup failed')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      const saved = await api.put<BackupSettings>('/backups/settings', settings)
      setSettings(saved)
      toast.success('Backup settings saved')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const content = await file.text()
      await api.post<BackupInfo>('/backups/upload', { content, fileName: file.name })
      toast.success('Backup added. Restore it from the list when you are ready.')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function openRestore(backup: BackupInfo) {
    setRestoreTarget(backup)
    setRestorePassword('')
    setRestoreError('')
  }

  async function handleRestore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restoreTarget) return
    setRestoring(true)
    setRestoreError('')
    try {
      await api.post(`/backups/${encodeURIComponent(restoreTarget.name)}/restore`, { password: restorePassword })
      toast.success('Backup restored. Sign in with the master password that was in use when it was taken.')
      setRestoreTarget(null)
      await refresh()
    } catch (err) {
      setRestoreError(err instanceof ApiError ? err.message : 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  if (!overview) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <LoadingState label="Loading backups" detail="Reading the backup folder." compact />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) transition-colors mb-6">
        <ArrowLeft size={12} />
        Settings
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-(--text)">Backups</h1>
          <p className="mt-1 text-sm text-(--text-muted)">
            Copies of all Optizen data: servers, projects, settings and history. Secrets stay encrypted with your master password.
          </p>
        </div>
        <Button onClick={() => void handleCreate()} loading={creating}>Back up now</Button>
      </div>

      <div className="space-y-4">
        <Section title="Daily backups" description="Optizen takes one backup a day while it is running and deletes the oldest beyond the limit.">
          <div className="space-y-5">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-sm text-(--text)">Back up automatically every day</div>
                <div className="text-xs text-(--text-muted) mt-0.5">Manual and uploaded backups are never deleted automatically.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoEnabled}
                onChange={(e) => setSettings((c) => ({ ...c, autoEnabled: e.target.checked }))}
                className="h-4 w-4 accent-(--accent)"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Daily backups to keep"
                type="number"
                min={1}
                max={365}
                inputMode="numeric"
                value={String(settings.retainDaily)}
                onChange={(e) => setSettings((c) => ({ ...c, retainDaily: Number(e.target.value || 0) }))}
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-(--text-muted) tracking-wider">Folder on the server</span>
                <code className="border rounded-(--radius) border-(--border) bg-(--surface-2) px-3 py-2 font-mono text-xs text-(--text-muted) break-all" data-sensitive="true">
                  {overview.directory}
                </code>
              </div>
            </div>
            <p className="text-xs text-(--text-muted)">
              These copies sit on the same machine as Optizen. Download one now and then, or sync the folder elsewhere, so a lost server does not take your backups with it.
            </p>
            <Button variant="ghost" size="sm" onClick={() => void handleSaveSettings()} loading={savingSettings}>Save backup settings</Button>
          </div>
        </Section>

        <Section title="Saved backups" description="Download a copy, restore one, or add a backup file from your computer.">
          <div className="space-y-4">
            {overview.backups.length === 0 ? (
              <p className="text-sm text-(--text-muted)">No backups yet. Click &ldquo;Back up now&rdquo; to make the first one.</p>
            ) : (
              <div className="border rounded-(--radius) border-(--border) divide-y divide-(--border)">
                {overview.backups.map((backup) => (
                  <div key={backup.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-(--text)" title={formatDateTime(backup.createdAt)}>
                          {formatDateTime(backup.createdAt)}
                        </span>
                        <span className="border rounded-(--radius) border-(--border) px-1.5 py-0.5 text-[10px] tracking-wider text-(--text-muted)">
                          {KIND_LABEL[backup.kind]}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-(--text-muted)">
                        {formatRelative(backup.createdAt)} · {formatBytes(backup.sizeBytes)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Download backup from ${formatDateTime(backup.createdAt)}`}
                        loading={busyName === `download:${backup.name}`}
                        onClick={() => void guarded(`download:${backup.name}`, () => downloadBackup(backup.name))}
                      >
                        <Download size={13} />
                        Download
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openRestore(backup)}>
                        <RotateCcw size={13} />
                        Restore
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        aria-label={`Delete backup from ${formatDateTime(backup.createdAt)}`}
                        loading={busyName === `delete:${backup.name}`}
                        onClick={() => {
                          if (!window.confirm('Delete this backup? This cannot be undone.')) return
                          void guarded(`delete:${backup.name}`, async () => {
                            await api.delete(`/backups/${encodeURIComponent(backup.name)}`)
                            toast.success('Backup deleted')
                            await load()
                          })
                        }}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleUpload(file)
                }}
              />
              <Button variant="ghost" size="sm" loading={uploading} onClick={() => fileInput.current?.click()}>
                <Upload size={13} />
                Add backup file
              </Button>
            </div>
          </div>
        </Section>
      </div>

      <Modal
        open={restoreTarget !== null}
        title="Restore this backup?"
        description={restoreTarget ? `${formatDateTime(restoreTarget.createdAt)} · ${KIND_LABEL[restoreTarget.kind]}` : undefined}
        onClose={() => setRestoreTarget(null)}
      >
        <form onSubmit={handleRestore} className="space-y-4">
          <div className="space-y-2 text-sm text-(--text-muted)">
            <p>All current servers, projects, settings and history are replaced with the backup. A copy of the current data is saved first, so you can undo this.</p>
            <p>Everyone is signed out. Sign back in with the master password that was in use when this backup was taken.</p>
          </div>
          <Input
            label="Current master password"
            type="password"
            autoComplete="current-password"
            value={restorePassword}
            onChange={(e) => setRestorePassword(e.target.value)}
            error={restoreError || undefined}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={restoring} disabled={!restorePassword}>Restore backup</Button>
            <Button type="button" variant="ghost" onClick={() => setRestoreTarget(null)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <ReauthModal
        open={reauthOpen}
        onClose={() => {
          setReauthOpen(false)
          pendingAction.current = null
        }}
        onSuccess={() => {
          const action = pendingAction.current
          pendingAction.current = null
          if (action) void guarded('retry', action)
        }}
      />
    </div>
  )
}
