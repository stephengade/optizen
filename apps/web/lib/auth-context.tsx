'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { isMarketingPath } from '@/lib/site-hosts'

interface AuthState {
  isSetup: boolean
  authenticated: boolean
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (password: string) => Promise<{ success: boolean; error?: string }>
  setup: (password: string, setupCode: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthStatus = { isSetup: boolean; authenticated: boolean }

async function fetchStatus(): Promise<AuthStatus> {
  try {
    return await api.get<AuthStatus>('/auth/status')
  } catch {
    return { isSetup: false, authenticated: false }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // The landing page and docs never need the session, and on the public marketing host the API
  // does not exist. Ask for it only once the visitor reaches a dashboard or auth page; keeping
  // the check out of the server render also lets those pages be pre-built.
  const pathname = usePathname()
  const needsAuth = !isMarketingPath(pathname)
  const [status, setStatus] = useState<AuthStatus | null>(null)

  const refresh = useCallback(async () => {
    setStatus(await fetchStatus())
  }, [])

  useEffect(() => {
    if (!needsAuth || status !== null) return
    let cancelled = false
    void fetchStatus().then((next) => {
      if (!cancelled) setStatus(next)
    })
    return () => {
      cancelled = true
    }
  }, [needsAuth, status])

  const state: AuthState = {
    isSetup: status?.isSetup ?? false,
    authenticated: status?.authenticated ?? false,
    loading: needsAuth && status === null,
  }

  const login = async (password: string) => {
    try {
      await api.post('/auth/login', { password })
      await refresh()
      return { success: true }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed'
      return { success: false, error: message }
    }
  }

  const setup = async (password: string, setupCode: string) => {
    try {
      await api.post('/auth/setup', { password, setupCode })
      await refresh()
      return { success: true }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Setup failed'
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    await refresh()
  }

  return (
    <AuthContext.Provider value={{ ...state, login, setup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
