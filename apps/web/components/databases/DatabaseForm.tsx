'use client'

import { useState } from 'react'
import type { DatabaseAccess, DatabaseConnection, DatabaseConnectionInput, DatabaseEngine, DetectedDatabase, Server } from '@launchpad/shared'
import { Box, Radar, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ENGINES, EngineMark } from './engine'

interface Props {
  servers: Server[]
  initial?: DatabaseConnection
  defaultServerId?: string
  onSaved: (connection: DatabaseConnection) => void
  onCancel: () => void
}

export function DatabaseForm({ servers, initial, defaultServerId, onSaved, onCancel }: Props) {
  const [serverId, setServerId] = useState(initial?.serverId ?? defaultServerId ?? servers[0]?.id ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [engine, setEngine] = useState<DatabaseEngine>(initial?.engine ?? 'postgres')
  const [access, setAccess] = useState<DatabaseAccess>(initial?.access ?? 'docker')
  const [container, setContainer] = useState(initial?.container ?? '')
  const [host, setHost] = useState(initial?.host ?? '')
  const [port, setPort] = useState(initial?.port ? String(initial.port) : '')
  const [user, setUser] = useState(initial?.user ?? '')
  const [password, setPassword] = useState('')
  const [clearPassword, setClearPassword] = useState(false)
  const [database, setDatabase] = useState(initial?.database ?? '')
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected] = useState<DetectedDatabase[] | null>(null)

  async function detect() {
    if (!serverId) return
    setDetecting(true)
    try {
      const found = await api.get<DetectedDatabase[]>(`/servers/${serverId}/databases/detect`)
      setDetected(found)
      if (!found.length) toast.message('No Postgres or MySQL containers are running on this server.')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not look for databases')
    } finally {
      setDetecting(false)
    }
  }

  function applyDetected(item: DetectedDatabase) {
    setEngine(item.engine)
    setAccess('docker')
    setContainer(item.container)
    setUser(item.user ?? '')
    setDatabase(item.database ?? '')
    setHost('')
    setPort('')
    if (!name) setName(item.database && item.database !== 'postgres' ? item.database : item.container)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    const payload: DatabaseConnectionInput = {
      serverId,
      name: name.trim(),
      engine,
      access,
      container: access === 'docker' ? container.trim() : undefined,
      host: engine !== 'sqlite' ? host.trim() || undefined : undefined,
      port: engine !== 'sqlite' && port ? Number(port) : undefined,
      user: engine !== 'sqlite' ? user.trim() || undefined : undefined,
      password: password || undefined,
      clearPassword: clearPassword || undefined,
      database: database.trim() || undefined,
    }
    try {
      const saved = initial
        ? await api.put<DatabaseConnection>(`/databases/${initial.id}`, payload)
        : await api.post<DatabaseConnection>('/databases', payload)
      onSaved(saved)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the database')
    } finally {
      setSaving(false)
    }
  }

  const isSqlite = engine === 'sqlite'

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Server + detect */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="db-server" className="text-[13px] font-medium text-(--text-muted)">Server</label>
          <select
            id="db-server"
            value={serverId}
            onChange={(event) => {
              setServerId(event.target.value)
              setDetected(null)
            }}
            className="h-10 rounded-(--radius-sm) border border-(--border-strong) bg-(--bg-subtle) px-3 text-sm text-(--text) focus:border-(--accent) focus:ring-3 focus:ring-(--accent-dim) focus:outline-none"
          >
            {servers.map((server) => (
              <option key={server.id} value={server.id}>{server.name} · {server.host}</option>
            ))}
          </select>
        </div>
        <Button type="button" variant="ghost" onClick={() => void detect()} loading={detecting} disabled={!serverId}>
          <Radar size={15} />
          Find databases
        </Button>
      </div>

      {detected && detected.length > 0 && (
        <div className="fade-in rounded-(--radius) border border-(--accent-border) bg-[linear-gradient(180deg,var(--accent-dim),transparent)] p-3">
          <p className="px-1 pb-2.5 text-[12.5px] text-(--text-muted)">Running on this server. Pick one to fill in the form; you still enter the password yourself.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {detected.map((item) => (
              <button
                key={item.container}
                type="button"
                onClick={() => applyDetected(item)}
                className={cn(
                  'flex items-center gap-3 rounded-(--radius-sm) border bg-(--surface) px-3 py-2.5 text-left transition-colors hover:border-(--border-strong)',
                  container === item.container ? 'border-(--accent)' : 'border-(--border)'
                )}
              >
                <EngineMark engine={item.engine} size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-(--text)">{item.container}</span>
                  <span className="block truncate font-mono text-[11.5px] text-(--text-subtle)">{item.image}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Engine */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-(--text-muted)">Engine</span>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(ENGINES) as DatabaseEngine[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setEngine(key)}
              className={cn(
                'flex items-center gap-2.5 rounded-(--radius-sm) border px-3 py-2.5 text-left text-[13px] transition-colors',
                engine === key ? 'border-(--accent) bg-(--accent-dim) text-(--text)' : 'border-(--border-strong) text-(--text-muted) hover:text-(--text)'
              )}
            >
              <EngineMark engine={key} size={24} />
              {ENGINES[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Access */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-(--text-muted)">Reach it through</span>
        <div className="grid gap-2 sm:grid-cols-2">
          <AccessOption active={access === 'docker'} onClick={() => setAccess('docker')} icon={<Box size={15} />} title="Docker container" detail={`Runs ${isSqlite ? 'sqlite3' : engine === 'mysql' ? 'mysql' : 'psql'} inside the container`} />
          <AccessOption active={access === 'host'} onClick={() => setAccess('host')} icon={<Terminal size={15} />} title="The server itself" detail={`Uses the ${isSqlite ? 'sqlite3' : engine === 'mysql' ? 'mysql' : 'psql'} client installed on the host`} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Shop production" required maxLength={80} />
        {access === 'docker' && (
          <Input label="Container" value={container} onChange={(event) => setContainer(event.target.value)} placeholder="postgres" required className="font-mono" />
        )}
        {isSqlite ? (
          <div className="sm:col-span-2">
            <Input label="Database file" value={database} onChange={(event) => setDatabase(event.target.value)} placeholder="/srv/app/data/app.db" required className="font-mono" hint="Absolute path on the server, or inside the container." />
          </div>
        ) : (
          <>
            <Input label="Database" value={database} onChange={(event) => setDatabase(event.target.value)} placeholder={engine === 'postgres' ? 'postgres' : 'app'} className="font-mono" />
            <Input label="User" value={user} onChange={(event) => setUser(event.target.value)} placeholder={engine === 'postgres' ? 'postgres' : 'root'} className="font-mono" />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={initial?.hasPassword ? 'Saved. Leave empty to keep it.' : 'Optional'}
              autoComplete="new-password"
              sensitive
              hint="Encrypted with your master password."
            />
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Input label="Host" value={host} onChange={(event) => setHost(event.target.value)} placeholder={access === 'docker' ? 'Local socket' : '127.0.0.1'} className="font-mono" />
              <Input label="Port" value={port} onChange={(event) => setPort(event.target.value.replace(/\D/g, ''))} placeholder={String(ENGINES[engine].defaultPort ?? '')} className="font-mono" />
            </div>
          </>
        )}
      </div>

      {initial?.hasPassword && !isSqlite && (
        <label className="flex items-center gap-2 text-[13px] text-(--text-muted)">
          <input type="checkbox" checked={clearPassword} onChange={(event) => setClearPassword(event.target.checked)} />
          Remove the saved password
        </label>
      )}

      <div className="flex justify-end gap-2 border-t border-(--border) pt-5">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving} disabled={!serverId}>{initial ? 'Save changes' : 'Add database'}</Button>
      </div>
    </form>
  )
}

function AccessOption({ active, onClick, icon, title, detail }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; detail: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-(--radius-sm) border px-3.5 py-3 text-left transition-colors',
        active ? 'border-(--accent) bg-(--accent-dim)' : 'border-(--border-strong) hover:border-white/20'
      )}
    >
      <span className={cn('mt-0.5', active ? 'text-(--accent)' : 'text-(--text-muted)')}>{icon}</span>
      <span>
        <span className="block text-[13px] font-medium text-(--text)">{title}</span>
        <span className="block text-[12px] text-(--text-subtle)">{detail}</span>
      </span>
    </button>
  )
}
