'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

interface DemoPrivacyContextValue {
  enabled: boolean
  setEnabled: (value: boolean) => void
  mask: (value: string, fallback?: string) => string
}

const DemoPrivacyContext = createContext<DemoPrivacyContextValue | null>(null)
const STORAGE_KEY = 'launchpad.demoPrivacy'

export function DemoPrivacyProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    try {
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === 'true')
    } catch {
      setEnabled(false)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.demoPrivacy = enabled ? 'on' : 'off'
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
    } catch {
      // Ignore storage access failures.
    }
  }, [enabled])

  const value = useMemo<DemoPrivacyContextValue>(
    () => ({
      enabled,
      setEnabled,
      mask: (input: string, fallback = 'hidden') => {
        if (!enabled) return input
        const value = input?.trim() ? input : fallback
        const visible = Math.min(3, value.length)
        return `${'•'.repeat(Math.max(6, value.length - visible))}${value.slice(-visible)}`
      },
    }),
    [enabled]
  )

  return <DemoPrivacyContext.Provider value={value}>{children}</DemoPrivacyContext.Provider>
}

export function useDemoPrivacy() {
  const context = useContext(DemoPrivacyContext)
  if (!context) throw new Error('useDemoPrivacy must be used within DemoPrivacyProvider')
  return context
}
