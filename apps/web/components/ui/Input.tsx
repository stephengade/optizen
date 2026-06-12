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
        <label htmlFor={inputId} className="text-xs text-(--text-muted) uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={inputId}
        data-sensitive={sensitive ? 'true' : undefined}
        className={cn(
          'h-9 w-full border bg-(--surface-2) px-3 text-sm text-(--text) placeholder:text-(--text-subtle) transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-(--accent)',
          error
            ? 'border-(--red) focus:ring-(--red)'
            : 'border-(--border) focus:border-(--border-strong)',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-(--red)">{error}</p>}
      {hint && !error && <p className="text-xs text-(--text-muted)">{hint}</p>}
    </div>
  )
}
