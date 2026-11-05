import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { pageMetadata } from '@/lib/site-meta'

export const metadata = pageMetadata('/help/security')

const topics = [
  {
    title: 'Master password',
    body: 'Your master password encrypts all credentials stored on disk. Optizen never stores it in plaintext: it keeps only a slow scrypt hash, and five wrong attempts lock out that IP address for 15 minutes. Sessions expire based on the duration you set in Settings.',
  },
  {
    title: 'Re-authentication',
    body: 'When re-auth is enabled, dangerous actions — deploys, rollbacks, deletes, env writes, and proxy reloads — require a fresh password check. Enable this in Settings → Session security.',
  },
  {
    title: 'Re-auth window',
    body: 'After a successful re-auth, Optizen trusts that session for a configurable window (default: 15 minutes). You will not be prompted again within that window unless you restart.',
  },
  {
    title: 'SSH keys',
    body: 'Optizen never stores your private key — only the file path on the host where Optizen is running. Make sure that path is correct and the key has the right permissions (chmod 600).',
  },
  {
    title: 'Audit trail',
    body: 'Session elevations, security setting changes, and sensitive value reveals all appear in the security audit trail in Settings. Use it as an operator logbook, not just a compliance checkbox.',
  },
  {
    title: 'Demo privacy mode',
    body: 'Turns on in Settings. Masks sensitive values across the dashboard — useful when screen-sharing or recording. Actual data is not changed, just hidden in the UI.',
  },
  {
    title: 'Seeded demo mode',
    body: 'Swaps all dashboards to safe sample data — fake servers, projects, deploys, and telemetry. Useful for walkthroughs or screenshots without touching live infrastructure.',
  },
  {
    title: 'Backups and revision history',
    body: 'Every env and proxy file save creates a remote backup before overwriting the live file. Revision history is available in the file editor. If something breaks, you can restore the previous version.',
  },
]

export default function SecurityPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/help" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) transition-colors mb-6">
        <ArrowLeft size={12} />
        Docs
      </Link>

      <h1 className="text-gradient text-[32px] leading-tight font-semibold tracking-[-0.03em]">Trust & security</h1>
      <p className="mt-1 text-sm text-(--text-muted)">
        How Optizen protects your credentials and keeps dangerous actions explicit.
      </p>

      <div className="mt-8 border rounded-(--radius) border-(--border) divide-y divide-(--border)">
        {topics.map((t) => (
          <div key={t.title} className="px-5 py-5">
            <div className="text-sm font-semibold text-(--text)">{t.title}</div>
            <p className="mt-1.5 text-sm leading-6 text-(--text-muted)">{t.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 border rounded-(--radius) border-(--border) bg-(--surface) px-5 py-5">
        <div className="text-[12.5px] font-medium text-(--text-muted) mb-2">Where to configure this</div>
        <p className="text-sm text-(--text-muted)">
          Session duration, re-auth requirements, demo privacy, and demo mode are all in{' '}
          <Link href="/settings" className="text-(--text) underline underline-offset-2">Settings</Link>.
          The audit trail is at the bottom of that page.
        </p>
      </div>

      <div className="mt-8 border-t border-(--border) pt-6">
        <Link href="/help/workflows" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border rounded-(--radius) border-(--border) px-3 py-1.5 transition-colors">
          <ArrowLeft size={11} />
          Workflows
        </Link>
      </div>
    </div>
  )
}
