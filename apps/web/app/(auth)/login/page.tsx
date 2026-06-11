'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password) return

    setError('')
    setLoading(true)

    const result = await login(password)

    if (result.success) {
      router.push('/servers')
    } else {
      setError(result.error ?? 'Login failed')
      setPassword('')
    }

    setLoading(false)
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
      <h1 className="mb-1 text-base font-semibold text-[var(--text)]">Welcome back</h1>
      <p className="mb-6 text-sm text-[var(--text-muted)]">Enter your master password to continue</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="relative">
          <Input
            label="Master password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••••"
            autoFocus
            autoComplete="current-password"
            error={error}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-[2.1rem] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <Button type="submit" loading={loading} disabled={!password}>
          Sign in
        </Button>
      </form>
    </div>
  )
}
