'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { EnvEditor } from '@/components/dashboard/EnvEditor'
import { api, ApiError } from '@/lib/api'

interface EnvResponse {
  path: string
  content: string
}

export default function ProjectEnvPage() {
  const params = useParams<{ id: string; pid: string }>()
  const [path, setPath] = useState('')
  const [original, setOriginal] = useState('')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function loadEnv() {
    setLoading(true)
    try {
      const data = await api.get<EnvResponse>(`/env/${params.pid}`)
      setPath(data.path)
      setOriginal(data.content)
      setValue(data.content)
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

  async function handleSave() {
    const confirmed = window.confirm(`This will overwrite ${path}. Continue?`)
    if (!confirmed) return

    setSaving(true)
    try {
      await api.put(`/env/${params.pid}`, { content: value })
      setOriginal(value)
      toast.success('Env file updated')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to save env file'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-8">
      <section>
        <Link
          href={`/servers/${params.id}/projects/${params.pid}`}
          className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]"
        >
          Back to project
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--text)]">Environment file</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Fetch, review, and update the project&apos;s remote `.env` file without storing its contents in Launchpad&apos;s database.
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          Loading env file...
        </div>
      ) : path ? (
        <EnvEditor
          path={path}
          original={original}
          value={value}
          loading={loading}
          saving={saving}
          onChange={setValue}
          onRefresh={() => void loadEnv()}
          onSave={() => void handleSave()}
        />
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          No env path configured for this project yet.
        </div>
      )}
    </div>
  )
}
