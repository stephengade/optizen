'use client'

import { useEffect, useState } from 'react'
import type { Project, ProxyType } from '@launchpad/shared'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface ProjectFormProps {
  title: string
  description: string
  submitLabel: string
  initialValue?: Partial<Project>
  onSubmit: (payload: {
    name: string
    repoImage: string
    deployCommands: string[]
    envPath?: string
    workingDir?: string
    proxyType: ProxyType
    webhookEnabled: boolean
    notifications: Project['notifications']
  }) => Promise<void>
  onDelete?: () => Promise<void>
}

function getInitialValue(initialValue?: Partial<Project>) {
  return {
    name: initialValue?.name ?? '',
    repoImage: initialValue?.repoImage ?? '',
    deployCommands: initialValue?.deployCommands?.join('\n') ?? '',
    envPath: initialValue?.envPath ?? '',
    workingDir: initialValue?.workingDir ?? '',
    proxyType: initialValue?.proxyType ?? 'none',
    webhookEnabled: initialValue?.webhookEnabled ?? false,
    onSuccess: initialValue?.notifications?.onSuccess ?? true,
    onFailure: initialValue?.notifications?.onFailure ?? true,
  }
}

export function ProjectForm({
  title,
  description,
  submitLabel,
  initialValue,
  onSubmit,
  onDelete,
}: ProjectFormProps) {
  const [values, setValues] = useState(getInitialValue(initialValue))
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setValues(getInitialValue(initialValue))
  }, [initialValue])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)

    try {
      await onSubmit({
        name: values.name,
        repoImage: values.repoImage,
        deployCommands: values.deployCommands
          .split('\n')
          .map((command) => command.trim())
          .filter(Boolean),
        envPath: values.envPath || undefined,
        workingDir: values.workingDir || undefined,
        proxyType: values.proxyType,
        webhookEnabled: values.webhookEnabled,
        notifications: {
          onSuccess: values.onSuccess,
          onFailure: values.onFailure,
          webhooks: [],
        },
      })
      if (!initialValue?.id) {
        setValues(getInitialValue())
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Project name"
          value={values.name}
          onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
          placeholder="marketing-site"
          required
        />
        <Input
          label="Container image"
          value={values.repoImage}
          onChange={(event) => setValues((current) => ({ ...current, repoImage: event.target.value }))}
          placeholder="ghcr.io/acme/marketing-site"
          required
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Working directory"
            value={values.workingDir}
            onChange={(event) => setValues((current) => ({ ...current, workingDir: event.target.value }))}
            placeholder="/var/www/app"
          />
          <Input
            label="Env path"
            value={values.envPath}
            onChange={(event) => setValues((current) => ({ ...current, envPath: event.target.value }))}
            placeholder="/var/www/app/.env"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Proxy</span>
            <select
              value={values.proxyType}
              onChange={(event) =>
                setValues((current) => ({ ...current, proxyType: event.target.value as ProxyType }))
              }
              className="h-10 rounded border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--green)]"
            >
              <option value="none">None</option>
              <option value="caddy">Caddy</option>
              <option value="nginx">Nginx</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={values.webhookEnabled}
              onChange={(event) => setValues((current) => ({ ...current, webhookEnabled: event.target.checked }))}
              className="h-4 w-4 accent-[var(--green)]"
            />
            Enable inbound webhooks
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Deploy commands
          </span>
          <textarea
            value={values.deployCommands}
            onChange={(event) => setValues((current) => ({ ...current, deployCommands: event.target.value }))}
            className="min-h-36 rounded border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-sm text-[var(--text)] outline-none focus:border-[var(--green)]"
            placeholder={'docker pull ghcr.io/acme/app:latest\ndocker compose up -d'}
            required
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={values.onSuccess}
              onChange={(event) => setValues((current) => ({ ...current, onSuccess: event.target.checked }))}
              className="h-4 w-4 accent-[var(--green)]"
            />
            Notify on success
          </label>
          <label className="flex items-center gap-3 rounded border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={values.onFailure}
              onChange={(event) => setValues((current) => ({ ...current, onFailure: event.target.checked }))}
              className="h-4 w-4 accent-[var(--green)]"
            />
            Notify on failure
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={loading}>
            {submitLabel}
          </Button>
          {onDelete ? (
            <Button type="button" variant="danger" loading={deleting} onClick={handleDelete}>
              Delete project
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
