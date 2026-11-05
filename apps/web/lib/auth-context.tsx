'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, ApiError } from '@/lib/api'

interface AuthState {
  isSetup: boolean
  authenticated: boolean
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (password: string) => Promise<{ success: boolean; error?: string }>
  setup: (password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** `disabled`: public marketing host, where the API does not exist — skip the status call. */
export function AuthProvider({ children, disabled = false }: { children: React.ReactNode; disabled?: boolean }) {
  const [state, setState] = useState<AuthState>({
    isSetup: false,
    authenticated: false,
    loading: !disabled,
  })

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ isSetup: boolean; authenticated: boolean }>('/auth/status')
      setState({ ...data, loading: false })
    } catch {
      setState({ isSetup: false, authenticated: false, loading: false })
    }
  }, [])

  useEffect(() => {
    if (!disabled) void refresh()
  }, [disabled, refresh])

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

  const setup = async (password: string) => {
    try {
      await api.post('/auth/setup', { password })
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
