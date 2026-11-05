'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { MemoryActionResult, MemoryContainer, MemoryProcess, MemoryReport, Server } from '@launchpad/shared'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal'
import { LoadingState } from '@/components/ui/LoadingState'
import { ReauthModal } from '@/components/ui/ReauthModal'
import { SensitiveText } from '@/components/ui/SensitiveText'
import { api, ApiError, isReauthRequiredError } from '@/lib/api'
import { isDemoId } from '@/lib/demo-fixtures'
import { useDemoPrivacy } from '@/lib/demo-privacy-context'
import { formatBytes, formatPercent } from '@/lib/format'
import { formatRelative } from '@/lib/utils'

type PendingAction =
  | { kind: 'drop-caches' }
  | { kind: 'restart-container'; container: MemoryContainer }
  | { kind: 'kill-process'; process: MemoryProcess; signal: 'TERM' | 'KILL' }

function describeAction(action: PendingAction) {
  switch (action.kind) {
    case 'drop-caches':
      return {
        title: 'Drop page cache',
        description:
          'Asks the kernel to discard cached file data. Nothing running is stopped and no data is lost, but disk reads are slower for a while as the cache refills.',
        confirmLabel: 'Drop cache',
        details: ['Runs: sync && echo 3 > /proc/sys/vm/drop_caches', 'Needs root or passwordless sudo.'],
      }
    case 'restart-container':
      return {
        title: `Restart ${action.container.name}`,
        description:
          'Stops and starts the container. Its memory is released, but the app is briefly unavailable and will grow again if it leaks.',
        confirmLabel: 'Restart container',
        details: [
          `Container: ${action.container.name}${action.container.image ? ` (${action.container.image})` : ''}`,
          `Currently using: ${formatBytes(action.container.usageBytes)}`,
        ],
      }
    case 'kill-process':
      return {
        title: action.signal === 'KILL' ? `Force kill ${action.process.command}` : `Stop ${action.process.command}`,
        description:
          action.signal === 'KILL'
            ? 'Sends SIGKILL: the process ends immediately without cleaning up. Use only if Stop did not work.'
            : 'Sends SIGTERM: asks the process to shut down cleanly. If it is managed by systemd, Docker or a process manager, it may be restarted automatically.',
        confirmLabel: action.signal === 'KILL' ? 'Force kill' : 'Stop process',
        details: [
          `PID ${action.process.pid} · ${action.process.command} · user ${action.process.user}`,
          `Using: ${formatBytes(action.process.rssBytes)}`,
          ...(action.process.containerName ? [`Runs inside container ${action.process.containerName}; restarting the container is usually cleaner.`] : []),
        ],
      }
  }
}

export default function ServerMemoryPage() {
  const params = useParams<{ id: string }>()
  const { demoMode } = useDemoPrivacy()
  const isDemo = demoMode && isDemoId(params.id)
  const [server, setServer] = useState<Server | null>(null)
  const [report, setReport] = useState<MemoryReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAllProcesses, setShowAllProcesses] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [running, setRunning] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)
  const [lastResult, setLastResult] = useState<MemoryActionResult | null>(null)

  const load = useCallback(async () => {
    if (isDemo) {
      setLoading(false)
      return
    }
    setRefreshing(true)
    try {
      const [serverData, memory] = await Promise.all([
        api.get<Server>(`/servers/${params.id}`),
        api.get<MemoryReport>(`/servers/${params.id}/memory`),
      ])
      setServer(serverData)
      setReport(memory)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to read memory usage')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [params.id, isDemo])

  useEffect(() => {
    void load()
  }, [load])

  async function runPending() {
    if (!pending) return
    setRunning(true)
    try {
      let result: MemoryActionResult
      if (pending.kind === 'drop-caches') {
        result = await api.post<MemoryActionResult>(`/servers/${params.id}/memory/drop-caches`)
      } else if (pending.kind === 'restart-container') {
        result = await api.post<MemoryActionResult>(`/servers/${params.id}/memory/restart-container`, {
          container: pending.container.id,
        })
      } else {
        result = await api.post<MemoryActionResult>(`/servers/${params.id}/memory/kill-process`, {
          pid: pending.process.pid,
          signal: pending.signal,
        })
      }
      setLastResult(result)
      if (result.success) toast.success(result.output)
      else toast.warning(result.output)
      setPending(null)
      await load()
    } catch (err) {
      if (isReauthRequiredError(err)) {
        setReauthOpen(true)
        return
      }
      toast.error(err instanceof ApiError ? err.message : 'Action failed')
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-8 lg:px-8">
        <LoadingState label="Reading memory" detail="Collecting process, container and kernel memory stats over SSH." />
      </div>
    )
  }

  const b = report?.breakdown
  const pressure = b && b.totalBytes > 0 ? b.availableBytes / b.totalBytes : null
  const swapRatio = b && b.swapTotalBytes > 0 ? b.swapUsedBytes / b.swapTotalBytes : 0
  const actionCopy = pending ? describeAction(pending) : null

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/servers/${params.id}`}
            className="text-[12.5px] font-medium text-(--text-muted) transition-colors hover:text-(--text)"
          >
            ← {server?.name ?? 'Server'}
          </Link>
          <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-(--text)">Memory</h1>
          <p className="mt-1 text-sm text-(--text-muted)">
            What is using RAM on this server, and safe ways to free it.
            {report ? ` Checked ${formatRelative(report.checkedAt)}.` : ''}
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => void load()} loading={refreshing} disabled={isDemo}>
            <RefreshCw size={12} />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!report?.canElevate}
            title={report?.canElevate ? undefined : 'Needs root or passwordless sudo for the SSH user'}
            onClick={() => setPending({ kind: 'drop-caches' })}
          >
            Drop page cache
          </Button>
        </div>
      </div>

      {isDemo ? (
        <div className="border rounded-(--radius) border-dashed border-(--border) px-5 py-8 text-center text-sm text-(--text-muted)">
          The memory view reads live data from a real server and is not available in demo mode.
        </div>
      ) : null}

      {error ? (
        <div className="border rounded-(--radius) border-(--red) bg-(--red-dim) px-4 py-3 text-sm text-(--red)">{error}</div>
      ) : null}

      {lastResult?.availableBeforeBytes !== undefined && lastResult.availableAfterBytes !== undefined ? (
        <div className="border rounded-(--radius) border-(--border) bg-(--surface) px-4 py-3 text-sm text-(--text-muted)">
          Last action: available memory went from{' '}
          <span className="text-(--text)">{formatBytes(lastResult.availableBeforeBytes)}</span> to{' '}
          <span className="text-(--text)">{formatBytes(lastResult.availableAfterBytes)}</span>.
        </div>
      ) : null}

      {b ? (
        <section className="space-y-4">
          <div className="cell-grid grid-cols-2 md:grid-cols-4">
            <Stat label="Used by programs" value={formatBytes(b.usedBytes)} sub={`of ${formatBytes(b.totalBytes)}`} />
            <Stat label="Available" value={formatBytes(b.availableBytes)} sub={pressure !== null ? formatPercent(pressure * 100) + ' of total' : ''} />
            <Stat label="Cache / buffers" value={formatBytes(b.cacheBytes)} sub="freed automatically when needed" />
            <Stat
              label="Swap"
              value={b.swapTotalBytes > 0 ? formatBytes(b.swapUsedBytes) : 'none'}
              sub={b.swapTotalBytes > 0 ? `of ${formatBytes(b.swapTotalBytes)}` : 'no swap configured'}
            />
          </div>

          <MemoryBar breakdown={b} />

          <Diagnosis pressure={pressure} swapRatio={swapRatio} hasSwap={b.swapTotalBytes > 0} oomKills={report?.recentOomKills ?? []} />
        </section>
      ) : null}

      {report?.dockerAvailable ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-(--text)">
            Containers <span className="ml-2 font-normal text-(--text-muted)">{report.containers.length}</span>
          </h2>
          {report.containers.length ? (
            <div className="overflow-x-auto border rounded-(--radius) border-(--border)">
              <table className="w-full text-sm">
                <thead className="text-left text-[11.5px] font-medium text-(--text-muted)">
                  <tr className="border-b border-(--border)">
                    <th className="px-4 py-2 font-normal">Container</th>
                    <th className="px-4 py-2 font-normal">Memory</th>
                    <th className="px-4 py-2 font-normal">CPU</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border)">
                  {report.containers.map((container) => (
                    <tr key={container.id}>
                      <td className="px-4 py-2">
                        <div className="text-(--text)">{container.name}</div>
                        <div className="truncate text-xs text-(--text-muted)">{container.image ?? container.id}</div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-(--text)">
                        {formatBytes(container.usageBytes)}
                        {container.memPercent !== undefined ? (
                          <span className="ml-2 text-xs text-(--text-muted)">{formatPercent(container.memPercent, 1)}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-(--text-muted)">
                        {container.cpuPercent !== undefined ? formatPercent(container.cpuPercent, 1) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setPending({ kind: 'restart-container', container })}>
                          Restart
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-(--text-muted)">No running containers.</p>
          )}
        </section>
      ) : null}

      {report?.groups.length ? (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-(--text)">By program</h2>
          <p className="mb-3 text-xs text-(--text-muted)">All processes with the same name added together (e.g. many php-fpm or node workers).</p>
          <div className="divide-y divide-(--border) border rounded-(--radius) border-(--border)">
            {report.groups.slice(0, 10).map((group) => (
              <div key={group.command} className="flex items-center gap-4 px-4 py-2 text-sm">
                <div className="w-32 truncate text-(--text) sm:w-48">{group.command}</div>
                <div className="flex-1">
                  <div className="h-1.5 bg-(--surface-2)">
                    <div
                      className="h-1.5 bg-(--accent)"
                      style={{ width: `${Math.max(1, (group.rssBytes / (report.groups[0]?.rssBytes || 1)) * 100)}%` }}
                      title={b && b.totalBytes ? `${formatPercent((group.rssBytes / b.totalBytes) * 100, 1)} of RAM` : undefined}
                    />
                  </div>
                </div>
                <div className="w-24 text-right text-(--text)">{formatBytes(group.rssBytes)}</div>
                <div className="hidden w-20 text-right text-xs text-(--text-muted) sm:block">
                  {group.processCount} proc{group.processCount === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {report?.topProcesses.length ? (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-(--text)">Top processes</h2>
          <p className="mb-3 text-xs text-(--text-muted)">
            Sorted by resident memory. System processes (sshd, systemd, dockerd…) are protected and cannot be stopped from here.
          </p>
          <ul className="divide-y divide-(--border) border rounded-(--radius) border-(--border)">
            {(showAllProcesses ? report.topProcesses : report.topProcesses.slice(0, 15)).map((process) => (
              <li key={process.pid} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-(--text)">{process.command}</span>
                    <span className="shrink-0 text-xs text-(--text-muted)">
                      pid {process.pid} · {process.user}
                      {process.containerName ? ` · ${process.containerName}` : ''}
                    </span>
                  </div>
                  <div className="truncate font-mono text-xs text-(--text-muted)" title={process.args}>
                    <SensitiveText value={process.args} />
                  </div>
                </div>
                <div className="w-28 shrink-0 text-right whitespace-nowrap">
                  <div className="text-(--text)">{formatBytes(process.rssBytes)}</div>
                  <div className="text-xs text-(--text-muted)">
                    {formatPercent(process.memPercent, 1)} mem · {formatPercent(process.cpuPercent, 1)} cpu
                  </div>
                </div>
                <div className="flex w-full shrink-0 justify-end gap-1 sm:w-44">
                  {process.protected ? (
                    <span className="text-xs text-(--text-muted)">protected</span>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setPending({ kind: 'kill-process', process, signal: 'TERM' })}>
                        Stop
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setPending({ kind: 'kill-process', process, signal: 'KILL' })}>
                        Force kill
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {report.topProcesses.length > 15 ? (
            <button
              type="button"
              onClick={() => setShowAllProcesses((v) => !v)}
              className="mt-2 text-xs text-(--text-muted) transition-colors hover:text-(--text)"
            >
              {showAllProcesses ? 'Show fewer' : `Show all ${report.topProcesses.length} processes`}
            </button>
          ) : null}
        </section>
      ) : null}

      {pending && actionCopy ? (
        <ConfirmActionModal
          open
          title={actionCopy.title}
          description={actionCopy.description}
          confirmLabel={actionCopy.confirmLabel}
          tone={pending.kind === 'drop-caches' ? 'primary' : 'danger'}
          details={actionCopy.details}
          loading={running}
          onClose={() => setPending(null)}
          onConfirm={runPending}
        />
      ) : null}

      <ReauthModal open={reauthOpen} onClose={() => setReauthOpen(false)} onSuccess={() => void runPending()} />
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11.5px] font-medium text-(--text-muted)">{label}</div>
      <div className="mt-1 text-base font-semibold text-(--text)">{value}</div>
      <div className="mt-0.5 truncate text-xs text-(--text-muted)">{sub}</div>
    </div>
  )
}

function MemoryBar({ breakdown }: { breakdown: MemoryReport['breakdown'] }) {
  const total = breakdown.totalBytes || 1
  const used = (breakdown.usedBytes / total) * 100
  // Cache that is not already counted as used (available includes reclaimable cache)
  const cache = Math.max(0, Math.min(100 - used, ((breakdown.availableBytes - breakdown.freeBytes) / total) * 100))
  const free = Math.max(0, 100 - used - cache)
  // Colour "used" by pressure: only alarming when little memory is actually available.
  const availablePercent = (breakdown.availableBytes / total) * 100
  const usedColor = availablePercent < 10 ? 'bg-(--red)' : availablePercent < 25 ? 'bg-(--yellow)' : 'bg-(--accent)'
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden border rounded-(--radius) border-(--border)">
        <div className={usedColor} style={{ width: `${used}%` }} title="Used by programs" />
        <div className="bg-(--blue)" style={{ width: `${cache}%` }} title="Reclaimable cache" />
        <div className="bg-(--surface-2)" style={{ width: `${free}%` }} title="Free" />
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-(--text-muted)">
        <Legend color={usedColor} label="Used by programs" />
        <Legend color="bg-(--blue)" label="Reclaimable cache" />
        <Legend color="bg-(--surface-2) border border-(--border)" label="Free" />
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 ${color}`} />
      {label}
    </span>
  )
}

function Diagnosis({
  pressure,
  swapRatio,
  hasSwap,
  oomKills,
}: {
  pressure: number | null
  swapRatio: number
  hasSwap: boolean
  oomKills: string[]
}) {
  const notes: { tone: 'ok' | 'warn' | 'bad'; text: string }[] = []
  if (pressure !== null) {
    if (pressure < 0.1) notes.push({ tone: 'bad', text: 'Less than 10% of memory is available. Restart or stop the largest app below, or add RAM/swap.' })
    else if (pressure < 0.2) notes.push({ tone: 'warn', text: 'Memory is getting tight (under 20% available).' })
    else notes.push({ tone: 'ok', text: 'Memory is healthy. High "cache" is normal: Linux uses spare RAM for cache and gives it back automatically.' })
  }
  if (hasSwap && swapRatio > 0.5) notes.push({ tone: 'warn', text: 'Over half of swap is in use, which slows the server down. Look for a process that keeps growing.' })
  if (!hasSwap && pressure !== null && pressure < 0.2) notes.push({ tone: 'warn', text: 'No swap is configured, so running out of RAM will make the kernel kill processes.' })
  if (oomKills.length) notes.push({ tone: 'bad', text: `The kernel recently killed processes for running out of memory: ${oomKills.at(-1)}` })

  if (!notes.length) return null
  return (
    <div className="space-y-1">
      {notes.map((note) => (
        <p
          key={note.text}
          className={
            note.tone === 'bad' ? 'text-sm text-(--red)' : note.tone === 'warn' ? 'text-sm text-(--yellow)' : 'text-sm text-(--text-muted)'
          }
        >
          {note.text}
        </p>
      ))}
    </div>
  )
}
