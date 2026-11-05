'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

function getStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 12) score++
  if (password.length >= 16) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Weak', color: 'var(--red)' }
  if (score <= 3) return { score, label: 'Fair', color: 'var(--yellow)' }
  return { score, label: 'Strong', color: 'var(--accent)' }
}

export default function SetupPage() {
  const { setup } = useAuth()
  const router = useRouter()

  const [setupCode, setSetupCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const strength = getStrength(password)
  const mismatch = confirm.length > 0 && password !== confirm

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!setupCode.trim()) { setError('Enter the setup code from the server log'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 12) { setError('Password must be at least 12 characters'); return }

    setError('')
    setLoading(true)

    const result = await setup(password, setupCode)

    if (result.success) {
      router.push('/servers')
    } else {
      setError(result.error ?? 'Setup failed')
    }

    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-(--text)">Create master password</h1>
      <p className="mt-2 text-sm text-(--text-muted)">
        This encrypts all your server credentials. It cannot be recovered if lost.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <Input
          label="Setup code"
          value={setupCode}
          onChange={e => setSetupCode(e.target.value)}
          placeholder="XXXX-XXXX-XXXX"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="font-mono uppercase"
          hint="Printed in the server log when Optizen starts. Docker: docker compose logs server"
        />

        {/* Password field */}
        <div className="relative">
          <Input
            label="Master password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 12 characters"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-[2rem] p-1 text-(--text-muted) transition-colors hover:text-(--text)"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {/* Strength bar */}
        {password.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="h-1 flex-1 transition-all"
                  style={{
                    background: i <= strength.score ? strength.color : 'var(--border)',
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-medium" style={{ color: strength.color }}>
              {strength.label}
            </span>
          </div>
        )}

        {/* Confirm field */}
        <Input
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          error={mismatch ? 'Passwords do not match' : error}
        />

        {/* Requirements */}
        <ul className="space-y-1">
          {[
            { met: password.length >= 12, label: 'At least 12 characters' },
            { met: /[A-Z]/.test(password), label: 'One uppercase letter' },
            { met: /[0-9]/.test(password), label: 'One number' },
          ].map(req => (
            <li key={req.label} className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              req.met ? 'text-(--accent)' : 'text-(--text-muted)'
            )}>
              <span>{req.met ? '✓' : '○'}</span>
              {req.label}
            </li>
          ))}
        </ul>

        <Button
          type="submit"
          loading={loading}
          disabled={!setupCode.trim() || password.length < 12 || mismatch || password !== confirm}
          className="w-full mt-1"
        >
          Set up Optizen
        </Button>

        <p className="text-xs text-(--text-muted)">
          Use a password manager. Store it alongside the machine that hosts Optizen.
        </p>
      </form>
    </div>
  )
}
