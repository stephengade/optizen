import { cn } from '@/lib/utils'

/** The Optizen logo: a gradient tile with a ring. */
export function OptizenMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center', className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.29),
        background: 'linear-gradient(135deg, #8b91ff, #a78bfa 60%, #c4b5fd)',
        boxShadow: '0 0 0 1px rgba(255,255,255,.15) inset, 0 4px 14px -4px rgba(124,131,255,.7)',
      }}
    >
      <span
        style={{
          width: size * 0.38,
          height: size * 0.38,
          borderRadius: '50%',
          border: `${Math.max(1.5, size / 12)}px solid #fff`,
        }}
      />
    </span>
  )
}

export function OptizenLogo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <OptizenMark size={size} />
      <span className="text-[15px] font-semibold tracking-tight text-(--text)">Optizen</span>
    </span>
  )
}
