'use client'

import { useEffect, useState } from 'react'
import type { Project, ProjectRuntime, ProjectSource, ProxyType } from '@launchpad/shared'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type ProjectPreset = 'compose_existing' | 'ghcr_existing' | 'github_bootstrap' | 'custom'

interface ProjectFormProps {
  title: string
  description: string
  submitLabel: string
  initialValue?: Partial<Project>
  inModal?: boolean
  onSubmit: (payload: {
    name: string
    source: ProjectSource
    runtime: ProjectRuntime
    repoImage: string
    deployCommands: string[]
    envPath?: string
    workingDir?: string
    proxyType: ProxyType
    healthCheck?: Project['healthCheck']
    webhookEnabled: boolean
    notifications: Project['notifications']
  }) => Promise<void>
  onDelete?: () => Promise<void>
}

const PRESETS: Array<{
  id: ProjectPreset
  label: string
  description: string
}> = [
  {
    id: 'compose_existing',
    label: 'Existing Compose App',
    description: 'For apps already on the VPS with a docker-compose or compose.yaml file.',
  },
  {
    id: 'ghcr_existing',
    label: 'Existing GHCR Image',
    description: 'For apps deployed from a registry image like ghcr.io/gadeos/app.',
  },
  {
    id: 'github_bootstrap',
    label: 'New App From GitHub',
    description: 'For apps that still need to be cloned or bootstrapped on the VPS first.',
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Start from scratch and define your own commands.',
  },
]

function getInitialValue(initialValue?: Partial<Project>) {
  return {
    name: initialValue?.name ?? '',
    source: initialValue?.source ?? 'manual',
    runtime: initialValue?.runtime ?? 'compose',
    repoImage: initialValue?.repoImage ?? '',
    deployCommands: initialValue?.deployCommands?.join('\n') ?? '',
    envPath: initialValue?.envPath ?? '',
    workingDir: initialValue?.workingDir ?? '',
    proxyType: initialValue?.proxyType ?? 'none',
    healthPath: initialValue?.healthCheck?.path ?? '',
    healthPort: initialValue?.healthCheck?.port ? String(initialValue.healthCheck.port) : '',
    webhookEnabled: initialValue?.webhookEnabled ?? false,
    onSuccess: initialValue?.notifications?.onSuccess ?? true,
    onFailure: initialValue?.notifications?.onFailure ?? true,
  }
}

function getPresetDefaults(preset: ProjectPreset, current: ReturnType<typeof getInitialValue>) {
  if (preset === 'compose_existing') {
    return {
      ...current,
      runtime: 'compose' as ProjectRuntime,
      workingDir: current.workingDir || '/var/www/app',
      envPath: current.envPath || '/var/www/app/.env',
      deployCommands: 'docker compose pull\ndocker compose up -d',
    }
  }

  if (preset === 'ghcr_existing') {
    return {
      ...current,
      runtime: 'image' as ProjectRuntime,
      workingDir: current.workingDir || '/var/www/app',
      envPath: current.envPath || '/var/www/app/.env',
      deployCommands: `docker pull ${current.repoImage || 'ghcr.io/owner/app'}:latest\ndocker compose up -d`,
    }
  }

  if (preset === 'github_bootstrap') {
    return {
      ...current,
      runtime: 'custom' as ProjectRuntime,
      workingDir: current.workingDir || '/var/www/app',
      envPath: current.envPath || '/var/www/app/.env',
      deployCommands:
        'git pull origin main\n' +
        'docker compose build\n' +
        'docker compose up -d',
    }
  }

  return current
}

function getPresetHint(preset: ProjectPreset) {
  if (preset === 'compose_existing') {
    return 'Best when the app is already on the VPS and you normally run docker compose commands in a project directory.'
  }
  if (preset === 'ghcr_existing') {
    return 'Best when your app is driven by a published container image and the VPS already has the compose or runtime setup around it.'
  }
  if (preset === 'github_bootstrap') {
    return 'Best when deploys start from git on the server instead of only pulling a ready-made image.'
  }
  return 'Use this when your deploy flow does not match the common presets.'
}

export function ProjectForm({
  title,
  description,
  submitLabel,
  initialValue,
  inModal = false,
  onSubmit,
  onDelete,
}: ProjectFormProps) {
  const [values, setValues] = useState(getInitialValue(initialValue))
  const [preset, setPreset] = useState<ProjectPreset>('compose_existing')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setValues(getInitialValue(initialValue))
    setPreset(initialValue?.id ? 'custom' : 'compose_existing')
  }, [initialValue])

  function applyPreset(nextPreset: ProjectPreset) {
    setPreset(nextPreset)
    setValues((current) => getPresetDefaults(nextPreset, current))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)

    try {
      await onSubmit({
        name: values.name,
        source: values.source,
        runtime: values.runtime,
        repoImage: values.repoImage,
        deployCommands: values.deployCommands
          .split('\n')
          .map((command) => command.trim())
          .filter(Boolean),
        envPath: values.envPath || undefined,
        workingDir: values.workingDir || undefined,
        proxyType: values.proxyType,
        healthCheck:
          values.healthPath || values.healthPort
            ? {
                path: values.healthPath || undefined,
                port: values.healthPort ? Number(values.healthPort) : undefined,
              }
            : undefined,
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
    <section className={inModal ? '' : 'border rounded-(--radius) border-(--border) bg-(--surface) p-6'}>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-(--text)">{title}</h2>
        <p className="mt-1 text-sm text-(--text-muted)">{description}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-medium tracking-wider text-(--text-muted)">Project preset</h3>
            <p className="mt-1 text-sm text-(--text-muted)">
              Pick the closest setup type and Optizen will prefill the project with sensible defaults.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {PRESETS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => applyPreset(option.id)}
                className={`border px-4 py-4 text-left transition-colors ${
                  preset === option.id
                    ? 'border-(--accent) bg-(--accent-dim)'
                    : 'border-(--border) bg-(--surface-2) hover:bg-(--surface)'
                }`}
              >
                <div className="text-sm font-medium text-(--text)">{option.label}</div>
                <div className="mt-1 text-xs text-(--text-muted)">{option.description}</div>
              </button>
            ))}
          </div>
          <div className="border rounded-(--radius) border-(--border) bg-(--surface-2) px-4 py-3 text-sm text-(--text-muted)">
            {getPresetHint(preset)}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wider text-(--text-muted)">Source</span>
            <select
              value={values.source}
              onChange={(event) => setValues((current) => ({ ...current, source: event.target.value as ProjectSource }))}
              className="h-10 border rounded-(--radius) border-(--border) bg-(--surface-2) px-3 text-sm text-(--text) outline-none focus:border-(--border-strong)"
            >
              <option value="manual">Manual</option>
              <option value="imported">Imported</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wider text-(--text-muted)">Runtime</span>
            <select
              value={values.runtime}
              onChange={(event) => setValues((current) => ({ ...current, runtime: event.target.value as ProjectRuntime }))}
              className="h-10 border rounded-(--radius) border-(--border) bg-(--surface-2) px-3 text-sm text-(--text) outline-none focus:border-(--border-strong)"
            >
              <option value="compose">Compose app</option>
              <option value="image">Image app</option>
              <option value="proxy">Proxy app</option>
              <option value="custom">Custom app</option>
            </select>
          </label>
        </div>

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
          onChange={(event) =>
            setValues((current) => {
              const repoImage = event.target.value
              if (preset === 'ghcr_existing') {
                return {
                  ...current,
                  repoImage,
                  deployCommands: `docker pull ${repoImage || 'ghcr.io/owner/app'}:latest\ndocker compose up -d`,
                }
              }
              return { ...current, repoImage }
            })
          }
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
          <Input
            label="Health endpoint"
            value={values.healthPath}
            onChange={(event) => setValues((current) => ({ ...current, healthPath: event.target.value }))}
            placeholder="/health"
            hint="Optional. Optizen will curl this path on 127.0.0.1 after deploys and when you run a heartbeat check."
          />
          <Input
            label="Health port"
            value={values.healthPort}
            onChange={(event) => setValues((current) => ({ ...current, healthPort: event.target.value }))}
            placeholder="3000"
            inputMode="numeric"
            hint="Optional fallback when an HTTP path is not available yet."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wider text-(--text-muted)">Proxy</span>
            <select
              value={values.proxyType}
              onChange={(event) =>
                setValues((current) => ({ ...current, proxyType: event.target.value as ProxyType }))
              }
              className="h-10 border rounded-(--radius) border-(--border) bg-(--surface-2) px-3 text-sm text-(--text) outline-none focus:border-(--border-strong)"
            >
              <option value="none">None</option>
              <option value="caddy">Caddy</option>
              <option value="nginx">Nginx</option>
            </select>
          </label>
          <label className="flex items-center gap-3 border rounded-(--radius) border-(--border) bg-(--surface-2) px-3 py-2 text-sm text-(--text)">
            <input
              type="checkbox"
              checked={values.webhookEnabled}
              onChange={(event) => setValues((current) => ({ ...current, webhookEnabled: event.target.checked }))}
              className="h-4 w-4 accent-(--accent)"
            />
            Enable inbound webhooks
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wider text-(--text-muted)">
            Deploy commands
          </span>
          <textarea
            value={values.deployCommands}
            onChange={(event) => setValues((current) => ({ ...current, deployCommands: event.target.value }))}
            className="min-h-36 border rounded-(--radius) border-(--border) bg-(--surface-2) px-3 py-2 font-mono text-sm text-(--text) outline-none focus:border-(--border-strong)"
            placeholder={'docker pull ghcr.io/acme/app:latest\ndocker compose up -d'}
            required
          />
          <p className="text-xs text-(--text-muted)">
            These are the exact commands Optizen will run on the VPS during deploys.
          </p>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 border rounded-(--radius) border-(--border) bg-(--surface-2) px-3 py-2 text-sm text-(--text)">
            <input
              type="checkbox"
              checked={values.onSuccess}
              onChange={(event) => setValues((current) => ({ ...current, onSuccess: event.target.checked }))}
              className="h-4 w-4 accent-(--accent)"
            />
            Notify on success
          </label>
          <label className="flex items-center gap-3 border rounded-(--radius) border-(--border) bg-(--surface-2) px-3 py-2 text-sm text-(--text)">
            <input
              type="checkbox"
              checked={values.onFailure}
              onChange={(event) => setValues((current) => ({ ...current, onFailure: event.target.checked }))}
              className="h-4 w-4 accent-(--accent)"
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
