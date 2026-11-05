'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

interface ConfirmActionModalProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  tone?: 'danger' | 'primary'
  confirmKeyword?: string
  details?: string[]
  loading?: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
}

export function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  confirmKeyword,
  details = [],
  loading = false,
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!open) {
      setValue('')
    }
  }, [open])

  const requiresMatch = Boolean(confirmKeyword)
  const matches = !requiresMatch || value.trim() === confirmKeyword

  return (
    <Modal open={open} title={title} description={description} onClose={onClose}>
      <div className="space-y-4">
        {details.length > 0 ? (
          <div className="border rounded-(--radius) border-(--border) bg-(--surface-2) p-4 text-sm text-(--text-muted)">
            {details.map((detail) => (
              <div key={detail}>{detail}</div>
            ))}
          </div>
        ) : null}
        {requiresMatch ? (
          <Input
            label={`Type ${confirmKeyword} to continue`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={confirmKeyword}
          />
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={() => void onConfirm()} disabled={!matches} loading={loading}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
