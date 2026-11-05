'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-6 py-10 text-white">
          <div className="w-full max-w-xl border rounded-(--radius) border-white/10 p-8">
            <p className="text-[12.5px] font-medium text-[#c8ff57]">Optizen</p>
            <h1 className="mt-3 text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-white/60">
              An error occurred outside the page boundary. Reload to restore the dashboard.
            </p>
            <div className="mt-6">
              <Button onClick={reset}>Reload</Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
