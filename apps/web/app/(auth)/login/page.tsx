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
      setError(result.error ?? 'Invalid password')
      setPassword('')
    }

    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-(--text)">Sign in</h1>
      <p className="mt-2 text-sm text-(--text-muted)">
        Enter your master password to unlock Optizen.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
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
            className="absolute right-3 top-[2rem] p-1 text-(--text-muted) transition-colors hover:text-(--text)"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>

        <Button type="submit" loading={loading} disabled={!password} className="w-full">
          Sign in
        </Button>

        <p className="text-xs text-(--text-muted)">
          First time here? Optizen will redirect you to setup automatically.
        </p>
      </form>
    </div>
  )
}
