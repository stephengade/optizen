'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { FileRevision, ProjectFileSuggestion } from '@launchpad/shared'
import { toast } from 'sonner'
import { EnvEditor } from '@/components/dashboard/EnvEditor'
import { FileRevisionList } from '@/components/dashboard/FileRevisionList'
import { FileSuggestions } from '@/components/dashboard/FileSuggestions'
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal'
import { LoadingState } from '@/components/ui/LoadingState'
import { ReauthModal } from '@/components/ui/ReauthModal'
import { api, ApiError, isReauthRequiredError } from '@/lib/api'

interface EnvResponse {
  path: string
  content: string
  revisions: FileRevision[]
}

export default function ProjectEnvPage() {
  const params = useParams<{ id: string; pid: string }>()
  const [path, setPath] = useState('')
  const [original, setOriginal] = useState('')
  const [value, setValue] = useState('')
  const [revisions, setRevisions] = useState<FileRevision[]>([])
  const [suggestions, setSuggestions] = useState<ProjectFileSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)

  async function loadEnv() {
    setLoading(true)
    try {
      const data = await api.get<EnvResponse>(`/env/${params.pid}`)
      setPath(data.path)
      setOriginal(data.content)
      setValue(data.content)
      setRevisions(data.revisions)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load env file'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEnv()
  }, [params.pid])

  useEffect(() => {
    async function loadSuggestions() {
      try {
        const data = await api.get<ProjectFileSuggestion[]>(`/files/projects/${params.pid}/suggestions`)
        setSuggestions(data)
      } catch {
        setSuggestions([])
      }
    }

    void loadSuggestions()
  }, [params.pid])

  async function handleSave() {
    setSaving(true)
    try {
      const response = await api.put<{ backupPath?: string }>(`/env/${params.pid}`, { content: value })
      setOriginal(value)
      await loadEnv()
      toast.success(response.backupPath ? `Env file updated with backup at ${response.backupPath}` : 'Env file updated')
    } catch (error) {
      if (isReauthRequiredError(error)) {
        setReauthOpen(true)
        toast.error('Verify your session to save this env file.')
        return
      }
      const message = error instanceof ApiError ? error.message : 'Failed to save env file'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRestore(revisionId: string) {
    setRestoringId(revisionId)
    try {
      const response = await api.post<{ backupPath?: string }>(`/env/${params.pid}/restore`, { revisionId })
      await loadEnv()
      toast.success(response.backupPath ? `Env restored. Backup created at ${response.backupPath}` : 'Env restored')
    } catch (error) {
      if (isReauthRequiredError(error)) {
        setReauthOpen(true)
        toast.error('Verify your session to restore this env revision.')
        return
      }
      const message = error instanceof ApiError ? error.message : 'Failed to restore env revision'
      toast.error(message)
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-8">
      <section>
        <Link
          href={`/servers/${params.id}/projects/${params.pid}`}
          className="text-[12.5px] font-medium text-(--text-muted)"
        >
          Back to project
        </Link>
        <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-(--text)">Environment file</h1>
        <p className="mt-2 text-sm text-(--text-muted)">
          Fetch, review, and update the project&apos;s remote `.env` file without storing its contents in Optizen&apos;s database.
        </p>
      </section>

      {loading ? (
        <LoadingState label="Loading env file" detail="Fetching the remote environment file and recent revision history." />
      ) : path ? (
        <>
          <EnvEditor
            path={path}
            original={original}
            value={value}
            loading={loading}
            saving={saving}
            onChange={setValue}
            onRefresh={() => void loadEnv()}
            onSave={() => setConfirmSaveOpen(true)}
          />

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h2 className="mb-3 text-lg font-semibold text-(--text)">Version history</h2>
              <FileRevisionList revisions={revisions} restoring={restoringId} onRestore={(revisionId) => void handleRestore(revisionId)} />
            </div>
            <FileSuggestions suggestions={suggestions} />
          </section>
        </>
      ) : (
        <div className="border rounded-(--radius) border-(--border) bg-(--surface) p-6 text-sm text-(--text-muted)">
          No env path configured for this project yet.
        </div>
      )}

      <ConfirmActionModal
        open={confirmSaveOpen}
        title="Save env file"
        description="Optizen will validate the env format, store the current version in local history, create a remote backup, and then overwrite the live file."
        confirmLabel="Save env file"
        tone="primary"
        details={[
          `Target: ${path}`,
          `Changed lines: ${original === value ? 0 : 1}+`,
          'Content stays in memory and the revision history only stores pre-save snapshots locally.',
        ]}
        loading={saving}
        onClose={() => setConfirmSaveOpen(false)}
        onConfirm={async () => {
          await handleSave()
          setConfirmSaveOpen(false)
        }}
      />

      <ReauthModal open={reauthOpen} onClose={() => setReauthOpen(false)} />
    </div>
  )
}
