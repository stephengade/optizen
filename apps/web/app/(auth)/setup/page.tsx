'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
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
  return { score, label: 'Strong', color: 'var(--green)' }
}

export default function SetupPage() {
  const { setup } = useAuth()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const strength = getStrength(password)
  const mismatch = confirm.length > 0 && password !== confirm

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 12) { setError('Password must be at least 12 characters'); return }

    setError('')
    setLoading(true)

    const result = await setup(password)

    if (result.success) {
      router.push('/servers')
    } else {
      setError(result.error ?? 'Setup failed')
    }

    setLoading(false)
  }

  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--green-dim)] text-[var(--green)]">
          <ShieldCheck size={18} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Create master password</h1>
          <p className="mt-0.5 text-sm leading-6 text-[var(--text-muted)]">
            This encrypts all your server credentials. It cannot be recovered if lost.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Password field */}
        <div className="relative">
          <Input
            label="Master password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 12 characters"
            autoFocus
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-[2.1rem] rounded-[10px] p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
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
                  className="h-1 flex-1 rounded-full transition-all"
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
              req.met ? 'text-[var(--green)]' : 'text-[var(--text-muted)]'
            )}>
              <span>{req.met ? '✓' : '○'}</span>
              {req.label}
            </li>
          ))}
        </ul>

        <Button
          type="submit"
          loading={loading}
          disabled={password.length < 12 || mismatch || password !== confirm}
          className="mt-1"
        >
          Set up Launchpad
        </Button>

        <p className="text-xs leading-5 text-[var(--text-muted)]">
          Recommended: use a password manager and store this alongside the machine that hosts Launchpad.
        </p>
      </form>
    </div>
  )
}
