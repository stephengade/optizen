import { Activity, ShieldCheck, Layers } from 'lucide-react'
import { OptizenLogo } from '@/components/ui/OptizenMark'

const POINTS = [
  { icon: ShieldCheck, title: 'Trust', copy: 'Re-auth before dangerous actions, confirmations, and a full activity history.' },
  { icon: Layers, title: 'Clarity', copy: 'Servers, projects, deploys and infra files, each with a clear boundary.' },
  { icon: Activity, title: 'Observability', copy: 'CPU, uptime, load, logs, heartbeats and deploy outcomes in one place.' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-(--bg)">
      {/* Brand panel */}
      <div className="relative hidden w-[500px] shrink-0 flex-col justify-between overflow-hidden border-r border-(--border) bg-(--bg-subtle) px-12 py-12 lg:flex">
        <div className="hero-glow -top-40" />
        <div className="hero-grid" />
        <OptizenLogo className="relative" />
        <div className="relative">
          <p className="font-mono text-[12.5px] text-(--accent)">{'// Ops + Kaizen'}</p>
          <h1 className="text-gradient mt-4 text-[34px] leading-[1.08] font-semibold tracking-[-0.035em]">
            Self-hosted server operations, without the mystery.
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-(--text-muted)">
            Servers, deploys, env files and health checks, clear and under control.
          </p>
          <div className="mt-10 grid gap-3">
            {POINTS.map(({ icon: Icon, title, copy }) => (
              <div key={title} className="card flex gap-3.5 p-4">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-(--accent-border) bg-(--accent-dim) text-(--accent)">
                  <Icon size={15} />
                </div>
                <div>
                  <div className="text-[13.5px] font-medium text-(--text)">{title}</div>
                  <div className="mt-0.5 text-[13px] leading-relaxed text-(--text-muted)">{copy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-(--text-subtle)">Self-hosted. Your infrastructure.</p>
      </div>

      {/* Form */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-12">
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,rgba(124,131,255,0.08),transparent)]" />
        <div className="relative w-full max-w-[380px]">
          <OptizenLogo className="mb-10 lg:hidden" />
          <div className="rounded-[18px] border border-(--border-strong) bg-(--surface) p-8 shadow-(--shadow)">{children}</div>
        </div>
      </div>
    </div>
  )
}
