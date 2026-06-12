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
        'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--accent) disabled:opacity-40 disabled:cursor-not-allowed',
        size === 'md' && 'h-9 px-4 text-sm',
        size === 'sm' && 'h-7 px-3 text-xs',
        variant === 'primary' && 'bg-(--accent) text-(--bg) hover:opacity-90',
        variant === 'ghost' && 'border border-(--border) text-(--text-muted) hover:text-(--text) hover:border-(--border-strong) hover:bg-(--surface-2)',
        variant === 'danger' && 'border border-(--red) bg-(--red-dim) text-(--red) hover:bg-(--red) hover:text-white',
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  )
}
