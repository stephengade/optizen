import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { pageMetadata } from '@/lib/site-meta'

export const metadata = pageMetadata('/help/workflows')

const workflows = [
  {
    title: 'Running a deploy',
    steps: [
      'Open the project and go to the Deploy tab.',
      'Review the exact commands that will run — change them if they look wrong.',
      'Confirm the target and click Deploy. Watch the live log stream.',
      'After the deploy finishes, check the health status. A passing heartbeat means the service is actually reachable, not just running.',
      'The deploy is saved as a record. If something went wrong, you have the full log and can roll back.',
    ],
  },
  {
    title: 'Editing env files',
    steps: [
      'Open the project and go to the Env tab.',
      'Optizen shows the current file content fetched from the server.',
      'Make your changes. Optizen validates what it can before saving.',
      'On save, the previous version is backed up on the server before the new file is written.',
      'The change appears in the activity log with a timestamp.',
    ],
  },
  {
    title: 'Editing proxy config',
    steps: [
      'Open the project and go to the Proxy tab.',
      'The current config is fetched from the server.',
      'Edit and save. Optizen backs up the previous version, writes the new file, then reloads the proxy.',
      'Check the proxy reload output for errors before assuming it worked.',
    ],
  },
  {
    title: 'Reading logs',
    steps: [
      'Open the project and go to Logs.',
      'Logs stream live from the server over SSH.',
      'Use logs to understand what the runtime actually did — not just whether the container started.',
      'Combine logs with heartbeat status: logs tell you what happened, heartbeats tell you if the service is reachable.',
    ],
  },
  {
    title: 'Rolling back',
    steps: [
      'Open the project and go to Deploy history.',
      'Find the previous successful deploy.',
      'Click Rollback. Optizen will re-run the deploy commands from that record.',
      'If re-auth is enabled, you will need to verify your session first.',
    ],
  },
]

export default function WorkflowsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/help" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) transition-colors mb-6">
        <ArrowLeft size={12} />
        Docs
      </Link>

      <h1 className="text-gradient text-[32px] leading-tight font-semibold tracking-[-0.03em]">Workflows</h1>
      <p className="mt-1 text-sm text-(--text-muted)">
        Common day-to-day operations and how to do them safely.
      </p>

      <div className="mt-8 space-y-8">
        {workflows.map((w) => (
          <div key={w.title}>
            <h2 className="text-sm font-semibold text-(--text) mb-3">{w.title}</h2>
            <div className="border rounded-(--radius) border-(--border) divide-y divide-(--border)">
              {w.steps.map((step, i) => (
                <div key={i} className="flex gap-4 px-4 py-3">
                  <span className="text-[10px] font-mono text-(--text-muted) w-5 shrink-0 pt-0.5">{i + 1}</span>
                  <p className="text-sm text-(--text-muted) leading-5">{step}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t border-(--border) pt-6 flex items-center justify-between">
        <Link href="/help/projects" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border rounded-(--radius) border-(--border) px-3 py-1.5 transition-colors">
          <ArrowLeft size={11} />
          Project types
        </Link>
        <Link href="/help/security" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border rounded-(--radius) border-(--border) px-3 py-1.5 transition-colors">
          Trust & security
          <ArrowLeft size={11} className="rotate-180" />
        </Link>
      </div>
    </div>
  )
}
