'use client'

import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ open, title, description, onClose, children }: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  // Callers usually pass a new onClose on every render. Keep the latest in a ref so the effect
  // below runs only when the modal opens; otherwise it would steal focus on each keystroke.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    // Respect a field inside the dialog that asked for focus (autoFocus); otherwise focus Close.
    if (!dialogRef.current?.contains(document.activeElement)) {
      closeButtonRef.current?.focus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 py-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-full w-full max-w-3xl overflow-auto border border-(--border) bg-(--surface) shadow-(--shadow)"
      >
        <div className="flex items-start justify-between gap-4 border-b border-(--border) px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-(--text)">{title}</h2>
            {description ? (
              <p className="mt-1 max-w-2xl text-xs text-(--text-muted)">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="border border-(--border) px-3 py-1.5 text-xs text-(--text-muted) transition-colors hover:bg-(--surface-2) hover:text-(--text)"
          >
            Close
          </button>
        </div>

        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  )
}
