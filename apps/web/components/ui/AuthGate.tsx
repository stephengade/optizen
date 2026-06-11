'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Loader2 } from 'lucide-react'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSetup, authenticated, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return

    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/setup')

    if (!isSetup) {
      if (!isAuthRoute) router.replace('/setup')
      return
    }

    if (!authenticated) {
      if (!isAuthRoute) router.replace('/login')
      return
    }

    // Already authenticated — redirect away from auth pages
    if (isAuthRoute) {
      router.replace('/servers')
    }
  }, [isSetup, authenticated, loading, pathname, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
      </div>
    )
  }

  return <>{children}</>
}
