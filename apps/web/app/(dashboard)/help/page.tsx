import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const sections = [
  {
    href: '/help/setup',
    title: 'Quick start',
    description: 'Get from zero to a running deploy in six steps.',
  },
  {
    href: '/help/projects',
    title: 'Project types',
    description: 'Manual, imported, compose, image, proxy, and custom — what each one means.',
  },
  {
    href: '/help/workflows',
    title: 'Workflows',
    description: 'How to deploy, edit env files, read logs, and interpret health checks.',
  },
  {
    href: '/help/security',
    title: 'Trust & security',
    description: 'Session controls, re-auth, demo privacy, and the audit trail.',
  },
]

const model = [
  {
    term: 'Servers',
    copy: 'SSH trust and machine telemetry. If a server record is wrong, everything beneath it is suspect.',
  },
  {
    term: 'Projects',
    copy: 'An application or managed infra unit. Holds deploy commands, runtime type, health settings, and key file paths.',
  },
  {
    term: 'Deploys',
    copy: 'Execution records. When it ran, what happened, whether the service checked in healthy afterward.',
  },
  {
    term: 'Infra files',
    copy: 'Env files, proxy configs, compose definitions. Kept explicit so another operator can understand the system quickly.',
  },
]

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-(--text)">Docs</h1>
        <p className="mt-1 text-sm text-(--text-muted)">
          Understand how Optizen works before you rely on it in production.
        </p>
      </div>

      {/* Sections nav */}
      <div className="grid grid-cols-1 md:grid-cols-2 border border-(--border) divide-y md:divide-y-0 md:divide-x divide-(--border) mb-8">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex flex-col justify-between p-5 hover:bg-(--surface) transition-colors"
          >
            <div>
              <div className="text-sm font-semibold text-(--text)">{s.title}</div>
              <p className="mt-1 text-xs leading-5 text-(--text-muted)">{s.description}</p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs text-(--text-muted) group-hover:text-(--text) transition-colors">
              Read
              <ArrowRight size={11} />
            </div>
          </Link>
        ))}
      </div>

      {/* Core model */}
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-(--text)">The four-layer model</h2>
        <p className="mt-1 text-xs text-(--text-muted)">Optizen organises everything into four distinct layers.</p>
      </div>
      <div className="border border-(--border) divide-y divide-(--border)">
        {model.map((item) => (
          <div key={item.term} className="px-5 py-4 flex gap-6">
            <div className="w-24 shrink-0 text-sm font-medium text-(--text)">{item.term}</div>
            <p className="text-sm text-(--text-muted) leading-5">{item.copy}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
