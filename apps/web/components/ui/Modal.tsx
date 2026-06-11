'use client'

import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ open, title, description, onClose, children }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-8">
      <div className="max-h-full w-full max-w-3xl overflow-auto border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
            {description ? (
              <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>

        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  )
}
