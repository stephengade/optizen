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
        <label htmlFor={inputId} className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={inputId}
        data-sensitive={sensitive ? 'true' : undefined}
        className={cn(
          'h-10 w-full rounded border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] transition-colors',
          'focus:outline-none focus:border-[var(--green)]',
          error && 'border-[var(--red)] focus:border-[var(--red)] focus:ring-[var(--red)]',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  )
}
