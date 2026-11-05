'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Loader2 } from 'lucide-react'
import { rememberReturnTo, takeReturnTo } from '@/lib/return-to'
import { isMarketingPath } from '@/lib/site-hosts'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSetup, authenticated, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return

    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/setup')
    const isPublicRoute = isMarketingPath(pathname)

    if (!isSetup) {
      // Fresh install: there is no password to sign in with yet.
      if ((!isAuthRoute && !isPublicRoute) || pathname.startsWith('/login')) router.replace('/setup')
      return
    }

    if (!authenticated) {
      // Already set up: the create-password form can only fail here, so send people to sign in.
      if (pathname.startsWith('/setup')) {
        router.replace('/login')
        return
      }
      if (!isAuthRoute && !isPublicRoute) {
        rememberReturnTo(`${pathname}${window.location.search}`)
        router.replace('/login')
      }
      return
    }

    // Already authenticated — redirect away from auth pages
    if (isAuthRoute) {
      router.replace(takeReturnTo())
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
