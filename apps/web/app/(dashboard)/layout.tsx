'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Server, Settings, LogOut, Rocket } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/servers', icon: Server, label: 'Servers' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Sidebar */}
      <aside className="flex w-14 flex-col items-center border-r border-[var(--border)] bg-[var(--surface)] py-4 gap-1">
        {/* Logo */}
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)]">
          <Rocket size={16} style={{ color: 'var(--green)' }} />
        </div>

        {/* Nav links */}
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                active
                  ? 'bg-[var(--green-dim)] text-[var(--green)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
              )}
            >
              <Icon size={16} />
            </Link>
          )
        })}

        {/* Logout — pinned to bottom */}
        <button
          onClick={handleLogout}
          title="Sign out"
          className="mt-auto flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--red-dim)] hover:text-[var(--red)]"
        >
          <LogOut size={16} />
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
