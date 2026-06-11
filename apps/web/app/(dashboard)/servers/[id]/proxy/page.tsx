'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { FileRevision, Project } from '@launchpad/shared'
import { toast } from 'sonner'
import { FileRevisionList } from '@/components/dashboard/FileRevisionList'
import { ProxyEditor } from '@/components/dashboard/ProxyEditor'
import { SitesList } from '@/components/dashboard/SitesList'
import { Button } from '@/components/ui/Button'
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal'
import { ReauthModal } from '@/components/ui/ReauthModal'
import { api, ApiError, isReauthRequiredError } from '@/lib/api'

interface ProxyStatus {
  type: 'caddy' | 'nginx' | 'none'
  running: boolean
  version: string
  configPath: string
}

interface ProxyConfig {
  type: 'caddy' | 'nginx' | 'none'
  path: string
  content: string
  editable: boolean
  error: string
  revisions?: FileRevision[]
}

interface NginxSites {
  type: 'caddy' | 'nginx' | 'none'
  sites: Array<{ name: string; enabled: boolean }>
}

export default function ServerProxyPage() {
  const params = useParams<{ id: string }>()
  const [status, setStatus] = useState<ProxyStatus | null>(null)
  const [config, setConfig] = useState<ProxyConfig | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [sites, setSites] = useState<Array<{ name: string; enabled: boolean }>>([])
  const [revisions, setRevisions] = useState<FileRevision[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [togglingSite, setTogglingSite] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)

  async function loadData(pathOverride?: string) {
    setLoading(true)
    try {
      const statusPromise = api.get<ProxyStatus>(`/proxy/${params.id}/status`)
      const configPromise = api.get<ProxyConfig>(
        `/proxy/${params.id}/config${pathOverride ? `?path=${encodeURIComponent(pathOverride)}` : ''}`
      )
      const sitesPromise = api.get<NginxSites>(`/proxy/${params.id}/sites`)
      const projectsPromise = api.get<Project[]>(`/servers/${params.id}/projects`)

      const [statusResult, configResult, sitesResult, projectsResult] = await Promise.allSettled([
        statusPromise,
        configPromise,
        sitesPromise,
        projectsPromise,
      ])

      if (statusResult.status === 'fulfilled') {
        setStatus(statusResult.value)
      } else {
        const message = statusResult.reason instanceof ApiError ? statusResult.reason.message : 'Failed to load proxy status'
        toast.error(message)
      }

      if (configResult.status === 'fulfilled') {
        setConfig(configResult.value)
        setRevisions(configResult.value.revisions ?? [])
      } else {
        const message = configResult.reason instanceof ApiError ? configResult.reason.message : 'Failed to load proxy config'
        toast.error(message)
      }

      if (sitesResult.status === 'fulfilled') {
        setSites(sitesResult.value.sites)
      } else {
        setSites([])
      }

      if (projectsResult.status === 'fulfilled') {
        setProjects(projectsResult.value)
      } else {
        setProjects([])
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load proxy data'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [params.id])

  const suggestedPaths = useMemo(() => {
    const values = new Set<string>()

    for (const project of projects) {
      const haystack = `${project.name} ${project.repoImage} ${project.workingDir ?? ''}`.toLowerCase()
      const workingDir = project.workingDir?.replace(/\/$/, '')
      if (!workingDir) continue

      if (project.proxyType === 'caddy' || haystack.includes('caddy')) {
        values.add(`${workingDir}/Caddyfile`)
        values.add(`${workingDir}/caddy/Caddyfile`)
        values.add(`${workingDir}/config/Caddyfile`)
      }

      if (project.proxyType === 'nginx' || haystack.includes('nginx')) {
        values.add(`${workingDir}/nginx.conf`)
        values.add(`${workingDir}/conf/nginx.conf`)
        values.add(`${workingDir}/config/nginx.conf`)
      }
    }

    return Array.from(values)
  }, [projects])

  async function handleSave() {
    if (!config) return
    setSaving(true)
    try {
      const result = await api.put<{ success: boolean; path: string; message?: string; reloaded?: boolean; backupPath?: string }>(
        `/proxy/${params.id}/config`,
        { content: config.content, path: config.path }
      )
      toast.success(
        result.message ??
          (result.reloaded ? `Proxy config saved and reloaded${result.backupPath ? ` with backup at ${result.backupPath}` : ''}` : 'Config file saved')
      )
      void loadData(config.path)
    } catch (error) {
      if (isReauthRequiredError(error)) {
        setReauthOpen(true)
        toast.error('Verify your session to save proxy config changes.')
        return
      }
      const message = error instanceof ApiError ? error.message : 'Failed to save proxy config'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRestore(revisionId: string) {
    setRestoringId(revisionId)
    try {
      const result = await api.post<{ backupPath?: string; path: string }>(`/proxy/${params.id}/restore`, { revisionId })
      toast.success(result.backupPath ? `Proxy config restored. Backup created at ${result.backupPath}` : 'Proxy config restored')
      void loadData(result.path)
    } catch (error) {
      if (isReauthRequiredError(error)) {
        setReauthOpen(true)
        toast.error('Verify your session to restore this proxy revision.')
        return
      }
      const message = error instanceof ApiError ? error.message : 'Failed to restore proxy revision'
      toast.error(message)
    } finally {
      setRestoringId(null)
    }
  }

  async function handleReload() {
    setReloading(true)
    try {
      await api.post(`/proxy/${params.id}/reload`)
      toast.success('Proxy reloaded')
      void loadData(config?.path)
    } catch (error) {
      if (isReauthRequiredError(error)) {
        setReauthOpen(true)
        toast.error('Verify your session to reload the proxy.')
        return
      }
      const message = error instanceof ApiError ? error.message : 'Failed to reload proxy'
      toast.error(message)
    } finally {
      setReloading(false)
    }
  }

  async function handleToggle(site: { name: string; enabled: boolean }) {
    setTogglingSite(site.name)
    try {
      await api.post(`/proxy/${params.id}/sites/${site.name}/toggle`, { enabled: !site.enabled })
      toast.success(`${site.name} ${site.enabled ? 'disabled' : 'enabled'}`)
      void loadData()
    } catch (error) {
      if (isReauthRequiredError(error)) {
        setReauthOpen(true)
        toast.error('Verify your session to change proxy site state.')
        return
      }
      const message = error instanceof ApiError ? error.message : 'Failed to toggle site'
      toast.error(message)
    } finally {
      setTogglingSite(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-8">
      <section>
        <Link href={`/servers/${params.id}`} className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Back to server
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--text)]">Reverse proxy</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Detect, validate, edit, and reload the server&apos;s Caddy or Nginx configuration.
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          Loading proxy state...
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">Proxy status</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              This page manages both host-level proxies and Docker-managed proxy config files. If Launchpad cannot detect
              a host Caddy or Nginx service, you can still load and edit a known config file path below.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Type</div>
                <div className="mt-2 text-sm text-[var(--text)]">{status?.type ?? 'unknown'}</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Running</div>
                <div className="mt-2 text-sm text-[var(--text)]">{status?.running ? 'Yes' : 'No'}</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 md:col-span-2">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Version</div>
                <div className="mt-2 text-sm text-[var(--text)]">{status?.version || 'n/a'}</div>
              </div>
            </div>
          </section>

          {suggestedPaths.length > 0 ? (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-lg font-semibold text-[var(--text)]">Suggested proxy files</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Launchpad found imported proxy-like projects on this server. Pick a likely config file to load without
                hunting through SSH first.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {suggestedPaths.map((path) => (
                  <Button key={path} variant="ghost" size="sm" onClick={() => void loadData(path)}>
                    {path}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}

          <ProxyEditor
            proxyType={config?.type ?? 'none'}
            configPath={config?.path ?? ''}
            editable={config?.editable ?? false}
            error={config?.error ?? ''}
            configValue={config?.content ?? ''}
            saving={saving}
            reloading={reloading}
            onPathChange={(value) => setConfig((current) => (current ? { ...current, path: value } : current))}
            onLoadPath={() => void loadData(config?.path)}
            onChange={(value) => setConfig((current) => (current ? { ...current, content: value } : current))}
            onSave={() => setConfirmSaveOpen(true)}
            onReload={() => void handleReload()}
          />

          {config?.path ? (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="mb-3 text-lg font-semibold text-[var(--text)]">Config history</h2>
              <FileRevisionList revisions={revisions} restoring={restoringId} onRestore={(revisionId) => void handleRestore(revisionId)} />
            </section>
          ) : null}

          {status?.type === 'nginx' ? (
            <SitesList sites={sites} togglingSite={togglingSite} onToggle={(site) => void handleToggle(site)} />
          ) : null}
        </>
      )}

      <ConfirmActionModal
        open={confirmSaveOpen}
        title="Save proxy config"
        description="Launchpad will validate the candidate config first when a host proxy is detected, then snapshot the current version, create a remote backup, overwrite the file, and reload the proxy."
        confirmLabel="Save config"
        tone="primary"
        details={[
          `Target: ${config?.path || 'No path selected'}`,
          `Proxy type: ${config?.type || 'unknown'}`,
          status?.type === 'none'
            ? 'Validation and reload are skipped for custom non-host-managed proxy files.'
            : 'Validation happens before the live file is replaced.',
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
