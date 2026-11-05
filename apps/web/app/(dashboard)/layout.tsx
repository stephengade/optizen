'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, HardDrive, Info, LogOut, ScanSearch, Search, Server, Settings } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { CommandPalette } from '@/components/dashboard/CommandPalette'
import { OptizenLogo } from '@/components/ui/OptizenMark'
import { PageTransition } from '@/components/ui/PageTransition'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/servers', icon: Server, label: 'Servers' },
  { href: '/scan', icon: ScanSearch, label: 'Scan' },
  { href: '/storage', icon: HardDrive, label: 'Storage' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

const SECTION_LABELS: Record<string, string> = {
  servers: 'Servers',
  scan: 'Scan',
  storage: 'Storage',
  settings: 'Settings',
  projects: 'Projects',
  backups: 'Backups',
  memory: 'Memory',
  proxy: 'Proxy',
  env: 'Environment',
}

const RECORD_LABELS: Record<string, string> = { servers: 'Server', projects: 'Project' }

/** Breadcrumb from the URL. A record id is named after its parent section, not shown raw. */
function crumbs(pathname: string): string[] {
  const parts = pathname.split('/').filter(Boolean)
  return parts.map((part, i) => SECTION_LABELS[part] ?? RECORD_LABELS[parts[i - 1]] ?? 'Details')
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()
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

  const trail = crumbs(pathname)

  return (
    <div className="dashboard-shell flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 z-30 hidden h-screen w-60 shrink-0 flex-col border-r border-(--border) bg-(--bg-subtle) px-2.5 py-3.5 lg:flex">
        <Link href="/servers" className="px-2 pb-4">
          <OptizenLogo />
        </Link>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mx-1 mb-3.5 flex items-center justify-between rounded-(--radius-sm) border border-(--border) bg-(--surface) px-2.5 py-2 text-[12.5px] text-(--text-muted) transition-colors hover:border-(--border-strong) hover:text-(--text)"
        >
          <span className="flex items-center gap-2">
            <Search size={14} />
            Search or jump to…
          </span>
          <kbd className="rounded-[5px] border border-(--border-strong) px-1.5 text-[11px] text-(--text-subtle)">⌘K</kbd>
        </button>

        <NavGroup>Workspace</NavGroup>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, icon, label }) => (
            <NavLink key={href} href={href} icon={icon} active={pathname === href || pathname.startsWith(`${href}/`)}>
              {label}
            </NavLink>
          ))}
        </nav>

        <NavGroup>Resources</NavGroup>
        <div className="flex flex-col gap-0.5">
          <NavLink href="/help" icon={BookOpen} external>Docs</NavLink>
          <NavLink href="/about" icon={Info}>About</NavLink>
        </div>

        <div className="mt-auto border-t border-(--border) pt-2.5">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-(--radius-sm) px-2.5 py-[7px] text-[13.5px] text-(--text-muted) transition-colors hover:bg-(--red-dim) hover:text-(--red)"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="glass fixed top-0 right-0 left-0 z-40 flex items-center justify-between border-b border-(--border) px-4 py-2.5 lg:hidden">
        <OptizenLogo size={22} />
        <div className="flex items-center gap-0.5">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn(
                'rounded-(--radius-sm) p-2 transition-colors',
                pathname.startsWith(href) ? 'bg-(--surface-2) text-(--text)' : 'text-(--text-muted) hover:text-(--text)'
              )}
            >
              <Icon size={16} />
            </Link>
          ))}
          <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Search" className="rounded-(--radius-sm) p-2 text-(--text-muted) hover:text-(--text)">
            <Search size={16} />
          </button>
        </div>
      </div>

      {/* Main */}
      <main className="min-w-0 flex-1 pt-[53px] lg:pt-0 lg:pl-60">
        <div className="glass sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-(--border) px-7 text-[13px] text-(--text-muted) lg:flex">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2">
            <span>Workspace</span>
            {trail.map((label, i) => (
              <span key={`${label}-${i}`} className="flex items-center gap-2">
                <span className="text-(--text-subtle)">/</span>
                <span className={i === trail.length - 1 ? 'font-medium text-(--text)' : undefined}>{label}</span>
              </span>
            ))}
          </nav>
          <a href="/help" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 transition-colors hover:text-(--text)">
            <BookOpen size={14} />
            Docs
          </a>
        </div>
        <PageTransition>{children}</PageTransition>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

function NavGroup({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pt-3 pb-1.5 text-[11px] font-medium text-(--text-subtle)">{children}</div>
}

function NavLink({
  href,
  icon: Icon,
  active,
  external,
  children,
}: {
  href: string
  icon: typeof Server
  active?: boolean
  external?: boolean
  children: React.ReactNode
}) {
  const cls = cn(
    'flex items-center gap-2.5 rounded-(--radius-sm) px-2.5 py-[7px] text-[13.5px] transition-colors',
    active
      ? 'bg-(--surface-2) text-(--text) shadow-[inset_0_0_0_1px_var(--border)]'
      : 'text-(--text-muted) hover:bg-white/[0.04] hover:text-(--text)'
  )
  const icon = <Icon size={15} className={active ? 'text-(--accent)' : undefined} />
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{icon}{children}</a>
  ) : (
    <Link href={href} className={cls}>{icon}{children}</Link>
  )
}
