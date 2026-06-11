export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[28px] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(104,240,167,0.12),rgba(121,188,255,0.09)_42%,rgba(16,25,24,0.82))] p-8 shadow-[var(--shadow)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-[var(--border)] bg-[rgba(7,16,15,0.4)]">
            <svg width="24" height="24" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L19 6.5V15.5L11 20L3 15.5V6.5L11 2Z" stroke="var(--green)" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M11 7V11M11 11V15M11 11H7M11 11H15" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.24em] text-[var(--green)]">Launchpad</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text)] lg:text-5xl">
            Self-hosted VPS operations without the mystery.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text-muted)]">
            Launchpad gives a small team a clearer operating model for servers, projects, deploys, env files, proxy configs,
            health checks, and runtime observability.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[18px] border border-[var(--border)] bg-[rgba(7,16,15,0.35)] p-4">
              <div className="text-sm font-medium text-[var(--text)]">Trust</div>
              <div className="mt-2 text-sm text-[var(--text-muted)]">Safer writes, confirmations, and visible activity history.</div>
            </div>
            <div className="rounded-[18px] border border-[var(--border)] bg-[rgba(7,16,15,0.35)] p-4">
              <div className="text-sm font-medium text-[var(--text)]">Clarity</div>
              <div className="mt-2 text-sm text-[var(--text-muted)]">Servers, apps, deploys, and infra files stay clearly separated.</div>
            </div>
            <div className="rounded-[18px] border border-[var(--border)] bg-[rgba(7,16,15,0.35)] p-4">
              <div className="text-sm font-medium text-[var(--text)]">Observability</div>
              <div className="mt-2 text-sm text-[var(--text-muted)]">CPU, uptime, load, logs, heartbeats, and recent deploy outcomes.</div>
            </div>
          </div>
        </section>

        <div className="w-full max-w-md justify-self-center">
          {children}
        </div>
      </div>
    </div>
  )
}
