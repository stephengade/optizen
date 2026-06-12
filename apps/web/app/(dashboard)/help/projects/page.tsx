import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const types = [
  {
    label: 'Manual',
    when: 'You created the project in Optizen yourself.',
    notes: 'Deploy commands are fully under your control. Use this when you know exactly what needs to run.',
  },
  {
    label: 'Imported',
    when: 'The project was discovered via server scan.',
    notes: 'Review the suggested metadata carefully before relying on it. Scan results are a starting point, not a source of truth.',
  },
  {
    label: 'Compose',
    when: 'Deploys are driven by docker compose.',
    notes: 'Set the working directory to where your compose file lives on the server. Commands like docker compose pull and docker compose up -d are typical.',
  },
  {
    label: 'Image',
    when: 'Deploys pull or run a container image directly.',
    notes: 'Works best when your image reference is stable and tags are meaningful (not just "latest").',
  },
  {
    label: 'Proxy',
    when: 'The project manages reverse proxy config — Caddy, Nginx, etc.',
    notes: 'Label these explicitly so they are not confused with normal app deploys. They often need special care around reload commands.',
  },
  {
    label: 'Custom',
    when: 'Your workflow does not fit the other categories.',
    notes: 'Full control over all deploy commands. Good for scripts, static sites, or anything non-standard.',
  },
]

export default function ProjectTypesPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/help" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) transition-colors mb-6">
        <ArrowLeft size={12} />
        Docs
      </Link>

      <h1 className="text-xl font-semibold text-(--text)">Project types</h1>
      <p className="mt-1 text-sm text-(--text-muted)">
        Choosing the right type keeps deploy intent clear for everyone on the team.
      </p>

      <div className="mt-8 border border-(--border) divide-y divide-(--border)">
        {types.map((t) => (
          <div key={t.label} className="px-5 py-5">
            <div className="flex items-start gap-4">
              <div className="w-20 shrink-0">
                <span className="text-xs font-medium text-(--text) uppercase tracking-[0.14em]">{t.label}</span>
              </div>
              <div>
                <p className="text-sm text-(--text-muted)"><span className="text-(--text)">Use when:</span> {t.when}</p>
                <p className="mt-1.5 text-sm text-(--text-muted)">{t.notes}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t border-(--border) pt-6 flex items-center justify-between">
        <Link href="/help/setup" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border border-(--border) px-3 py-1.5 transition-colors">
          <ArrowLeft size={11} />
          Quick start
        </Link>
        <Link href="/help/workflows" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border border-(--border) px-3 py-1.5 transition-colors">
          Workflows
          <ArrowLeft size={11} className="rotate-180" />
        </Link>
      </div>
    </div>
  )
}
