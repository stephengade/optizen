import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Page title row with optional description and right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-(--text)">{title}</h1>
        {description && <p className="mt-1 text-sm text-(--text-muted)">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionHeader({ title, actions, className }: { title: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mt-9 mb-3.5 flex items-center justify-between gap-3', className)}>
      <h2 className="text-[15px] font-semibold tracking-tight text-(--text)">{title}</h2>
      {actions}
    </div>
  )
}

export function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  note?: React.ReactNode
  tone?: 'good' | 'warn'
}) {
  return (
    <div className="rounded-(--radius-lg) border border-(--border) bg-(--surface) px-4.5 pt-4.5 pb-4">
      <div className="flex items-center gap-2 text-[12.5px] text-(--text-muted)">
        <Icon size={14} />
        {label}
      </div>
      <div className="mt-2.5 text-[26px] leading-none font-semibold tracking-[-0.03em] text-(--text) tabular-nums">{value}</div>
      {note && (
        <div
          className={cn(
            'mt-2 truncate text-xs',
            tone === 'good' ? 'text-(--green)' : tone === 'warn' ? 'text-(--yellow)' : 'text-(--text-subtle)'
          )}
        >
          {note}
        </div>
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-(--radius-lg) border border-dashed border-(--border-strong) px-6 py-14 text-center', className)}>
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-(--accent-border) bg-(--accent-dim) text-(--accent)">
        <Icon size={18} />
      </div>
      <p className="mt-4 text-[15px] font-medium text-(--text)">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13.5px] text-(--text-muted)">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
