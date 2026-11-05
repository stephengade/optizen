'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type {
  ActivityEvent,
  DeployLogEvent,
  DeployRecord,
  DeployStatus,
  Project,
  ProjectFileSuggestion,
  ProjectHealthState,
} from '@launchpad/shared'
import { toast } from 'sonner'
import { ActivityTimeline } from '@/components/dashboard/ActivityTimeline'
import { DeployButton } from '@/components/dashboard/DeployButton'
import { DeployHistory } from '@/components/dashboard/DeployHistory'
import { FileSuggestions } from '@/components/dashboard/FileSuggestions'
import { HealthBadge } from '@/components/dashboard/HealthBadge'
import { ImagePanel, type ImageStatus } from '@/components/dashboard/ImagePanel'
import { ProjectLogsPanel } from '@/components/dashboard/ProjectLogsPanel'
import { ProjectClassificationBadge } from '@/components/dashboard/ProjectClassificationBadge'
import { DeployStatusBadge } from '@/components/dashboard/DeployStatusBadge'
import { LogStream, type LogLine } from '@/components/dashboard/LogStream'
import { ProjectForm } from '@/components/dashboard/ProjectForm'
import { Button } from '@/components/ui/Button'
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal'
import { LoadingState } from '@/components/ui/LoadingState'
import { SensitivePanel } from '@/components/ui/SensitivePanel'
import { ReauthModal } from '@/components/ui/ReauthModal'
import { SensitiveText } from '@/components/ui/SensitiveText'
import { api, ApiError, isReauthRequiredError } from '@/lib/api'
import {
  demoImageStatus,
  demoImageTags,
  demoProjectLogs,
  getDemoActivityForProject,
  getDemoDeploysForProject,
  getDemoProject,
  isDemoId,
  demoFileSuggestions,
} from '@/lib/demo-fixtures'
import { useDemoPrivacy } from '@/lib/demo-privacy-context'
import { formatDateTime, formatDuration, formatRelative } from '@/lib/utils'

export default function ProjectDetailPage() {
  const params = useParams<{ id: string; pid: string }>()
  const router = useRouter()
  const { demoMode } = useDemoPrivacy()
  const [project, setProject] = useState<Project | null>(null)
  const [history, setHistory] = useState<DeployRecord[]>([])
  const [selectedDeploy, setSelectedDeploy] = useState<DeployRecord | null>(null)
  const [status, setStatus] = useState<DeployStatus>('idle')
  const [imageTag, setImageTag] = useState('')
  const [logs, setLogs] = useState<LogLine[]>([])
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [imageStatus, setImageStatus] = useState<ImageStatus | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [fileSuggestions, setFileSuggestions] = useState<ProjectFileSuggestion[]>([])
  const [imageTags, setImageTags] = useState<string[]>([])
  const [selectedPullTag, setSelectedPullTag] = useState('')
  const [selectedRollbackId, setSelectedRollbackId] = useState('')
  const [pullingImage, setPullingImage] = useState(false)
  const [pruningImages, setPruningImages] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [checkingHealth, setCheckingHealth] = useState(false)
  const [deployConfirmOpen, setDeployConfirmOpen] = useState(false)
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false)
  const [pruneConfirmOpen, setPruneConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [logSources, setLogSources] = useState<Array<{ id: string; label: string }>>([])
  const [selectedLogSource, setSelectedLogSource] = useState('')
  const [logSnapshot, setLogSnapshot] = useState<string[]>([])
  const [logCheckedAt, setLogCheckedAt] = useState<string>()
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)

  const webhookUrl = project?.webhookSecret
    ? // Public URL: the browser's origin + /api (Next.js rewrites /api/* to the API). The internal
      // API address (NEXT_PUBLIC_API_URL) is not reachable from GitHub in a Docker deployment.
      `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/deploy/${params.pid}/${project.webhookSecret}`
    : ''
  const workflowSnippet = webhookUrl
    ? [
        '- name: Deploy via Optizen',
        '  run: |',
        `    curl -X POST "${webhookUrl}" \\`,
        '      -H "Content-Type: application/json" \\',
        '      -d \'{"imageTag":"${{ github.sha }}","ref":"${{ github.ref }}","workflow":"${{ github.workflow }}"}\'',
      ].join('\n')
    : ''

  const likelyProxyPath = (() => {
    if (!project || !project.workingDir) return undefined
    const workingDir = project.workingDir.replace(/\/$/, '')
    const haystack = `${project.name} ${project.repoImage} ${project.workingDir}`.toLowerCase()
    
    if (project.proxyType === 'caddy' || haystack.includes('caddy')) {
      return `${workingDir}/Caddyfile`
    }
    if (project.proxyType === 'nginx' || haystack.includes('nginx')) {
      return `${workingDir}/nginx.conf`
    }
    return undefined
  })()

  function handleDangerousActionError(error: unknown, fallbackMessage: string) {
    if (isReauthRequiredError(error)) {
      setReauthOpen(true)
      toast.error('Verify your session to continue this action.')
      return true
    }

    const message = error instanceof ApiError ? error.message : fallbackMessage
    toast.error(message)
    return false
  }

  async function loadProject() {
    if (demoMode && isDemoId(params.pid)) {
      const data = getDemoProject(params.pid)
      if (!data) {
        toast.error('Demo project not found')
        router.push(`/servers/${params.id}`)
        return
      }
      setProject(data)
      setLoading(false)
      return
    }
    try {
      const data = await api.get<Project>(`/projects/${params.pid}`)
      setProject(data)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load project'
      toast.error(message)
      router.push(`/servers/${params.id}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadImageState() {
    if (demoMode && isDemoId(params.pid)) {
      setImageStatus(demoImageStatus[params.pid] ?? null)
      setImageTags(demoImageTags[params.pid] ?? [])
      if (!selectedPullTag && (demoImageTags[params.pid]?.length ?? 0) > 0) {
        setSelectedPullTag(demoImageTags[params.pid][0])
      }
      return
    }
    try {
      const [statusData, tagsData] = await Promise.all([
        api.get<ImageStatus>(`/images/${params.pid}/status`),
        api.get<{ tags: string[] }>(`/images/${params.pid}/tags`),
      ])
      setImageStatus(statusData)
      setImageTags(tagsData.tags)
      if (!selectedPullTag && tagsData.tags.length > 0) {
        setSelectedPullTag(tagsData.tags[0])
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load image status'
      toast.error(message)
    }
  }

  async function loadHistory() {
    if (demoMode && isDemoId(params.pid)) {
      const records = getDemoDeploysForProject(params.pid)
      setHistory(records)
      if (records.length > 0) {
        setStatus(records[0].status)
        if (!selectedDeploy) {
          setSelectedDeploy(records[0])
        }
      }
      return
    }
    try {
      const records = await api.get<DeployRecord[]>(`/deploy/${params.pid}/history`)
      setHistory(records)
      if (records.length > 0) {
        setStatus(records[0].status)
        if (!selectedDeploy) {
          setSelectedDeploy(records[0])
        }
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load deploy history'
      toast.error(message)
    }
  }

  async function loadActivity() {
    if (demoMode && isDemoId(params.pid)) {
      setActivity(getDemoActivityForProject(params.pid))
      return
    }
    try {
      const records = await api.get<ActivityEvent[]>(`/projects/${params.pid}/activity`)
      setActivity(records)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load activity timeline'
      toast.error(message)
    }
  }

  async function loadFileSuggestions() {
    if (demoMode && isDemoId(params.pid)) {
      setFileSuggestions(demoFileSuggestions[params.pid] ?? [])
      return
    }
    try {
      const data = await api.get<ProjectFileSuggestion[]>(`/files/projects/${params.pid}/suggestions`)
      setFileSuggestions(data)
    } catch {
      setFileSuggestions([])
    }
  }

  async function loadLogSources() {
    if (demoMode && isDemoId(params.pid)) {
      const data = demoProjectLogs[params.pid]?.sources ?? []
      setLogSources(data)
      setSelectedLogSource((current) => current || data[0]?.id || '')
      return
    }
    try {
      const data = await api.get<Array<{ id: string; label: string }>>(`/logs/${params.pid}/sources`)
      setLogSources(data)
      setSelectedLogSource((current) => current || data[0]?.id || '')
    } catch {
      setLogSources([])
    }
  }

  async function loadProjectLogs(source = selectedLogSource) {
    if (!source) return
    if (demoMode && isDemoId(params.pid)) {
      setLogSnapshot(demoProjectLogs[params.pid]?.snapshots[source] ?? [])
      setLogCheckedAt(new Date().toISOString())
      return
    }
    setLogsLoading(true)
    try {
      const data = await api.get<{ lines: string[]; checkedAt: string }>(`/logs/${params.pid}/snapshot?source=${encodeURIComponent(source)}`)
      setLogSnapshot(data.lines)
      setLogCheckedAt(data.checkedAt)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load project logs'
      toast.error(message)
    } finally {
      setLogsLoading(false)
    }
  }

  async function selectDeploy(deployId: string) {
    if (demoMode && isDemoId(params.pid)) {
      const record = getDemoDeploysForProject(params.pid).find((item) => item.id === deployId) ?? null
      setSelectedDeploy(record)
      return
    }
    try {
      const record = await api.get<DeployRecord>(`/deploy/${params.pid}/history/${deployId}`)
      setSelectedDeploy(record)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load deploy details'
      toast.error(message)
    }
  }

  useEffect(() => {
    void loadProject()
    void loadHistory()
    void loadImageState()
    void loadActivity()
    void loadFileSuggestions()
    void loadLogSources()
  }, [params.pid])

  useEffect(() => {
    if (!selectedLogSource) return
    void loadProjectLogs(selectedLogSource)
  }, [selectedLogSource])

  useEffect(() => {
    if (!logsAutoRefresh || !selectedLogSource) return
    const interval = setInterval(() => {
      void loadProjectLogs(selectedLogSource)
    }, 10_000)
    return () => clearInterval(interval)
  }, [logsAutoRefresh, selectedLogSource])

  useEffect(() => {
    if (demoMode && isDemoId(params.pid)) {
      return
    }
    const source = new EventSource(`/api/deploy/${params.pid}/stream`, { withCredentials: true })

    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as DeployLogEvent

      if (payload.type === 'status' && payload.status) {
        setStatus(payload.status)
        setDeploying(payload.status === 'deploying')
      }

      if (payload.type === 'log' && payload.line) {
        setLogs((current) => [
          ...current,
          {
            id: `${Date.now()}-${current.length}`,
            text: payload.line!,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
        ])
      }

      if (payload.type === 'error' && payload.error) {
        setStatus('failed')
        setDeploying(false)
        toast.error(payload.error)
      }

      if (payload.type === 'done' && payload.status) {
        setStatus(payload.status)
        setDeploying(false)
        void loadHistory()
        void loadImageState()
        void loadProject()
        void loadActivity()
      }
    }

    source.onerror = () => {
      // EventSource will retry automatically; no toast needed for transient reconnects.
    }

    return () => source.close()
  }, [params.pid])

  async function handleUpdate(payload: {
    name: string
    source: Project['source']
    runtime: Project['runtime']
    repoImage: string
    deployCommands: string[]
    envPath?: string
    workingDir?: string
    proxyType: Project['proxyType']
    healthCheck?: Project['healthCheck']
    webhookEnabled: boolean
    notifications: Project['notifications']
  }) {
    if (demoMode) {
      toast.success('Demo mode is active. Seeded project data stays read-only.')
      return
    }
    const updated = await api.patch<Project>(`/projects/${params.pid}`, payload)
    setProject(updated)
    toast.success('Project updated')
  }

  async function handleDelete() {
    if (demoMode) {
      toast.success('Demo mode is active. Seeded project data stays read-only.')
      return
    }
    try {
      await api.delete(`/projects/${params.pid}`)
      toast.success('Project deleted')
      router.push(`/servers/${params.id}`)
    } catch (error) {
      if (handleDangerousActionError(error, 'Failed to delete project')) {
        return
      }
      throw error
    }
  }

  async function handleRegenerate() {
    if (demoMode) {
      toast.success('Demo mode is active. Webhook examples are seeded and read-only.')
      return
    }
    setRegenerating(true)
    try {
      const data = await api.post<{ webhookSecret: string }>(`/projects/${params.pid}/webhook-secret`)
      setProject((current) => (current ? { ...current, webhookSecret: data.webhookSecret } : current))
      toast.success('Webhook secret regenerated')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to regenerate secret'
      toast.error(message)
    } finally {
      setRegenerating(false)
    }
  }

  async function handleDeploy() {
    if (demoMode) {
      toast.success('Demo mode is active. Deploy state is seeded for walkthroughs.')
      return
    }
    setDeploying(true)
    setStatus('deploying')
    setLogs([])

    try {
      await api.post(`/deploy/${params.pid}`, {
        projectId: params.pid,
        imageTag: imageTag.trim() || undefined,
        trigger: 'ui',
      })
      toast.success('Deploy started')
    } catch (error) {
      setDeploying(false)
      setStatus(history[0]?.status ?? 'idle')
      handleDangerousActionError(error, 'Failed to start deploy')
    }
  }

  async function handleHealthCheck() {
    if (demoMode) {
      toast.success('Demo mode is active. Health state is already seeded.')
      return
    }
    setCheckingHealth(true)
    try {
      const data = await api.post<ProjectHealthState>(`/projects/${params.pid}/health`)
      setProject((current) => (current ? { ...current, healthStatus: data } : current))
      toast.success(data.status === 'healthy' ? 'Health check passed' : data.message ?? 'Health check completed')
      void loadActivity()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to run health check'
      toast.error(message)
    } finally {
      setCheckingHealth(false)
    }
  }

  async function handlePullImage() {
    if (demoMode) {
      toast.success('Demo mode is active. Image state is seeded and read-only.')
      return
    }
    setPullingImage(true)
    try {
      await api.post(`/images/${params.pid}/pull`, { tag: selectedPullTag || undefined })
      toast.success(`Pulled ${project?.repoImage}:${selectedPullTag || 'latest'}`)
      void loadImageState()
    } catch (error) {
      handleDangerousActionError(error, 'Failed to pull image')
    } finally {
      setPullingImage(false)
    }
  }

  async function handlePruneImages() {
    if (demoMode) {
      toast.success('Demo mode is active. Image cleanup actions are disabled.')
      return
    }
    setPruningImages(true)
    try {
      const data = await api.post<{ output: string }>(`/images/${params.pid}/prune`)
      toast.success(data.output || 'Image prune completed')
      void loadImageState()
    } catch (error) {
      handleDangerousActionError(error, 'Failed to prune images')
    } finally {
      setPruningImages(false)
    }
  }

  async function handleRollback() {
    if (!selectedRollbackId) return
    if (demoMode) {
      toast.success('Demo mode is active. Rollback state is seeded and read-only.')
      return
    }
    setRollingBack(true)
    try {
      const data = await api.post<{ imageTag: string }>(`/images/${params.pid}/rollback`, {
        deployId: selectedRollbackId,
      })
      toast.success(`Rollback started for tag ${data.imageTag}`)
      setDeploying(true)
      setStatus('deploying')
    } catch (error) {
      handleDangerousActionError(error, 'Failed to start rollback')
    } finally {
      setRollingBack(false)
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-8 lg:px-8">
        <LoadingState label="Loading project" detail="Fetching deploy history, image state, file suggestions, and health data." />
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8 lg:px-8">
      <section>
        <Link href={`/servers/${params.id}`} className="text-xs uppercase tracking-[0.24em] text-(--text-muted)">
          Back to server
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-(--text)">{project.name}</h1>
        <p className="mt-2 text-sm text-(--text-muted)">
          <SensitiveText value={project.repoImage} />
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ProjectClassificationBadge source={project.source} runtime={project.runtime} />
          <HealthBadge status={project.healthStatus?.status} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/servers/${params.id}/projects/${params.pid}/env`}
            className="inline-flex h-9 items-center border border-(--border) px-3 text-sm text-(--text) transition-colors hover:bg-(--surface-2)"
          >
            Open env editor
          </Link>
          {project.proxyType && project.proxyType !== 'none' && (
            <Link
              href={`/servers/${params.id}/proxy${likelyProxyPath ? `?path=${encodeURIComponent(likelyProxyPath)}` : ''}`}
              className="inline-flex h-9 items-center border border-(--border) px-3 text-sm text-(--text) transition-colors hover:bg-(--surface-2)"
            >
              Open proxy editor
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={() => void handleHealthCheck()} loading={checkingHealth}>
            Run heartbeat
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="border border-(--border) bg-(--surface) p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-(--text-muted)">Health</div>
          <div className="mt-2 text-lg font-semibold text-(--text)">{project.healthStatus?.status ?? 'unknown'}</div>
          <div className="mt-1 text-sm text-(--text-muted)">
            {project.healthStatus?.message ?? 'Configure a path or port to start heartbeat tracking.'}
          </div>
        </div>
        <div className="border border-(--border) bg-(--surface) p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-(--text-muted)">Last successful heartbeat</div>
          <div className="mt-2 text-lg font-semibold text-(--text)">
            {project.healthStatus?.lastSuccessfulAt ? formatRelative(project.healthStatus.lastSuccessfulAt) : 'Never'}
          </div>
          <div className="mt-1 text-sm text-(--text-muted)">
            {project.healthStatus?.lastSuccessfulAt ? formatDateTime(project.healthStatus.lastSuccessfulAt) : 'Run a health check after configuring it.'}
          </div>
        </div>
        <div className="border border-(--border) bg-(--surface) p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-(--text-muted)">Health target</div>
          <div className="mt-2 text-lg font-semibold text-(--text)">
            {project.healthCheck?.path || (project.healthCheck?.port ? `:${project.healthCheck.port}` : 'Not set')}
          </div>
          <div className="mt-1 text-sm text-(--text-muted)">
            {project.healthCheck?.path ? 'HTTP endpoint on 127.0.0.1' : project.healthCheck?.port ? 'TCP port check on 127.0.0.1' : 'Add one in project settings.'}
          </div>
        </div>
      </section>

      <FileSuggestions suggestions={fileSuggestions} />

      <section className="border border-(--border) bg-(--surface) p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
                        <h2 className="mt-2 text-lg font-semibold text-(--text)">Deploy engine</h2>
            <p className="mt-1 text-sm text-(--text-muted)">
              Trigger commands over SSH and watch output stream into the dashboard in real time.
            </p>
          </div>
          <DeployStatusBadge status={status} />
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="flex min-w-64 flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-(--text-muted)">
              Image tag
            </span>
            <input
              value={imageTag}
              onChange={(event) => setImageTag(event.target.value)}
              placeholder="latest or git sha"
              className="h-10 border border-(--border) bg-(--surface-2) px-3 text-sm text-(--text) outline-none focus:border-(--border-strong)"
            />
          </label>
          <DeployButton status={deploying ? 'deploying' : status} onDeploy={() => setDeployConfirmOpen(true)} />
        </div>

        <div className="mt-4 border border-(--border) bg-(--surface-2) px-4 py-3 text-sm text-(--text-muted)">
          Optizen will run these commands in {project.workingDir || 'the remote default directory'}:
          <pre data-sensitive="true" className="mt-2 whitespace-pre-wrap font-mono text-xs text-(--text)">
            {project.deployCommands.join('\n')}
          </pre>
        </div>

        <div className="mt-5">
          <LogStream lines={logs} />
        </div>
      </section>

      <ImagePanel
        repoImage={project.repoImage}
        status={imageStatus}
        tags={imageTags}
        selectedTag={selectedPullTag}
        pulling={pullingImage}
        pruning={pruningImages}
        rollingBack={rollingBack}
        rollbackCandidates={history.filter((record) => record.status === 'success' && Boolean(record.imageTag))}
        selectedRollbackId={selectedRollbackId}
        onTagChange={setSelectedPullTag}
        onRollbackChange={setSelectedRollbackId}
        onPull={() => void handlePullImage()}
        onPrune={() => setPruneConfirmOpen(true)}
        onRefresh={() => void loadImageState()}
        onRollback={() => setRollbackConfirmOpen(true)}
      />

      <ProjectLogsPanel
        sources={logSources}
        selectedSource={selectedLogSource}
        lines={logSnapshot}
        checkedAt={logCheckedAt}
        loading={logsLoading}
        autoRefresh={logsAutoRefresh}
        onSourceChange={setSelectedLogSource}
        onRefresh={() => void loadProjectLogs(selectedLogSource)}
        onAutoRefreshToggle={() => setLogsAutoRefresh((current) => !current)}
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-(--text)">Deploy history</h2>
          <DeployHistory
            records={history}
            selectedId={selectedDeploy?.id}
            onSelect={(deployId) => void selectDeploy(deployId)}
          />
        </div>

        <div className="border border-(--border) bg-(--surface) p-6">
          <h2 className="text-lg font-semibold text-(--text)">Selected deploy</h2>
          {selectedDeploy ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <DeployStatusBadge status={selectedDeploy.status} />
                <span className="text-sm text-(--text-muted)">{selectedDeploy.trigger}</span>
                <span className="text-sm text-(--text-muted)">
                  {selectedDeploy.durationMs ? formatDuration(selectedDeploy.durationMs) : 'Pending'}
                </span>
              </div>
              {selectedDeploy.imageTag ? (
                <div className="text-sm text-(--text-muted)">Image tag: {selectedDeploy.imageTag}</div>
              ) : null}
              {selectedDeploy.error ? (
                <div className="border border-(--red) bg-(--red-dim) px-3 py-2 text-sm text-(--red)">
                  {selectedDeploy.error}
                </div>
              ) : null}
              <div className="border border-(--border) bg-[#0b0b0d] px-4 py-3 font-mono text-xs text-(--text)">
                <div className="space-y-2">
                  {selectedDeploy.logSnapshot.length > 0 ? (
                    selectedDeploy.logSnapshot.map((line, index) => <div key={`${selectedDeploy.id}-${index}`}>{line}</div>)
                  ) : (
                    <div className="text-(--text-muted)">No log snapshot captured.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-(--text-muted)">Select a deploy to inspect its log snapshot.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-(--text)">Activity timeline</h2>
        <ActivityTimeline events={activity} emptyLabel="No project activity yet. Deploys, imports, env edits, proxy edits, and health checks will appear here." />
      </section>

      <div className="border border-(--border) bg-(--surface) p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
                        <h2 className="mt-2 text-lg font-semibold text-(--text)">Inbound webhook</h2>
            <p className="mt-1 text-sm text-(--text-muted)">
              Use this endpoint from GitHub Actions or another CI system to trigger deploys after a build succeeds.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <DeployStatusBadge status={project.webhookEnabled ? 'success' : 'idle'} />
            <Button variant="ghost" size="sm" onClick={() => void handleRegenerate()} loading={regenerating}>
              Regenerate secret
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="border border-(--border) bg-(--surface-2) px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-(--text)">Webhook status</h3>
                <p className="mt-1 text-xs text-(--text-muted)">
                  {project.webhookEnabled
                    ? 'Public endpoint is active and secret-gated.'
                    : 'Webhook is disabled. Requests will return 404 until you enable it in project settings.'}
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.18em] text-(--text-muted)">
                {project.webhookEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <SensitivePanel label="Webhook URL" value={webhookUrl} emptyLabel="No webhook URL available" code />
          <SensitivePanel label="GitHub Actions snippet" value={workflowSnippet} emptyLabel="Enable the project webhook to generate a CI snippet." code />
        </div>
      </div>

      <ProjectForm
        title="Edit project"
        description="Fine-tune deploy metadata, webhook enablement, and notification defaults so CI and manual deploys share the same project contract."
        submitLabel="Save changes"
        initialValue={project}
        onSubmit={handleUpdate}
        onDelete={async () => {
          setDeleteConfirmOpen(true)
        }}
      />

      <ConfirmActionModal
        open={deployConfirmOpen}
        title="Review deploy"
        description="Check the commands and target tag before Optizen starts this deploy."
        confirmLabel="Start deploy"
        tone="primary"
        details={[
          `Working directory: ${project.workingDir || 'remote default'}`,
          `Image tag override: ${imageTag.trim() || 'latest/default behavior'}`,
          ...project.deployCommands.map((command) => `$ ${command}`),
        ]}
        onClose={() => setDeployConfirmOpen(false)}
        onConfirm={async () => {
          await handleDeploy()
          setDeployConfirmOpen(false)
        }}
      />

      <ConfirmActionModal
        open={rollbackConfirmOpen}
        title="Review rollback"
        description="Rollback re-runs the deploy flow using the selected successful image tag."
        confirmLabel="Start rollback"
        tone="primary"
        details={[
          `Selected deploy: ${selectedRollbackId || 'none selected'}`,
          `Target tag: ${history.find((record) => record.id === selectedRollbackId)?.imageTag || 'not available'}`,
          `Last successful deploys available: ${history.filter((record) => record.status === 'success' && record.imageTag).length}`,
        ]}
        loading={rollingBack}
        onClose={() => setRollbackConfirmOpen(false)}
        onConfirm={async () => {
          await handleRollback()
          setRollbackConfirmOpen(false)
        }}
      />

      <ConfirmActionModal
        open={pruneConfirmOpen}
        title="Prune unused images"
        description="This removes dangling images on the server. It is useful for cleanup, but it is still a destructive operation."
        confirmLabel="Prune images"
        details={[
          `Repository: ${project.repoImage}`,
          'Only unused images are removed.',
          'Refresh image status after prune to verify the new state.',
        ]}
        loading={pruningImages}
        onClose={() => setPruneConfirmOpen(false)}
        onConfirm={async () => {
          await handlePruneImages()
          setPruneConfirmOpen(false)
        }}
      />

      <ConfirmActionModal
        open={deleteConfirmOpen}
        title="Delete project"
        description="This removes the Optizen project record, deploy history context, and health configuration from the dashboard. It does not delete the remote app by itself."
        confirmLabel="Delete project"
        confirmKeyword={project.name}
        details={[
          `Project: ${project.name}`,
          `Runtime: ${project.runtime}`,
          `Last deploy: ${project.lastDeploy?.status ?? 'none yet'}`,
        ]}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={async () => {
          await handleDelete()
          setDeleteConfirmOpen(false)
        }}
      />

      <ReauthModal open={reauthOpen} onClose={() => setReauthOpen(false)} />
    </div>
  )
}
