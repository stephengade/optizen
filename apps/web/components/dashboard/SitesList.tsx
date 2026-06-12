'use client'

import { Button } from '@/components/ui/Button'

interface SiteItem {
  name: string
  enabled: boolean
}

interface SitesListProps {
  sites: SiteItem[]
  togglingSite?: string | null
  onToggle: (site: SiteItem) => void
}

export function SitesList({ sites, togglingSite, onToggle }: SitesListProps) {
  return (
    <section className="rounded-2xl border border-(--border) bg-(--surface) p-6">
      <h2 className="text-lg font-semibold text-(--text)">Nginx sites</h2>
      <p className="mt-1 text-sm text-(--text-muted)">
        Enable or disable files from `/etc/nginx/sites-available`.
      </p>

      {sites.length > 0 ? (
        <div className="mt-5 space-y-3">
          {sites.map((site) => (
            <div
              key={site.name}
              className="flex flex-wrap items-center justify-between gap-3  border border-(--border) bg-(--surface-2) px-4 py-3"
            >
              <div>
                <div className="font-mono text-sm text-(--text)">{site.name}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-(--text-muted)">
                  {site.enabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onToggle(site)}
                loading={togglingSite === site.name}
              >
                {site.enabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5  border border-dashed border-(--border) bg-(--surface-2) p-4 text-sm text-(--text-muted)">
          No sites available.
        </div>
      )}
    </section>
  )
}
