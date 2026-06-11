export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  const rounded = value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)
  return `${rounded} ${units[index]}`
}

export function formatPercent(value: number, digits = 0) {
  if (!Number.isFinite(value)) return 'n/a'
  return `${value.toFixed(digits)}%`
}

export function formatUptime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'n/a'

  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
