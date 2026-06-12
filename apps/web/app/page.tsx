import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const features = [
  {
    title: 'Servers',
    copy: 'SSH trust, machine telemetry, and host-level context. The foundation everything else depends on.',
  },
  {
    title: 'Projects',
    copy: 'Deploy contracts — runtime type, commands, health expectations, and file paths in one place.',
  },
  {
    title: 'Deploys',
    copy: 'Execution records with live logs, outcomes, rollback context, and operational history.',
  },
  {
    title: 'Infra files',
    copy: 'Env and proxy edits with previews, backups, revision history, and explicit ownership.',
  },
]

const pillars = [
  {
    label: 'Safer actions',
    copy: 'Re-auth before deploys, deletes, rollbacks, env writes, and proxy reloads.',
  },
  {
    label: 'Clear boundaries',
    copy: 'Servers, projects, deploys, and infra files each own their responsibility layer.',
  },
  {
    label: 'Live state',
    copy: 'Health, heartbeats, load, disk pressure, and recent deploy outcomes always in view.',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-(--bg)">
      {/* Nav */}
      <header className="border-b border-(--border) px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <OptizenMark />
            <span className="text-sm font-semibold text-(--text) tracking-tight">Optizen</span>
          </div>
          <Link
            href="/servers"
            className="inline-flex h-8 items-center gap-2 border border-(--border) px-4 text-xs font-medium text-(--text-muted) transition-colors hover:text-(--text) hover:border-(--border-strong)"
          >
            Open dashboard
            <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">Ops + Kaizen</p>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight text-(--text) lg:text-6xl leading-[1.08]">
          Your VPS fleet,<br />under control.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-(--text-muted)">
          Optizen is a self-hosted control plane for small teams operating servers in production.
          SSH trust, deploy intent, runtime health, and infra changes — all in one place.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/servers"
            className="inline-flex h-9 items-center gap-2 bg-(--accent) px-5 text-sm font-semibold text-(--bg) transition-opacity hover:opacity-90"
          >
            Open dashboard
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/help"
            className="inline-flex h-9 items-center gap-2 border border-(--border) px-5 text-sm text-(--text-muted) transition-colors hover:text-(--text) hover:border-(--border-strong)"
          >
            Read the docs
          </Link>
        </div>
      </section>

      {/* Pillars */}
      <section className="border-t border-(--border)">
        <div className="mx-auto max-w-6xl divide-x divide-(--border) grid grid-cols-1 md:grid-cols-3">
          {pillars.map((item) => (
            <div key={item.label} className="px-8 py-10">
              <div className="text-xs uppercase tracking-[0.2em] text-(--accent)">{item.label}</div>
              <p className="mt-3 text-sm leading-6 text-(--text-muted)">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="border-t border-(--border)">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">The model</p>
          <h2 className="mt-4 text-2xl font-semibold text-(--text)">Four layers, clearly separated</h2>
          <div className="mt-10 grid gap-px bg-(--border) border border-(--border) md:grid-cols-2 xl:grid-cols-4">
            {features.map((item) => (
              <div key={item.title} className="bg-(--bg) p-6">
                <div className="text-sm font-semibold text-(--text)">{item.title}</div>
                <p className="mt-3 text-sm leading-6 text-(--text-muted)">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="border-t border-(--border)">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">Why Optizen</p>
          <h2 className="mt-4 text-2xl font-semibold text-(--text)">Replace SSH rituals with a real operator workflow</h2>
          <div className="mt-10 grid gap-px bg-(--border) border border-(--border) md:grid-cols-2">
            <div className="bg-(--bg) p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-(--red) mb-4">Without structure</div>
              <ul className="space-y-3 text-sm text-(--text-muted)">
                <li className="flex items-start gap-2"><span className="mt-1.5 block h-1 w-1 shrink-0 bg-(--text-subtle)" />Unclear deploy commands and undocumented steps</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 block h-1 w-1 shrink-0 bg-(--text-subtle)" />Env and proxy changes invisible in shell history</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 block h-1 w-1 shrink-0 bg-(--text-subtle)" />Success guessed from container state alone</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 block h-1 w-1 shrink-0 bg-(--text-subtle)" />No audit trail, no backups, no recovery path</li>
              </ul>
            </div>
            <div className="bg-(--surface) p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-(--accent) mb-4">With Optizen</div>
              <ul className="space-y-3 text-sm text-(--text-muted)">
                <li className="flex items-start gap-2"><span className="mt-1.5 block h-1 w-1 shrink-0 bg-(--accent)" />Reviewable deploy intent before execution</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 block h-1 w-1 shrink-0 bg-(--accent)" />Backups and revision history for infra files</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 block h-1 w-1 shrink-0 bg-(--accent)" />Health checks and telemetry next to outcomes</li>
                <li className="flex items-start gap-2"><span className="mt-1.5 block h-1 w-1 shrink-0 bg-(--accent)" />Trust controls on every destructive action</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-(--border)">
        <div className="mx-auto max-w-6xl px-6 py-20 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl font-semibold text-(--text)">Start operating with clarity</h2>
            <p className="mt-3 text-sm text-(--text-muted)">
              Add a server, model your projects, and get real signal on what's running in production.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/servers"
              className="inline-flex h-9 items-center gap-2 bg-(--accent) px-5 text-sm font-semibold text-(--bg) transition-opacity hover:opacity-90"
            >
              Open dashboard
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/help"
              className="inline-flex h-9 items-center border border-(--border) px-5 text-sm text-(--text-muted) transition-colors hover:text-(--text)"
            >
              Read docs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-(--border) px-6 py-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <OptizenMark />
            <span className="text-xs text-(--text-muted)">Optizen</span>
          </div>
          <p className="text-xs text-(--text-subtle)">Self-hosted. Your infrastructure.</p>
        </div>
      </footer>
    </main>
  )
}

function OptizenMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect width="18" height="18" fill="var(--accent)" />
      <path d="M5 9h8M9 5v8" stroke="var(--bg)" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  )
}
