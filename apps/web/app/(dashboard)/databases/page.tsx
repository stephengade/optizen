'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { DatabaseConnection, Server } from '@launchpad/shared'
import { ArrowRight, Database, Lock, Plus, ShieldCheck, Table2, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { DatabaseForm } from '@/components/databases/DatabaseForm'
import { describeTarget, ENGINES, EngineMark } from '@/components/databases/engine'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, PageHeader, SectionHeader } from '@/components/ui/Page'
import { api, ApiError } from '@/lib/api'

export default function DatabasesPageRoute() {
  return (
    <Suspense>
      <DatabasesPage />
    </Suspense>
  )
}

function DatabasesPage() {
  const searchParams = useSearchParams()
  const serverFilter = searchParams.get('server') ?? undefined
  const [databases, setDatabases] = useState<DatabaseConnection[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    Promise.all([api.get<DatabaseConnection[]>('/databases'), api.get<Server[]>('/servers')])
      .then(([dbs, srvs]) => {
        setDatabases(dbs)
        setServers(srvs)
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Failed to load databases'))
      .finally(() => setLoading(false))
  }, [])

  const serverName = (id: string) => servers.find((server) => server.id === id)?.name ?? 'Unknown server'
  const visible = serverFilter ? databases.filter((db) => db.serverId === serverFilter) : databases

  return (
    <div className="mx-auto max-w-310 px-6 pt-8 pb-24 lg:px-7">
      <PageHeader
        title="Databases"
        description="Browse tables and run SQL on the databases your servers host, over the same SSH connection."
        actions={
          <Button onClick={() => setFormOpen(true)} disabled={!servers.length}>
            <Plus size={15} />
            Add database
          </Button>
        }
      />

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <Point icon={Lock} title="No open ports" detail="Queries run through SSH with the database's own client. Nothing new listens on the internet." />
        <Point icon={ShieldCheck} title="Read-only by default" detail="The database enforces it. Writes need a switch, a confirmation and, if set, your password." />
        <Point icon={Table2} title="Tables at a glance" detail="Every table and view with its columns and size. Click one to page through its rows." />
      </div>

      <SectionHeader
        title={serverFilter ? `On ${serverName(serverFilter)}` : 'Connections'}
        actions={serverFilter ? <Link href="/databases" className="text-[13px] text-(--accent) hover:underline">Show all</Link> : undefined}
      />

      {loading ? (
        <LoadingState label="Loading databases" compact />
      ) : visible.length ? (
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((db) => (
            <Link
              key={db.id}
              href={`/databases/${db.id}`}
              className="card group flex flex-col p-5 transition-colors hover:border-(--border-strong)"
            >
              <div className="flex items-start gap-3.5">
                <EngineMark engine={db.engine} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold tracking-tight text-(--text)">{db.name}</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-(--text-muted)">{ENGINES[db.engine].label} on {serverName(db.serverId)}</div>
                </div>
                <ArrowRight size={16} className="mt-1 text-(--text-subtle) transition-transform group-hover:translate-x-0.5 group-hover:text-(--text)" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-(--border) pt-4 text-[12px]">
                <Meta label="Database" value={db.engine === 'sqlite' ? db.database?.split('/').pop() : db.database || 'default'} />
                <Meta label="Via" value={describeTarget({ ...db, database: undefined })} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Database}
          title={servers.length ? 'No databases yet' : 'Add a server first'}
          description={
            servers.length
              ? 'Point Optizen at a Postgres, MySQL or SQLite database on one of your servers. It can find running database containers for you.'
              : 'Databases are reached through a server you have connected over SSH.'
          }
          action={
            servers.length ? (
              <Button onClick={() => setFormOpen(true)}><Plus size={15} />Add database</Button>
            ) : (
              <Link href="/servers"><Button><Terminal size={15} />Go to servers</Button></Link>
            )
          }
        />
      )}

      <Modal open={formOpen} title="Add database" description="Optizen keeps the connection details. The password is encrypted with your master password." onClose={() => setFormOpen(false)}>
        {formOpen && (
          <DatabaseForm
            servers={servers}
            defaultServerId={serverFilter}
            onCancel={() => setFormOpen(false)}
            onSaved={(saved) => {
              setDatabases((cur) => [...cur, saved])
              setFormOpen(false)
              toast.success(`Added ${saved.name}`)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function Point({ icon: Icon, title, detail }: { icon: typeof Lock; title: string; detail: string }) {
  return (
    <div className="rounded-(--radius-lg) border border-(--border) bg-(--bg-subtle) p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-(--text)">
        <Icon size={14} className="text-(--accent)" />
        {title}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-(--text-muted)">{detail}</p>
    </div>
  )
}

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-(--text-subtle)">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[12px] text-(--text)">{value || '—'}</div>
    </div>
  )
}
