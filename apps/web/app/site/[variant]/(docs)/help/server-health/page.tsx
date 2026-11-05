import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const practices = [
  {
    title: 'Keep deploys predictable',
    body: 'Use explicit deploy commands, stable working directories, and clear health checks. If another operator cannot tell what a deploy does, the setup is too implicit.',
  },
  {
    title: 'Watch trends, not just spikes',
    body: 'A brief CPU or load spike is normal during deploys, image pulls, builds, and backups. What matters more is sustained pressure or repeated degradation after deploys.',
  },
  {
    title: 'Leave headroom',
    body: 'Healthy servers are not run permanently at the edge. Leave room in RAM, disk, and CPU so updates, restarts, and traffic bursts do not immediately become incidents.',
  },
  {
    title: 'Clean up Docker drift',
    body: 'Old images, exited containers, unused volumes, and temporary build leftovers quietly consume disk and can complicate rollback logic. Review them regularly.',
  },
  {
    title: 'Treat health checks as first-class',
    body: 'A running container is weaker evidence than a passing app health check. Prefer real endpoints like `/health` when possible, and use port checks only as a fallback.',
  },
  {
    title: 'Keep env and proxy files understandable',
    body: 'When env files, compose files, and proxy configs are easy to locate and reason about, recovery becomes faster and safer under pressure.',
  },
  {
    title: 'Restart on purpose, not by surprise',
    body: 'Unexpected reboots, unexplained low uptime, and silent container churn deserve investigation. Stability should come from maintenance, not luck.',
  },
]

const checklist = [
  'Review recent deploy results before changing anything else.',
  'Check app health checks, not just container status.',
  'Confirm enough free disk space remains for logs, pulls, and backups.',
  'Inspect exited containers and recurring restarts.',
  'Verify env and proxy changes match the currently deployed app.',
  'Patch and reboot on a schedule instead of waiting for an emergency.',
]

export default function ServerHealthPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href="/help" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) transition-colors mb-6">
        <ArrowLeft size={12} />
        Docs
      </Link>

      <h1 className="text-xl font-semibold text-(--text)">Server health</h1>
      <p className="mt-1 text-sm text-(--text-muted)">
        Healthy servers are boring in the best way: clear deploy paths, enough headroom, easy recovery, and no hidden surprises.
      </p>

      <div className="mt-8 border border-(--border) divide-y divide-(--border)">
        {practices.map((practice, index) => (
          <div key={practice.title} className="flex gap-6 px-5 py-5">
            <div className="text-xs font-mono text-(--text-muted) w-6 shrink-0 pt-0.5">
              {String(index + 1).padStart(2, '0')}
            </div>
            <div>
              <div className="text-sm font-semibold text-(--text)">{practice.title}</div>
              <p className="mt-1.5 text-sm leading-6 text-(--text-muted)">{practice.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-(--text)">Quick maintenance checklist</h2>
        <div className="mt-3 border border-(--border) divide-y divide-(--border)">
          {checklist.map((item) => (
            <div key={item} className="px-5 py-4 text-sm text-(--text-muted)">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 border border-(--border) bg-(--surface) p-5">
        <h2 className="text-sm font-semibold text-(--text)">A practical mindset</h2>
        <p className="mt-2 text-sm leading-6 text-(--text-muted)">
          The goal is not a perfect graph. The goal is a system where deploys are understandable, failures are visible, and recovery does not depend on memory or guesswork.
        </p>
      </div>

      <div className="mt-8 border-t border-(--border) pt-6 flex items-center justify-between">
        <Link href="/help/server-metrics" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border border-(--border) px-3 py-1.5 transition-colors">
          <ArrowLeft size={11} />
          Server metrics
        </Link>
        <Link href="/help/workflows" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border border-(--border) px-3 py-1.5 transition-colors">
          Workflows
          <ArrowLeft size={11} className="rotate-180" />
        </Link>
      </div>
    </div>
  )
}
