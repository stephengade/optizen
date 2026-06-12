export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-(--bg) flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 border-r border-(--border) px-12 py-12">
        <div className="flex items-center gap-2">
          <OptizenMark />
          <span className="text-sm font-semibold text-(--text) tracking-tight">Optizen</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">Ops + Kaizen</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-(--text) leading-tight">
            Self-hosted VPS operations without the mystery.
          </h1>
          <p className="mt-4 text-sm leading-6 text-(--text-muted)">
            Servers, deploys, env files, and health checks — clear and under control.
          </p>
          <div className="mt-10 space-y-px border border-(--border)">
            <div className="px-4 py-4 bg-(--surface)">
              <div className="text-xs font-medium text-(--text)">Trust</div>
              <div className="mt-1 text-xs text-(--text-muted)">Re-auth before dangerous actions, confirmations, and full activity history.</div>
            </div>
            <div className="px-4 py-4 bg-(--surface)">
              <div className="text-xs font-medium text-(--text)">Clarity</div>
              <div className="mt-1 text-xs text-(--text-muted)">Servers, projects, deploys, and infra files — each layer owns its boundary.</div>
            </div>
            <div className="px-4 py-4 bg-(--surface)">
              <div className="text-xs font-medium text-(--text)">Observability</div>
              <div className="mt-1 text-xs text-(--text-muted)">CPU, uptime, load, logs, heartbeats, and deploy outcomes in one place.</div>
            </div>
          </div>
        </div>
        <p className="text-xs text-(--text-subtle)">Self-hosted. Your infrastructure.</p>
      </div>

      {/* Right — form area */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <OptizenMark />
            <span className="text-sm font-semibold text-(--text)">Optizen</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

function OptizenMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect width="16" height="16" fill="var(--accent)" />
      <path d="M4 8h8M8 4v8" stroke="var(--bg)" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  )
}
