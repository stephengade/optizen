'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  isReadOnlySql,
  splitSqlStatements,
  type DatabaseConnection,
  type DatabaseQueryResult,
  type DatabaseTable,
  type Server,
} from '@launchpad/shared'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Download,
  Eye,
  History,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Table2,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { DatabaseForm } from '@/components/databases/DatabaseForm'
import { describeTarget, ENGINES, EngineMark } from '@/components/databases/engine'
import { ResultGrid, toCsv } from '@/components/databases/ResultGrid'
import { SqlEditor } from '@/components/databases/SqlEditor'
import { Button } from '@/components/ui/Button'
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { ReauthModal } from '@/components/ui/ReauthModal'
import { StatusPill } from '@/components/ui/StatusPill'
import { api, ApiError, isReauthRequiredError } from '@/lib/api'
import { cn } from '@/lib/utils'

type TableSummary = DatabaseTable & { rowEstimate?: number }

interface TablePage {
  columns: string[]
  rows: (string | null)[][]
  page: number
  pageSize: number
  total: number
  durationMs: number
}

interface HistoryEntry {
  sql: string
  at: string
  ok: boolean
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const PAGE_SIZES = [25, 50, 100, 250]

function quoteName(engine: DatabaseConnection['engine'], name: string) {
  if (/^[a-z_][a-z0-9_]*$/.test(name)) return name
  return engine === 'mysql' ? `\`${name.replace(/`/g, '``')}\`` : `"${name.replace(/"/g, '""')}"`
}

function tableRef(engine: DatabaseConnection['engine'], table: TableSummary) {
  const name = quoteName(engine, table.name)
  return engine === 'postgres' && table.schema && table.schema !== 'public' ? `${quoteName(engine, table.schema)}.${name}` : name
}

function shortVersion(engine: DatabaseConnection['engine'], version?: string) {
  if (!version) return undefined
  if (engine === 'postgres') return /PostgreSQL [\d.]+/.exec(version)?.[0] ?? version.split(' on ')[0]
  return `${engine === 'mysql' ? (/maria/i.test(version) ? 'MariaDB' : 'MySQL') : 'SQLite'} ${version.split('-')[0]}`
}

export default function DatabaseConsolePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [connection, setConnection] = useState<DatabaseConnection | null>(null)
  const [server, setServer] = useState<Server | null>(null)
  const [servers, setServers] = useState<Server[]>([])
  const [status, setStatus] = useState<{ ok: boolean; version?: string; error?: string } | null>(null)
  const [tables, setTables] = useState<TableSummary[] | null>(null)
  const [tablesError, setTablesError] = useState<string | null>(null)
  const [tablesLoading, setTablesLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [view, setView] = useState<'data' | 'sql'>('data')
  const [active, setActive] = useState<TableSummary | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [sqlSeed, setSqlSeed] = useState<{ sql: string } | null>(null)
  // The SQL tab is created the first time it opens, so its starter query can use the table picked by then.
  const [sqlOpened, setSqlOpened] = useState(false)
  if (view === 'sql' && !sqlOpened) setSqlOpened(true)

  const loadTables = useCallback(async () => {
    setTablesLoading(true)
    setTablesError(null)
    try {
      const list = await api.get<TableSummary[]>(`/databases/${params.id}/tables`)
      setTables(list)
      return list
    } catch (err) {
      setTablesError(err instanceof ApiError ? err.message : 'Could not list tables')
      setTables([])
      return []
    } finally {
      setTablesLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [db, srvs] = await Promise.all([
          api.get<DatabaseConnection>(`/databases/${params.id}`),
          api.get<Server[]>('/servers'),
        ])
        if (cancelled) return
        setConnection(db)
        setServers(srvs)
        setServer(srvs.find((item) => item.id === db.serverId) ?? null)
        void api.post<{ ok: boolean; version?: string; error?: string }>(`/databases/${params.id}/test`).then((result) => {
          if (!cancelled) setStatus(result)
        })
        const list = await loadTables()
        if (!cancelled && list.length) setActive((current) => current ?? list.find((table) => table.kind === 'table') ?? list[0])
        if (!cancelled && !list.length) setView('sql')
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load the database')
        router.push('/databases')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [params.id, loadTables, router])

  const grouped = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const groups = new Map<string, TableSummary[]>()
    for (const table of tables ?? []) {
      if (needle && !table.name.toLowerCase().includes(needle)) continue
      const list = groups.get(table.schema) ?? []
      list.push(table)
      groups.set(table.schema, list)
    }
    return [...groups.entries()]
  }, [tables, filter])

  async function remove() {
    if (!connection) return
    try {
      await api.delete(`/databases/${connection.id}`)
      toast.success(`Removed ${connection.name}`)
      router.push('/databases')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove the database')
    }
  }

  if (!connection) {
    return (
      <div className="px-6 py-8 lg:px-7">
        <LoadingState label="Opening database" detail="Connecting over SSH and reading the schema." />
      </div>
    )
  }

  const tableCount = tables?.filter((table) => table.kind === 'table').length ?? 0
  const viewCount = tables?.filter((table) => table.kind === 'view').length ?? 0

  return (
    <div className="flex h-[calc(100dvh-53px)] flex-col lg:h-[calc(100dvh-56px)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border) px-5 py-3.5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/databases" aria-label="All databases" className="rounded-(--radius-sm) p-1.5 text-(--text-muted) transition-colors hover:bg-white/[0.04] hover:text-(--text)">
            <ArrowLeft size={16} />
          </Link>
          <EngineMark engine={connection.engine} size={34} />
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold tracking-tight text-(--text)">{connection.name}</h1>
            <p className="truncate text-[12.5px] text-(--text-muted)">
              {ENGINES[connection.engine].label} on {server?.name ?? 'server'} · <span className="font-mono">{describeTarget(connection)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === null ? (
            <StatusPill tone="neutral" dot pulse>Connecting</StatusPill>
          ) : status.ok ? (
            <StatusPill tone="ok" dot>{shortVersion(connection.engine, status.version) ?? 'Connected'}</StatusPill>
          ) : (
            <span title={status.error}><StatusPill tone="bad" dot>Can&apos;t connect</StatusPill></span>
          )}
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}><Pencil size={13} />Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setRemoveOpen(true)} aria-label="Remove database"><Trash2 size={13} /></Button>
        </div>
      </div>

      {status && !status.ok && (
        <div className="flex items-start gap-3 border-b border-[rgba(242,109,109,0.25)] bg-(--red-dim) px-6 py-3 text-[13px] text-(--text)">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-(--red)" />
          <div className="min-w-0 whitespace-pre-wrap">{status.error}</div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Tables */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-(--border) bg-(--bg-subtle) md:flex">
          <div className="flex items-center gap-2 border-b border-(--border) p-2.5">
            <label className="flex h-8 flex-1 items-center gap-2 rounded-(--radius-sm) border border-(--border) bg-(--surface) px-2.5 text-(--text-muted) focus-within:border-(--accent)">
              <Search size={13} />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter tables"
                className="w-full bg-transparent text-[12.5px] text-(--text) outline-none placeholder:text-(--text-subtle)"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadTables()}
              aria-label="Refresh tables"
              className="rounded-(--radius-sm) p-1.5 text-(--text-muted) transition-colors hover:bg-white/[0.04] hover:text-(--text)"
            >
              <RefreshCw size={14} className={tablesLoading ? 'animate-spin' : undefined} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-1.5">
            {tables === null ? (
              <div className="space-y-1.5 p-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="h-6 animate-pulse rounded bg-white/[0.04]" style={{ width: `${60 + ((index * 17) % 35)}%` }} />
                ))}
              </div>
            ) : tablesError ? (
              <p className="p-3 text-[12.5px] whitespace-pre-wrap text-(--red)">{tablesError}</p>
            ) : grouped.length === 0 ? (
              <p className="p-3 text-[12.5px] text-(--text-subtle)">{filter ? 'No tables match.' : 'This database has no tables yet.'}</p>
            ) : (
              grouped.map(([schema, list]) => (
                <div key={schema} className="mb-2">
                  {(grouped.length > 1 || (schema && schema !== 'public' && schema !== 'main')) && (
                    <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-(--text-subtle)">{schema}</div>
                  )}
                  {list.map((table) => {
                    const selected = active?.schema === table.schema && active?.name === table.name
                    return (
                      <div key={`${table.schema}.${table.name}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setActive(table)
                            setView('data')
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-(--radius-sm) px-2.5 py-[6px] text-left text-[13px] transition-colors',
                            selected ? 'bg-(--surface-2) text-(--text) shadow-[inset_0_0_0_1px_var(--border)]' : 'text-(--text-muted) hover:bg-white/[0.04] hover:text-(--text)'
                          )}
                        >
                          {table.kind === 'view' ? <Eye size={13} className="shrink-0" /> : <Table2 size={13} className={cn('shrink-0', selected && 'text-(--accent)')} />}
                          <span className="min-w-0 flex-1 truncate">{table.name}</span>
                          {table.rowEstimate !== undefined && table.kind === 'table' && (
                            <span className="font-mono text-[11px] text-(--text-subtle)">{compact.format(table.rowEstimate)}</span>
                          )}
                        </button>
                        {selected && (
                          <ul className="fade-in my-1 ml-[18px] border-l border-(--border) py-0.5 pl-3">
                            {table.columns.map((column) => (
                              <li key={column.name} className="flex items-center justify-between gap-2 py-[3px] text-[12px]">
                                <span className="truncate text-(--text-muted)">{column.name}</span>
                                <span className="shrink-0 truncate font-mono text-[11px] text-(--text-subtle)">{column.type}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
          {tables && tables.length > 0 && (
            <div className="border-t border-(--border) px-4 py-2.5 text-[12px] text-(--text-subtle)">
              {tableCount} table{tableCount === 1 ? '' : 's'}
              {viewCount > 0 && ` · ${viewCount} view${viewCount === 1 ? '' : 's'}`}
            </div>
          )}
        </aside>

        {/* Main */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-(--border) px-3 pt-2">
            <Tab active={view === 'data'} onClick={() => setView('data')} disabled={!active}>
              <Table2 size={14} />
              {active ? active.name : 'Data'}
            </Tab>
            <Tab active={view === 'sql'} onClick={() => setView('sql')}>
              <Code2 size={14} />
              SQL
            </Tab>
            {/* Small screens: pick a table here since the sidebar is hidden */}
            {tables && tables.length > 0 && (
              <select
                value={active ? `${active.schema}.${active.name}` : ''}
                onChange={(event) => {
                  const next = tables.find((table) => `${table.schema}.${table.name}` === event.target.value)
                  if (next) {
                    setActive(next)
                    setView('data')
                  }
                }}
                className="ml-auto mb-1.5 h-7 rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 text-[12px] text-(--text) md:hidden"
              >
                {tables.map((table) => (
                  <option key={`${table.schema}.${table.name}`} value={`${table.schema}.${table.name}`}>{table.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className={cn('min-h-0 flex-1', view === 'data' ? 'flex' : 'hidden')}>
            {active ? (
              <TableBrowser
                key={`${active.schema}.${active.name}`}
                databaseId={connection.id}
                engine={connection.engine}
                table={active}
                onOpenInSql={(sql) => {
                  setSqlSeed({ sql })
                  setView('sql')
                }}
              />
            ) : (
              <div className="grid flex-1 place-items-center text-[13px] text-(--text-subtle)">Pick a table to see its rows.</div>
            )}
          </div>
          <div className={cn('min-h-0 flex-1', view === 'sql' ? 'flex' : 'hidden')}>
            {sqlOpened && <SqlConsole
              databaseId={connection.id}
              seed={sqlSeed}
              defaultSql={active ? `select *\nfrom ${tableRef(connection.engine, active)}\nlimit 100;` : 'select 1;'}
              onSchemaChange={() => void loadTables()}
            />}
          </div>
        </section>
      </div>

      <Modal open={editOpen} title="Edit database" description="Leave the password empty to keep the saved one." onClose={() => setEditOpen(false)}>
        {editOpen && (
          <DatabaseForm
            servers={servers}
            initial={connection}
            onCancel={() => setEditOpen(false)}
            onSaved={(saved) => {
              setConnection(saved)
              setServer(servers.find((item) => item.id === saved.serverId) ?? null)
              setEditOpen(false)
              setStatus(null)
              toast.success('Saved')
              void api.post<{ ok: boolean; version?: string; error?: string }>(`/databases/${saved.id}/test`).then(setStatus)
              void loadTables()
            }}
          />
        )}
      </Modal>

      <ConfirmActionModal
        open={removeOpen}
        title={`Remove ${connection.name}?`}
        description="Optizen forgets this connection and its saved password. The database itself is not touched."
        confirmLabel="Remove"
        onClose={() => setRemoveOpen(false)}
        onConfirm={remove}
      />
    </div>
  )
}

function Tab({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        '-mb-px flex max-w-[260px] items-center gap-2 truncate border-b-2 px-3 pt-1.5 pb-2.5 text-[13px] transition-colors disabled:opacity-40',
        active ? 'border-(--accent) text-(--text)' : 'border-transparent text-(--text-muted) hover:text-(--text)'
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Table data                                                          */
/* ------------------------------------------------------------------ */

function TableBrowser({
  databaseId,
  engine,
  table,
  onOpenInSql,
}: {
  databaseId: string
  engine: DatabaseConnection['engine']
  table: TableSummary
  onOpenInSql: (sql: string) => void
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  // Without an ORDER BY the database may return rows in any order, which makes paging jump around.
  const [sort, setSort] = useState<{ column: string; desc: boolean } | null>(() =>
    table.kind === 'table' && table.columns[0] ? { column: table.columns[0].name, desc: false } : null
  )
  const [nonce, setNonce] = useState(0)
  const [response, setResponse] = useState<{ key: string; data?: TablePage; error?: string } | null>(null)

  const query = useMemo(() => {
    const query = new URLSearchParams({ schema: table.schema, table: table.name, page: String(page), pageSize: String(pageSize) })
    if (sort) {
      query.set('orderBy', sort.column)
      query.set('desc', String(sort.desc))
    }
    return query.toString()
  }, [table.schema, table.name, page, pageSize, sort])
  const requestKey = `${query}#${nonce}`

  useEffect(() => {
    let cancelled = false
    api
      .get<TablePage>(`/databases/${databaseId}/rows?${query}`)
      .then((data) => !cancelled && setResponse({ key: requestKey, data }))
      .catch((err) => !cancelled && setResponse({ key: requestKey, error: err instanceof ApiError ? err.message : 'Could not load rows' }))
    return () => {
      cancelled = true
    }
  }, [databaseId, query, requestKey])

  const loading = response?.key !== requestKey
  // Keep showing the previous page while the next one loads.
  const [lastData, setLastData] = useState<TablePage | null>(null)
  if (response?.data && response.data !== lastData) setLastData(response.data)
  const data = response?.data ?? lastData
  const error = loading ? null : response?.error ?? null
  const load = () => setNonce((value) => value + 1)

  const pages = data ? Math.max(Math.ceil(data.total / pageSize), 1) : 1
  const from = data && data.total ? (page - 1) * pageSize + 1 : 0
  const to = data ? Math.min(page * pageSize, data.total) : 0
  const columns = (data?.columns.length ? data.columns : table.columns.map((column) => column.name)).map((name) => ({
    name,
    type: table.columns.find((column) => column.name === name)?.type,
  }))

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border) px-4 py-2.5">
        <div className="flex items-center gap-3 text-[12.5px] text-(--text-muted)">
          <span className="font-mono text-(--text)">{tableRef(engine, table)}</span>
          <span className="text-(--text-subtle)">·</span>
          <span>{data ? `${data.total.toLocaleString()} row${data.total === 1 ? '' : 's'}` : '…'}</span>
          <span className="text-(--text-subtle)">·</span>
          <span>{table.columns.length} columns</span>
          {data && !loading && <span className="hidden items-center gap-1 text-(--text-subtle) sm:flex"><Clock size={12} />{data.durationMs} ms</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onOpenInSql(
                `select *\nfrom ${tableRef(engine, table)}${sort ? `\norder by ${quoteName(engine, sort.column)}${sort.desc ? ' desc' : ''}` : ''}\nlimit ${pageSize}${page > 1 ? ` offset ${(page - 1) * pageSize}` : ''};`
              )
            }
          >
            <Code2 size={13} />
            Open in SQL
          </Button>
          <Button variant="ghost" size="sm" onClick={load} aria-label="Refresh rows">
            <RefreshCw size={13} className={loading ? 'animate-spin' : undefined} />
          </Button>
        </div>
      </div>

      <div className={cn('relative min-h-0 flex-1 transition-opacity', loading && data && 'opacity-60')}>
        {error ? (
          <div className="m-4 rounded-(--radius) border border-[rgba(242,109,109,0.25)] bg-(--red-dim) p-4 font-mono text-[12.5px] whitespace-pre-wrap text-(--text)">{error}</div>
        ) : !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 10 }, (_, index) => (
              <div key={index} className="h-7 animate-pulse rounded bg-white/[0.03]" />
            ))}
          </div>
        ) : (
          <ResultGrid
            columns={columns}
            rows={data.rows}
            offset={(page - 1) * pageSize}
            sort={sort}
            onSort={(column) => {
              setPage(1)
              setSort((current) => (current?.column === column ? (current.desc ? null : { column, desc: true }) : { column, desc: false }))
            }}
            emptyLabel="This table is empty."
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--border) bg-(--bg-subtle) px-4 py-2 text-[12.5px] text-(--text-muted)">
        <span>{data ? (data.total ? `${from.toLocaleString()}–${to.toLocaleString()} of ${data.total.toLocaleString()}` : 'No rows') : ' '}</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            Rows per page
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
              className="h-7 rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-1.5 text-[12px] text-(--text)"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <PagerButton disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} label="Previous page"><ChevronLeft size={14} /></PagerButton>
            <span className="min-w-[72px] text-center tabular-nums">Page {page} of {pages.toLocaleString()}</span>
            <PagerButton disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)} label="Next page"><ChevronRight size={14} /></PagerButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function PagerButton({ disabled, onClick, label, children }: { disabled: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-(--radius-sm) border border-(--border-strong) text-(--text) transition-colors hover:bg-white/[0.05] disabled:opacity-30"
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* SQL console                                                         */
/* ------------------------------------------------------------------ */

function SqlConsole({
  databaseId,
  seed,
  defaultSql,
  onSchemaChange,
}: {
  databaseId: string
  seed: { sql: string } | null
  defaultSql: string
  onSchemaChange: () => void
}) {
  const historyKey = `optizen.sqlHistory.${databaseId}`
  const [sql, setSql] = useState(defaultSql)
  const [allowWrites, setAllowWrites] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DatabaseQueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultIndex, setResultIndex] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(historyKey) ?? '[]') as HistoryEntry[]
    } catch {
      return []
    }
  })
  const [lastSeed, setLastSeed] = useState(seed)
  if (seed !== lastSeed) {
    setLastSeed(seed)
    if (seed) setSql(seed.sql)
  }
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!historyOpen) return
    function close(event: MouseEvent) {
      if (!historyRef.current?.contains(event.target as Node)) setHistoryOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [historyOpen])

  const writes = sql.trim() !== '' && !isReadOnlySql(sql)

  function remember(entry: HistoryEntry) {
    setHistory((current) => {
      const next = [entry, ...current.filter((item) => item.sql !== entry.sql)].slice(0, 30)
      localStorage.setItem(historyKey, JSON.stringify(next))
      return next
    })
  }

  async function execute() {
    setRunning(true)
    setError(null)
    try {
      const response = await api.post<DatabaseQueryResult>(`/databases/${databaseId}/query`, { sql, allowWrites })
      setResult(response)
      setResultIndex(Math.max(response.results.length - 1, 0))
      remember({ sql, at: new Date().toISOString(), ok: true })
      if (writes) onSchemaChange()
    } catch (err) {
      if (isReauthRequiredError(err)) {
        setReauthOpen(true)
        return
      }
      setResult(null)
      setError(err instanceof ApiError ? err.message : 'Query failed')
      remember({ sql, at: new Date().toISOString(), ok: false })
    } finally {
      setRunning(false)
    }
  }

  function run() {
    if (running || !sql.trim()) return
    if (writes && !allowWrites) {
      setResult(null)
      setError('This query changes data, and the console is read-only. Turn on "Allow writes" to run it.')
      return
    }
    if (writes) {
      setConfirmOpen(true)
      return
    }
    void execute()
  }

  const current = result?.results[resultIndex]
  const statements = writes ? splitSqlStatements(sql) : []

  function download() {
    if (!current) return
    const blob = new Blob([toCsv(current.columns, current.rows)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `query-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border) px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={run} loading={running} disabled={!sql.trim()}>
            <Play size={13} />
            Run
            <kbd className="ml-1 rounded-[4px] bg-white/15 px-1 text-[10.5px] font-normal">Ctrl ↵</kbd>
          </Button>
          <div ref={historyRef} className="relative">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen((open) => !open)} disabled={!history.length}>
              <History size={13} />
              History
            </Button>
            {historyOpen && (
              <div className="fade-in absolute top-full left-0 z-30 mt-1.5 max-h-80 w-[420px] overflow-auto rounded-(--radius) border border-(--border-strong) bg-(--surface) p-1 shadow-(--shadow)">
                {history.map((entry) => (
                  <button
                    key={entry.at}
                    type="button"
                    onClick={() => {
                      setSql(entry.sql)
                      setHistoryOpen(false)
                    }}
                    className="flex w-full items-start gap-2.5 rounded-(--radius-sm) px-2.5 py-2 text-left hover:bg-white/[0.04]"
                  >
                    <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', entry.ok ? 'bg-(--green)' : 'bg-(--red)')} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-mono text-[12px] break-all text-(--text)">{entry.sql}</span>
                      <span className="text-[11px] text-(--text-subtle)">{new Date(entry.at).toLocaleString()}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px] select-none">
          <span className={allowWrites ? 'text-(--yellow)' : 'text-(--text-muted)'}>{allowWrites ? 'Writes allowed' : 'Read-only'}</span>
          <span className="relative inline-flex">
            <input type="checkbox" className="peer sr-only" checked={allowWrites} onChange={(event) => {
                setAllowWrites(event.target.checked)
                setError(null)
              }} />
            <span className="h-[18px] w-8 rounded-full border border-(--border-strong) bg-(--surface-2) transition-colors peer-checked:border-[rgba(245,183,79,0.5)] peer-checked:bg-(--yellow-dim) peer-focus-visible:outline-2 peer-focus-visible:outline-(--accent)" />
            <span className="absolute top-[3px] left-[3px] h-3 w-3 rounded-full bg-(--text-muted) transition-transform peer-checked:translate-x-[14px] peer-checked:bg-(--yellow)" />
          </span>
        </label>
      </div>

      {/* Editor */}
      <div className={cn('flex h-[38%] min-h-[160px] flex-col border-b', allowWrites ? 'border-[rgba(245,183,79,0.35)]' : 'border-(--border)')}>
        <SqlEditor value={sql} onChange={setSql} onRun={run} />
        {writes && (
          <div className={cn('flex items-center gap-2 border-t px-4 py-1.5 text-[12px]', allowWrites ? 'border-[rgba(245,183,79,0.25)] bg-(--yellow-dim) text-(--yellow)' : 'border-(--border) bg-(--bg-subtle) text-(--text-muted)')}>
            <AlertTriangle size={13} />
            {allowWrites ? 'This query changes data. You will be asked to confirm.' : 'This query changes data. Turn on "Allow writes" to run it.'}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex min-h-0 flex-1 flex-col">
        {result && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--border) bg-(--bg-subtle) px-3 py-1.5">
            <div className="flex items-center gap-1 overflow-x-auto">
              {result.results.length > 1 &&
                result.results.map((set, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setResultIndex(index)}
                    className={cn(
                      'rounded-(--radius-sm) px-2.5 py-1 text-[12px] whitespace-nowrap transition-colors',
                      index === resultIndex ? 'bg-(--surface-2) text-(--text) shadow-[inset_0_0_0_1px_var(--border)]' : 'text-(--text-muted) hover:text-(--text)'
                    )}
                  >
                    Result {index + 1} · {set.rowCount.toLocaleString()}
                  </button>
                ))}
              <span className="px-2 text-[12px] text-(--text-muted)">
                {current ? `${current.rowCount.toLocaleString()} row${current.rowCount === 1 ? '' : 's'}${current.truncated ? `, showing the first ${current.rows.length.toLocaleString()}` : ''}` : 'Done'}
                <span className="text-(--text-subtle)"> · {result.durationMs} ms{result.readOnly ? ' · read-only' : ''}</span>
              </span>
            </div>
            {current && current.columns.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(toCsv(current.columns, current.rows))
                    toast.success('Copied as CSV')
                  }}
                >
                  Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={download}><Download size={13} />CSV</Button>
              </div>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1">
          {error ? (
            <div className="m-4 flex gap-3 rounded-(--radius) border border-[rgba(242,109,109,0.25)] bg-(--red-dim) p-4">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-(--red)" />
              <pre className="min-w-0 font-mono text-[12.5px] whitespace-pre-wrap text-(--text)">{error}</pre>
            </div>
          ) : result ? (
            current && current.columns.length ? (
              <ResultGrid columns={current.columns.map((name) => ({ name }))} rows={current.rows} emptyLabel="The query returned no rows." />
            ) : (
              <div className="p-4">
                {(result.messages.length ? result.messages : ['Query ran successfully.']).map((message, index) => (
                  <div key={index} className="flex items-center gap-2 py-1 font-mono text-[12.5px] text-(--text)">
                    <span className="h-1.5 w-1.5 rounded-full bg-(--green)" />
                    {message}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="grid h-full place-items-center p-8 text-center">
              <div>
                <p className="text-[13px] text-(--text-muted)">Run a query to see results here.</p>
                <p className="mt-1 text-[12px] text-(--text-subtle)">Ctrl/⌘ + Enter runs the editor. Results are capped at 1,000 rows.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmActionModal
        open={confirmOpen}
        title="Run a query that changes data?"
        description="This runs with writes allowed, straight against the database. There is no undo unless your SQL wraps it in a transaction you roll back."
        confirmLabel="Run query"
        details={statements.slice(0, 4).map((statement) => (statement.length > 120 ? `${statement.slice(0, 120)}…` : statement)).concat(statements.length > 4 ? [`and ${statements.length - 4} more`] : [])}
        loading={running}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setConfirmOpen(false)
          await execute()
        }}
      />
      <ReauthModal open={reauthOpen} onClose={() => setReauthOpen(false)} onSuccess={() => void execute()} />
    </div>
  )
}
