'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, Command, HardDrive, Info, LogOut, Search, Server, Settings } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { CommandPalette } from '@/components/dashboard/CommandPalette'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/servers', icon: Server, label: 'Servers' },
  { href: '/scan', icon: Search, label: 'Scan' },
  { href: '/storage', icon: HardDrive, label: 'Storage' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

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

  return (
    <div className="dashboard-shell min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-[220px] shrink-0 border-r border-(--border) fixed top-0 left-0 h-screen z-30">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-(--border)">
          <OptizenMark />
          <span className="text-sm font-semibold text-(--text) tracking-tight">Optizen</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-px p-2 flex-1">
          {NAV.map(({ href, icon: Icon, label }) => {
            const isExternal = href === '/help'
            const active = !isExternal && (pathname === href || pathname.startsWith(href))
            const cls = cn(
              'flex items-center gap-3 px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-(--surface-2) text-(--text)'
                : 'text-(--text-muted) hover:text-(--text) hover:bg-(--surface)'
            )
            return isExternal ? (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={cls}>
                <Icon size={15} />
                {label}
              </a>
            ) : (
              <Link key={href} href={href} className={cls}>
                <Icon size={15} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-(--border) p-2 space-y-px">
          <a
            href="/help"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-(--text-muted) hover:text-(--text) hover:bg-(--surface) transition-colors"
          >
            <BookOpen size={15} />
            Docs
          </a>
          <Link
            href="/about"
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-(--text-muted) hover:text-(--text) hover:bg-(--surface) transition-colors"
          >
            <Info size={15} />
            About
          </Link>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-(--text-muted) hover:text-(--text) hover:bg-(--surface) transition-colors"
          >
            <span className="flex items-center gap-3">
              <Command size={15} />
              Command
            </span>
            <span className="text-[10px] text-(--text-subtle)">⌘K</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-(--text-muted) hover:text-(--red) hover:bg-(--red-dim) transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-(--bg) border-b border-(--border) px-4 py-3">
        <div className="flex items-center gap-2">
          <OptizenMark />
          <span className="text-sm font-semibold text-(--text)">Optizen</span>
        </div>
        <div className="flex items-center gap-1">
          {NAV.map(({ href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'p-2 transition-colors',
                pathname.startsWith(href) ? 'text-(--text)' : 'text-(--text-muted) hover:text-(--text)'
              )}
            >
              <Icon size={16} />
            </Link>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 lg:pl-[220px] lg:pt-0 pt-[53px]">
        {children}
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
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
