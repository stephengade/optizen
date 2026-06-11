'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'

interface ProxyEditorProps {
  proxyType: 'caddy' | 'nginx' | 'none'
  configPath: string
  editable?: boolean
  error?: string
  configValue: string
  saving?: boolean
  reloading?: boolean
  onPathChange: (value: string) => void
  onLoadPath: () => void
  onChange: (value: string) => void
  onSave: () => void
  onReload: () => void
}

export function ProxyEditor({
  proxyType,
  configPath,
  editable = true,
  error,
  configValue,
  saving,
  reloading,
  onPathChange,
  onLoadPath,
  onChange,
  onSave,
  onReload,
}: ProxyEditorProps) {
  const hasPath = configPath.trim().length > 0
  const canSave = editable && hasPath
  const canReload = proxyType !== 'none'
  const stats = useMemo(() => {
    const lines = configValue.split('\n')
    return {
      lineCount: configValue ? lines.length : 0,
      nonEmpty: lines.filter((line) => line.trim()).length,
    }
  }, [configValue])

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--green)]">Phase 8</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Proxy editor</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {!hasPath && proxyType === 'none'
              ? 'No reverse proxy detected on this server.'
              : proxyType === 'none'
                ? `Editing custom config at ${configPath}. Save writes the file, but host-level validation and reload are unavailable.`
                : `Editing ${proxyType} config at ${configPath}. Save validates and reloads automatically.`}
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            If your live rules are in another file, paste the full path here and click Load path. This also works for
            include files and site-specific configs.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" size="sm" onClick={onLoadPath}>
            Load path
          </Button>
          <Button variant="ghost" size="sm" onClick={onReload} disabled={!canReload} loading={reloading}>
            Reload proxy
          </Button>
          <Button size="sm" onClick={onSave} disabled={!canSave} loading={saving}>
            Save config
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Config path</span>
          <input
            value={configPath}
            onChange={(event) => onPathChange(event.target.value)}
            className="h-10 border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--green)]"
            placeholder={proxyType === 'caddy' ? '/etc/caddy/Caddyfile' : '/etc/nginx/nginx.conf'}
          />
        </label>
      </div>

      {error ? (
        <div className="mt-5 border border-[var(--yellow)] bg-[color:rgba(255,184,63,0.08)] px-4 py-3 text-sm text-[var(--yellow)]">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
        <textarea
          value={configValue}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[32rem] w-full rounded-xl border border-[var(--border)] bg-[#0b0b0d] px-4 py-3 font-mono text-sm text-[var(--text)] outline-none focus:border-[var(--green)]"
          spellCheck={false}
          disabled={!editable}
        />

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <h3 className="text-sm font-medium text-[var(--text)]">Write safety</h3>
            <div className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <div>Temp validation: {proxyType === 'none' ? 'Skipped' : 'Before overwrite'}</div>
              <div>Remote backup: Created before replace</div>
              <div>Local revision: Saved in Launchpad history</div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <h3 className="text-sm font-medium text-[var(--text)]">File stats</h3>
            <div className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <div>Lines: {stats.lineCount}</div>
              <div>Non-empty lines: {stats.nonEmpty}</div>
              <div>Reload path: {canReload ? 'Available' : 'Manual only'}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
