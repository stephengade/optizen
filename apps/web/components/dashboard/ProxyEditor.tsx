'use client'

import { Button } from '@/components/ui/Button'

interface ProxyEditorProps {
  proxyType: 'caddy' | 'nginx' | 'none'
  configPath: string
  configValue: string
  saving?: boolean
  reloading?: boolean
  onChange: (value: string) => void
  onSave: () => void
  onReload: () => void
}

export function ProxyEditor({
  proxyType,
  configPath,
  configValue,
  saving,
  reloading,
  onChange,
  onSave,
  onReload,
}: ProxyEditorProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--green)]">Phase 8</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Proxy editor</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {proxyType === 'none'
              ? 'No reverse proxy detected on this server.'
              : `Editing ${proxyType} config at ${configPath}. Save validates and reloads automatically.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" size="sm" onClick={onReload} disabled={proxyType === 'none'} loading={reloading}>
            Reload proxy
          </Button>
          <Button size="sm" onClick={onSave} disabled={proxyType === 'none'} loading={saving}>
            Save config
          </Button>
        </div>
      </div>

      <textarea
        value={configValue}
        onChange={(event) => onChange(event.target.value)}
        className="mt-5 min-h-[32rem] w-full rounded-xl border border-[var(--border)] bg-[#0b0b0d] px-4 py-3 font-mono text-sm text-[var(--text)] outline-none focus:border-[var(--green)]"
        spellCheck={false}
        disabled={proxyType === 'none'}
      />
    </section>
  )
}
