import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-(--bg)">
      {/* Minimal nav */}
      <header className="sticky top-0 z-30 border-b border-(--border) bg-(--bg) px-6 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs text-(--text-muted) hover:text-(--text) transition-colors">
            <ArrowLeft size={12} />
            Optizen
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/help" className="text-xs text-(--text-muted) hover:text-(--text) transition-colors">Docs</Link>
            <Link
              href="/login"
              className="inline-flex h-7 items-center gap-1.5 border border-(--border) px-3 text-xs text-(--text-muted) hover:text-(--text) hover:border-(--border-strong) transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="border-t border-(--border) px-6 py-6 mt-16">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-4">
          <p className="text-xs text-(--text-subtle)">Optizen · AGPL-3.0 License · Self-hosted</p>
          <div className="flex items-center gap-4 text-xs text-(--text-muted)">
            <Link href="/about" className="hover:text-(--text) transition-colors">About</Link>
            <Link href="/help/setup" className="hover:text-(--text) transition-colors">Quick start</Link>
            <Link href="/help/projects" className="hover:text-(--text) transition-colors">Projects</Link>
            <Link href="/help/workflows" className="hover:text-(--text) transition-colors">Workflows</Link>
            <Link href="/help/security" className="hover:text-(--text) transition-colors">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
