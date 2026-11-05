'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Project, Server } from '@launchpad/shared'
import { toast } from 'sonner'
import { ProjectClassificationBadge } from '@/components/dashboard/ProjectClassificationBadge'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { SensitiveText } from '@/components/ui/SensitiveText'
import { api, ApiError } from '@/lib/api'
import { demoProjects, demoServers } from '@/lib/demo-fixtures'
import { useDemoPrivacy } from '@/lib/demo-privacy-context'

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
  const { demoMode } = useDemoPrivacy()
  const [servers, setServers] = useState<ServerSummary[]>([])
  const [results, setResults] = useState<ScanResult[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState<ScanResult | null>(null)
  const [targetServerId, setTargetServerId] = useState('')

  useEffect(() => {
    async function loadServers() {
      if (demoMode) {
        setServers(demoServers)
        setLoading(false)
        return
      }
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
  }, [demoMode])

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
    if (demoMode) {
      const seeded = demoProjects.map((project) => ({
        containerId: `${project.id}-container`,
        containerName: project.name,
        image: project.repoImage,
        imageRepository: project.repoImage,
        imageTag: project.lastDeploy?.imageTag || 'latest',
        status: project.healthStatus?.status === 'healthy' ? 'running' : 'degraded',
        ports: project.healthCheck?.port ? [`${project.healthCheck.port}/tcp`] : ['3000/tcp'],
        workingDir: project.workingDir,
        envPath: project.envPath,
        composeProject: project.runtime === 'compose' ? project.name : undefined,
        composeService: project.runtime === 'compose' ? project.name : undefined,
        alreadyImported: project.source === 'manual',
        importable: true,
        suggestedProject: {
          name: project.name,
          source: project.source,
          runtime: project.runtime,
          repoImage: project.repoImage,
          deployCommands: project.deployCommands,
          envPath: project.envPath,
          workingDir: project.workingDir,
          proxyType: project.proxyType,
          webhookEnabled: project.webhookEnabled,
          notifications: project.notifications,
        },
        sourceServerId: project.serverId,
        sourceServerName: demoServers.find((server) => server.id === project.serverId)?.name || 'Demo server',
      }))
      setResults(seeded)
      toast.success(`Loaded ${seeded.length} seeded demo app${seeded.length === 1 ? '' : 's'}`)
      return
    }
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
    if (demoMode) {
      toast.success(`Demo import reviewed for ${selected.suggestedProject.name}. Seeded data stays read-only.`)
      setSelected(null)
      setTargetServerId('')
      return
    }
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
        <LoadingState label="Loading servers" detail="Preparing the list of hosts available for scanning." />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-(--text)">Scan</h1>
          <p className="mt-1 text-sm text-(--text-muted)">
            Discover running Docker workloads and import them as projects.
          </p>
        </div>
        <Button onClick={() => void handleScan()} loading={scanning} disabled={servers.length === 0}>
          Scan all servers
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 border rounded-(--radius) border-(--border) divide-x divide-(--border) mb-8">
        <div className="px-5 py-4">
          <div className="text-[12.5px] font-medium text-(--text-muted)">Servers</div>
          <div className="mt-1.5 text-2xl font-semibold text-(--text)">{servers.length}</div>
        </div>
        <div className="px-5 py-4">
          <div className="text-[12.5px] font-medium text-(--text-muted)">Results</div>
          <div className="mt-1.5 text-2xl font-semibold text-(--text)">{results.length}</div>
        </div>
      </div>

      {servers.length === 0 && (
        <div className="border rounded-(--radius) border-dashed border-(--border) px-5 py-10 text-center">
          <p className="text-sm text-(--text-muted)">No servers configured yet.</p>
        </div>
      )}

      <div className="space-y-8">
        {servers.map((server) => {
          const items = grouped.get(server.id) ?? []
          return (
            <section key={server.id}>
              <div className="flex items-center justify-between gap-4 border rounded-(--radius) border-(--border) bg-(--surface) px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-(--text)">{server.name}</h2>
                  <p className="mt-0.5 text-xs text-(--text-muted)">
                    <SensitiveText value={`${server.user}@${server.host}:${server.port}`} />
                  </p>
                </div>
                <span className="text-xs text-(--text-muted)">{items.length} result{items.length !== 1 ? 's' : ''}</span>
              </div>

              {items.length > 0 ? (
                <div className="border border-(--border) border-t-0 divide-y divide-(--border)">
                  {items.map((app) => (
                    <div key={`${app.sourceServerId}-${app.containerId}`} className="p-5 bg-(--surface)">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-semibold text-(--text)">{app.suggestedProject.name}</h3>
                          <p className="mt-0.5 text-xs text-(--text-muted)"><SensitiveText value={app.image} /></p>
                          <div className="mt-2">
                            <ProjectClassificationBadge source={app.suggestedProject.source} runtime={app.suggestedProject.runtime} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-[11.5px] font-medium text-(--text-muted)">
                          <span className="border rounded-(--radius) border-(--border) px-2 py-0.5">{app.status}</span>
                          {app.composeService && <span className="border rounded-(--radius) border-(--border) px-2 py-0.5">compose</span>}
                          {app.alreadyImported && <span className="rounded-full border border-(--green-border) bg-(--green-dim) px-2 py-0.5 text-(--green)">Imported</span>}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 border rounded-(--radius) border-(--border) divide-x divide-(--border) text-xs">
                        <div className="px-3 py-2 text-(--text-muted)">Container: <SensitiveText value={app.containerName} className="font-mono text-(--text)" /></div>
                        <div className="px-3 py-2 text-(--text-muted)">Tag: <span className="text-(--text)">{app.imageTag}</span></div>
                        <div className="px-3 py-2 text-(--text-muted) border-t border-(--border)">Dir: <SensitiveText value={app.workingDir || '—'} className="font-mono text-(--text)" /></div>
                        <div className="px-3 py-2 text-(--text-muted) border-t border-(--border)">Env: <SensitiveText value={app.envPath || '—'} className="font-mono text-(--text)" /></div>
                      </div>

                      <div className="mt-3 border rounded-(--radius) border-(--border) bg-(--bg) px-4 py-3">
                        <div className="text-[11.5px] font-medium text-(--text-muted) mb-1.5">Deploy commands</div>
                        <pre data-sensitive="true" className="whitespace-pre-wrap font-mono text-xs text-(--text)">
                          {app.suggestedProject.deployCommands.join('\n')}
                        </pre>
                      </div>

                      {!app.importable && (
                        <p className="mt-3 text-xs text-(--yellow)">{app.importReason}</p>
                      )}

                      <div className="mt-4">
                        <Button size="sm" onClick={() => openImport(app)} disabled={!app.importable || app.alreadyImported}>
                          {app.alreadyImported ? 'Imported' : 'Import'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-(--border) border-t-0 px-5 py-6 text-sm text-(--text-muted)">
                  No results yet — run a scan.
                </div>
              )}
            </section>
          )
        })}
      </div>

      <Modal
        open={Boolean(selected)}
        title={selected ? `Import ${selected.suggestedProject.name}` : 'Import app'}
        description={selected ? `Discovered on ${selected.sourceServerName}. Choose the server record that should own this project.` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-(--text-muted)">Import to server</span>
              <select
                value={targetServerId}
                onChange={(e) => setTargetServerId(e.target.value)}
                className="h-9 border rounded-(--radius) border-(--border) bg-(--surface-2) px-3 text-sm text-(--text) outline-none focus:border-(--border-strong)"
              >
                <option value="">Select a server</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>

            <div className="border rounded-(--radius) border-(--border) bg-(--surface-2) p-4 text-xs space-y-2 text-(--text-muted)">
              <div>Image: <SensitiveText value={selected.suggestedProject.repoImage} className="text-(--text)" /></div>
              <div className="pt-1"><ProjectClassificationBadge source={selected.suggestedProject.source} runtime={selected.suggestedProject.runtime} /></div>
              <div>Dir: <SensitiveText value={selected.suggestedProject.workingDir || '—'} className="font-mono text-(--text)" /></div>
              <div>Env: <SensitiveText value={selected.suggestedProject.envPath || '—'} className="font-mono text-(--text)" /></div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => void handleImport()} loading={importing} disabled={!targetServerId}>
                Confirm import
              </Button>
              <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
