'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

interface ReauthModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ReauthModal({ open, onClose, onSuccess }: ReauthModalProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setPassword('')
      setError('')
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await api.post('/auth/reauth', { password })
      toast.success('Session verified for dangerous actions')
      setPassword('')
      onSuccess?.()
      onClose()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Re-authentication failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Re-authenticate"
      description="This workspace requires a fresh password check before high-impact actions like deploys, deletes, or proxy reloads."
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Master password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={error}
          autoComplete="current-password"
        />
        <div className="flex gap-3">
          <Button type="submit" loading={loading} disabled={!password}>
            Verify session
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}
