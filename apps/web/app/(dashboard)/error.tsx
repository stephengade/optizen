'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'

export default function DashboardError({
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
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-start justify-center gap-6 px-6 py-12 lg:px-8">
      <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--yellow)]">Recovery</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--text)]">This workspace hit an unexpected state</h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--text-muted)]">
          Launchpad keeps your server and project records intact. Try the action again, or step back to a stable view and continue from there.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reset}>Retry this view</Button>
          <Link
            href="/servers"
            className="inline-flex h-10 items-center rounded-[14px] border border-[var(--border)] px-4 text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            Back to servers
          </Link>
          <Link
            href="/help"
            className="inline-flex h-10 items-center rounded-[14px] border border-[var(--border)] px-4 text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            Open help
          </Link>
        </div>
      </div>
    </div>
  )
}
