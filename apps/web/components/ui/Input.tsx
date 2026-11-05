'use client'

import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  sensitive?: boolean
}

export function Input({ label, error, hint, className, id, sensitive = false, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-medium text-(--text-muted)">
          {label}
        </label>
      )}
      <input
        id={inputId}
        data-sensitive={sensitive ? 'true' : undefined}
        className={cn(
          'h-10 w-full rounded-(--radius-sm) border bg-(--bg-subtle) px-3 text-sm text-(--text) placeholder:text-(--text-subtle) transition-colors',
          'focus:outline-none focus:border-(--accent) focus:ring-3 focus:ring-(--accent-dim)',
          error
            ? 'border-(--red) focus:ring-(--red)'
            : 'border-(--border-strong) hover:border-white/20',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-(--red)">{error}</p>}
      {hint && !error && <p className="text-xs text-(--text-muted)">{hint}</p>}
    </div>
  )
}
