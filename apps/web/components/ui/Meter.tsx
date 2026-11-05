/** Labelled usage bar. Turns amber at 75% and red at 90%. */
export function Meter({ label, value, percent }: { label?: string; value?: string; percent: number }) {
  const bar =
    percent >= 90
      ? 'var(--red)'
      : percent >= 75
        ? 'linear-gradient(90deg,#e9a23b,#f5b74f)'
        : 'linear-gradient(90deg,#6d73f5,#a78bfa)'
  return (
    <div>
      {(label || value) && (
        <div className="flex justify-between gap-2 text-xs text-(--text-muted)">
          {label}
          <b className="truncate font-medium text-(--text) tabular-nums">{value}</b>
        </div>
      )}
      <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-(--surface-3)">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: bar }} />
      </div>
    </div>
  )
}
