'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, Command, LogOut, Rocket, Search, Server, Settings, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { CommandPalette } from '@/components/dashboard/CommandPalette'
import { useDemoPrivacy } from '@/lib/demo-privacy-context'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/servers', icon: Server, label: 'Servers' },
  { href: '/scan', icon: Search, label: 'Scan' },
  { href: '/help', icon: BookOpen, label: 'Help' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()
  const { enabled: demoPrivacy, demoMode } = useDemoPrivacy()
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="dashboard-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-3 py-3 lg:flex-row lg:gap-4 lg:px-4 lg:py-4">
        <aside className="glass-panel mb-4 flex flex-col gap-4 rounded-[28px] p-3 lg:mb-0 lg:w-[280px] lg:p-4">
          <div className="flex items-center justify-between gap-3 rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--green-dim)] text-[var(--green)]">
                <Rocket size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Launchpad</div>
                <div className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Phase D</div>
              </div>
            </div>
            <Sparkles size={16} className="text-[var(--yellow)]" />
          </div>

          <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="mt-0.5 text-[var(--green)]" />
              <div>
                <div className="text-sm font-medium text-[var(--text)]">Trust mode</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">
                  {demoMode
                    ? 'Seeded demo mode is active. Launchpad is showing safe sample infrastructure data.'
                    : demoPrivacy
                      ? 'Demo privacy is active. Sensitive values are masked across the dashboard.'
                      : 'Live values are visible. Turn on demo privacy in settings before recording or screen-sharing.'}
                </div>
              </div>
            </div>
          </div>

          <nav className="grid gap-2">
            {NAV.map(({ href, icon: Icon, label }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={cn(
                    'flex items-center justify-between rounded-[18px] border px-4 py-3 text-sm transition-colors',
                    active
                      ? 'border-[var(--green)] bg-[var(--green-dim)] text-[var(--text)]'
                      : 'border-transparent bg-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                  )}
                >
                  <span className="inline-flex items-center gap-3">
                    <Icon size={16} />
                    {label}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {active ? 'Open' : 'Go'}
                  </span>
                </Link>
              )
            })}
          </nav>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center justify-between rounded-[18px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
          >
            <span className="inline-flex items-center gap-3">
              <Command size={16} />
              Quick actions
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em]">Ctrl K</span>
          </button>

          <div className="mt-auto rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="text-sm font-medium text-[var(--text)]">Quick orientation</div>
            <div className="mt-2 space-y-2 text-sm text-[var(--text-muted)]">
              <div>Servers store SSH access and telemetry snapshots.</div>
              <div>Projects define deploy commands, health, and runtime context.</div>
              <div>Help explains classification, setup, and common workflows.</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--red)] hover:bg-[var(--red-dim)] hover:text-[var(--red)]"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="glass-panel min-h-full rounded-[28px] overflow-hidden">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
