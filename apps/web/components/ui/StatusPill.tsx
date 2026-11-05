import { cn } from '@/lib/utils'

export type StatusTone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'accent'

const TONES: Record<StatusTone, string> = {
  ok: 'text-(--green) bg-(--green-dim) border-(--green-border)',
  warn: 'text-(--yellow) bg-(--yellow-dim) border-[rgba(245,183,79,0.24)]',
  bad: 'text-(--red) bg-(--red-dim) border-[rgba(242,109,109,0.24)]',
  info: 'text-(--blue) bg-[rgba(96,165,250,0.1)] border-[rgba(96,165,250,0.24)]',
  accent: 'text-(--accent) bg-(--accent-dim) border-(--accent-border)',
  neutral: 'text-(--text-muted) bg-white/[0.03] border-(--border-strong)',
}

/** Rounded status label with an optional glowing dot. */
export function StatusPill({
  tone = 'neutral',
  dot = true,
  pulse = false,
  className,
  title,
  children,
}: {
  tone?: StatusTone
  dot?: boolean
  pulse?: boolean
  className?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[11.5px] font-medium',
        TONES[tone],
        className
      )}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]', pulse && 'animate-pulse')}
        />
      )}
      {children}
    </span>
  )
}
