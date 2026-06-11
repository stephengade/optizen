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
        <div className="flex min-h-screen items-center justify-center bg-[#0f1410] px-6 py-10 text-white">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-black/30 p-8">
            <p className="text-xs uppercase tracking-[0.24em] text-[#d6ff72]">Launchpad</p>
            <h1 className="mt-2 text-3xl font-semibold">The control plane needs a refresh</h1>
            <p className="mt-3 text-sm text-white/70">
              Something failed outside the current page boundary. Retry the app shell to restore the dashboard.
            </p>
            <div className="mt-6">
              <Button onClick={reset}>Reload app</Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
