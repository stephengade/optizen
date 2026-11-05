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
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-(--radius-sm) border border-transparent font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        size === 'md' && 'h-9 px-4 text-[13.5px]',
        size === 'sm' && 'h-[30px] px-3 text-[12.5px] gap-1.5',
        variant === 'primary' && 'btn-primary',
        variant === 'ghost' && 'border-(--border-strong) bg-white/[0.03] text-(--text) hover:bg-white/[0.06]',
        variant === 'danger' && 'border-[rgba(242,109,109,0.3)] bg-(--red-dim) text-(--red) hover:bg-(--red) hover:text-white',
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  )
}
