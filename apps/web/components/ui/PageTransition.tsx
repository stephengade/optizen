'use client'

import { usePathname } from 'next/navigation'

/**
 * Eases each page in when the path changes, so navigation doesn't snap. Keyed on the full path
 * (a Next template only re-mounts when its own child segment changes).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  )
}
