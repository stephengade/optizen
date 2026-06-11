'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Project, Server } from '@launchpad/shared'
import { toast } from 'sonner'
import { ProjectClassificationBadge } from '@/components/dashboard/ProjectClassificationBadge'
import { Button } from '@/components/ui/Button'
import { SensitiveText } from '@/components/ui/SensitiveText'
import { api, ApiError } from '@/lib/api'

type ServerSummary = Server & { projectCount?: number }

interface DiscoveredApp {
  containerId: string
  containerName: string
  image: string
  imageRepository: string
  imageTag: string
  status: string
  ports: string[]
  workingDir?: string
  envPath?: string
  composeProject?: string
  composeService?: string
  alreadyImported: boolean
  importable: boolean
  importReason?: string
    suggestedProject: {
      name: string
      source: Project['source']
      runtime: Project['runtime']
      repoImage: string
      deployCommands: string[]
    envPath?: string
    workingDir?: string
    proxyType: Project['proxyType']
    webhookEnabled: boolean
    notifications: Project['notifications']
  }
}

interface ScanResult extends DiscoveredApp {
  sourceServerId: string
  sourceServerName: string
}

export default function ScanPage() {
  const [servers, setServers] = useState<ServerSummary[]>([])
  const [results, setResults] = useState<ScanResult[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState<ScanResult | null>(null)
  const [targetServerId, setTargetServerId] = useState('')

  useEffect(() => {
    async function loadServers() {
      try {
        const data = await api.get<ServerSummary[]>('/servers')
        setServers(data)
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Failed to load servers'
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }

    void loadServers()
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, ScanResult[]>()
    for (const result of results) {
      const existing = map.get(result.sourceServerId) ?? []
      existing.push(result)
      map.set(result.sourceServerId, existing)
    }
    return map
  }, [results])

  async function handleScan() {
    setScanning(true)
    try {
      const discovered = await Promise.all(
        servers.map(async (server) => {
          const apps = await api.get<DiscoveredApp[]>(`/servers/${server.id}/discover`)
          return apps.map((app) => ({
            ...app,
            sourceServerId: server.id,
            sourceServerName: server.name,
          }))
        })
      )

      const flat = discovered.flat()
      setResults(flat)
      toast.success(flat.length > 0 ? `Found ${flat.length} running app${flat.length === 1 ? '' : 's'}` : 'No running Docker apps found')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to scan servers'
      toast.error(message)
    } finally {
      setScanning(false)
    }
  }

  function openImport(result: ScanResult) {
    setSelected(result)
    setTargetServerId(result.sourceServerId)
  }

  async function handleImport() {
    if (!selected || !targetServerId) return
    setImporting(true)
    try {
      await api.post<Project>(`/servers/${targetServerId}/projects`, selected.suggestedProject)
      setResults((current) =>
        current.map((item) =>
          item.containerId === selected.containerId && item.sourceServerId === selected.sourceServerId
            ? { ...item, alreadyImported: true }
            : item
        )
      )
      setServers((current) =>
        current.map((server) =>
          server.id === targetServerId
            ? { ...server, projectCount: (server.projectCount ?? 0) + 1 }
            : server
        )
      )
      toast.success(`Imported ${selected.suggestedProject.name}`)
      setSelected(null)
      setTargetServerId('')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to import app'
      toast.error(message)
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8">
        <div className="border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          Loading servers...
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--green)]">Discovery</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--text)]">Scan</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">
            Scan every connected server for running Docker apps, then import the good candidates into Launchpad from one place.
          </p>
        </div>
        <Button onClick={() => void handleScan()} loading={scanning} disabled={servers.length === 0}>
          Scan all servers
        </Button>
      </section>

      {servers.length === 0 ? (
        <div className="border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          No servers configured yet.
        </div>
      ) : null}

      {servers.map((server) => {
        const items = grouped.get(server.id) ?? []
        return (
          <section key={server.id} className="border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">{server.name}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  <SensitiveText value={`${server.user}@${server.host}:${server.port}`} />
                </p>
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {items.length} result{items.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {items.length > 0 ? (
                items.map((app) => (
                  <div key={`${app.sourceServerId}-${app.containerId}`} className="border border-[var(--border)] bg-[var(--surface-2)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text)]">{app.suggestedProject.name}</h3>
                        <p className="mt-1 text-xs text-[var(--text-muted)]"><SensitiveText value={app.image} /></p>
                        <div className="mt-2">
                          <ProjectClassificationBadge
                            source={app.suggestedProject.source}
                            runtime={app.suggestedProject.runtime}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        <span className="border border-[var(--border)] px-2 py-1">{app.status}</span>
                        {app.composeService ? <span className="border border-[var(--border)] px-2 py-1">compose</span> : null}
                        {app.alreadyImported ? <span className="border border-[var(--green)] px-2 py-1 text-[var(--green)]">imported</span> : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-[var(--text-muted)] md:grid-cols-2">
                      <div>Container: <SensitiveText value={app.containerName} className="font-mono text-[var(--text)]" /></div>
                      <div>Image tag: <span className="text-[var(--text)]">{app.imageTag}</span></div>
                      <div>Working dir: <SensitiveText value={app.workingDir || 'not detected'} className="font-mono text-[var(--text)]" /></div>
                      <div>Env path: <SensitiveText value={app.envPath || 'not detected'} className="font-mono text-[var(--text)]" /></div>
                    </div>

                    <div className="mt-4 border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
                      Suggested deploy commands:
                      <pre data-sensitive="true" className="mt-2 whitespace-pre-wrap font-mono text-[var(--text)]">
                        {app.suggestedProject.deployCommands.join('\n')}
                      </pre>
                    </div>

                    {!app.importable ? (
                      <p className="mt-4 text-sm text-[var(--yellow)]">{app.importReason}</p>
                    ) : null}

                    <div className="mt-4">
                      <Button
                        size="sm"
                        onClick={() => openImport(app)}
                        disabled={!app.importable || app.alreadyImported}
                      >
                        {app.alreadyImported ? 'Imported' : 'Import'}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-muted)]">
                  No scanned apps for this server yet.
                </div>
              )}
            </div>
          </section>
        )
      })}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--green)]">Import</p>
                <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">{selected.suggestedProject.name}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Discovered on {selected.sourceServerName}. Choose which Launchpad server record should own this project.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Import to server</span>
                <select
                  value={targetServerId}
                  onChange={(event) => setTargetServerId(event.target.value)}
                  className="h-10 border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--green)]"
                >
                  <option value="">Select a server</option>
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-muted)]">
                <div>Image: <SensitiveText value={selected.suggestedProject.repoImage} className="text-[var(--text)]" /></div>
                <div className="mt-2">
                  <ProjectClassificationBadge
                    source={selected.suggestedProject.source}
                    runtime={selected.suggestedProject.runtime}
                  />
                </div>
                <div className="mt-2">Working dir: <SensitiveText value={selected.suggestedProject.workingDir || 'not detected'} className="font-mono text-[var(--text)]" /></div>
                <div className="mt-2">Env path: <SensitiveText value={selected.suggestedProject.envPath || 'not detected'} className="font-mono text-[var(--text)]" /></div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void handleImport()} loading={importing} disabled={!targetServerId}>
                  Confirm import
                </Button>
                <Button variant="ghost" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
