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
    const isPublicRoute = pathname === '/' || pathname.startsWith('/help') || pathname.startsWith('/about') || pathname.startsWith('/contribute')

    if (!isSetup) {
      if (!isAuthRoute && !isPublicRoute) router.replace('/setup')
      return
    }

    if (!authenticated) {
      if (!isAuthRoute && !isPublicRoute) router.replace('/login')
      return
    }

    // Already authenticated — redirect away from auth pages
    if (isAuthRoute) {
      router.replace('/servers')
    }
  }, [isSetup, authenticated, loading, pathname, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--bg)">
        <Loader2 size={20} className="animate-spin text-(--text-muted)" />
      </div>
    )
  }

  return <>{children}</>
}
