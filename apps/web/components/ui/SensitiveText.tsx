'use client'

import { useDemoPrivacy } from '@/lib/demo-privacy-context'

interface SensitiveTextProps {
  value: string
  className?: string
  fallback?: string
}

export function SensitiveText({ value, className, fallback }: SensitiveTextProps) {
  const { enabled, mask } = useDemoPrivacy()
  const displayValue = enabled ? mask(value, fallback) : value || fallback || ''

  return (
    <span className={className} data-sensitive="true">
      {displayValue}
    </span>
  )
}
