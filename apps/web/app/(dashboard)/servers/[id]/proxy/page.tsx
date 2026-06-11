'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ProxyEditor } from '@/components/dashboard/ProxyEditor'
import { SitesList } from '@/components/dashboard/SitesList'
import { api, ApiError } from '@/lib/api'

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
}

interface NginxSites {
  type: 'caddy' | 'nginx' | 'none'
  sites: Array<{ name: string; enabled: boolean }>
}

export default function ServerProxyPage() {
  const params = useParams<{ id: string }>()
  const [status, setStatus] = useState<ProxyStatus | null>(null)
  const [config, setConfig] = useState<ProxyConfig | null>(null)
  const [sites, setSites] = useState<Array<{ name: string; enabled: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [togglingSite, setTogglingSite] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const [statusData, configData, sitesData] = await Promise.all([
        api.get<ProxyStatus>(`/proxy/${params.id}/status`),
        api.get<ProxyConfig>(`/proxy/${params.id}/config`),
        api.get<NginxSites>(`/proxy/${params.id}/sites`),
      ])
      setStatus(statusData)
      setConfig(configData)
      setSites(sitesData.sites)
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

  async function handleSave() {
    if (!config) return
    setSaving(true)
    try {
      await api.put(`/proxy/${params.id}/config`, { content: config.content })
      toast.success('Proxy config saved and reloaded')
      void loadData()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to save proxy config'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleReload() {
    setReloading(true)
    try {
      await api.post(`/proxy/${params.id}/reload`)
      toast.success('Proxy reloaded')
      void loadData()
    } catch (error) {
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

          <ProxyEditor
            proxyType={config?.type ?? 'none'}
            configPath={config?.path ?? ''}
            configValue={config?.content ?? ''}
            saving={saving}
            reloading={reloading}
            onChange={(value) => setConfig((current) => (current ? { ...current, content: value } : current))}
            onSave={() => void handleSave()}
            onReload={() => void handleReload()}
          />

          {status?.type === 'nginx' ? (
            <SitesList sites={sites} togglingSite={togglingSite} onToggle={(site) => void handleToggle(site)} />
          ) : null}
        </>
      )}
    </div>
  )
}
