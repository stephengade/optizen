'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'sm' && 'h-8 px-3 text-xs',
        variant === 'primary' && 'bg-[var(--green)] text-[var(--bg)] hover:opacity-90',
        variant === 'ghost' && 'border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)]',
        variant === 'danger' && 'bg-[var(--red-dim)] text-[var(--red)] border border-[var(--red)] hover:bg-[var(--red)] hover:text-white',
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}
