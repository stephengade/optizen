import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { pageMetadata } from '@/lib/site-meta'

export const metadata = pageMetadata('/help/server-metrics')

const metrics = [
  {
    name: 'CPU usage',
    example: '4.2%',
    meaning: 'The share of total CPU time currently in use across the server. A low value usually means the machine has headroom.',
    howToRead: '4.2% is healthy for most idle or lightly loaded VPS hosts. Sustained 80% to 100% usually means the box is close to saturation.',
    notes: 'CPU usage alone does not tell you whether requests are slow. Check it alongside load average, memory pressure, and app health.',
  },
  {
    name: 'CPU cores',
    example: '4 cores',
    meaning: 'How many execution cores the server can schedule work onto.',
    howToRead: 'More cores means the server can handle more parallel work. Load average makes more sense when compared to this number.',
    notes: 'A load of 1 on a 1-core VPS is very different from a load of 1 on a 4-core VPS.',
  },
  {
    name: 'Load average',
    example: '1.07 / 0.73 / 0.57',
    meaning: 'The average number of runnable or waiting tasks over the last 1, 5, and 15 minutes.',
    howToRead: 'Compare the first number to the CPU core count. On a 4-core server, a load of 1.07 is light. On a 1-core server, it means the machine is busier.',
    notes: 'Rising 1-minute load with lower 15-minute load usually means a recent spike. High load with low CPU can point to disk or network wait.',
  },
  {
    name: 'Memory',
    example: '2.7 GB / 7.8 GB',
    meaning: 'How much RAM is currently in use compared with the total available to the VPS.',
    howToRead: 'Consistently high memory use is not always bad, but sudden jumps or near-full usage can lead to swapping and slower response times.',
    notes: 'Watch for a combination of high memory use, degraded health checks, and restarts.',
  },
  {
    name: 'Disk',
    example: '39.6 GB / 144 GB',
    meaning: 'How much persistent storage is in use on the root filesystem.',
    howToRead: 'Leaving healthy free space matters for logs, images, package updates, and database growth.',
    notes: 'Disk problems often show up slowly. Clean old images, logs, backups, and failed build artifacts before the disk is nearly full.',
  },
  {
    name: 'Inodes',
    example: '31% inode use',
    meaning: 'How many filesystem entries are used. Files, directories, and symlinks all consume inodes.',
    howToRead: 'You can run out of inodes even when there is still free disk space left.',
    notes: 'Huge numbers of small files, caches, temp builds, or logs can cause inode pressure.',
  },
  {
    name: 'Uptime',
    example: '18d 23h',
    meaning: 'How long the server has been running since the last reboot.',
    howToRead: 'Long uptime can be a good stability signal, but only if updates and maintenance are still being done thoughtfully.',
    notes: 'Very low uptime after unexpected deploy or health failures can indicate crashes, forced reboots, or provider issues.',
  },
  {
    name: 'Running containers',
    example: '7 running, 0 exited',
    meaning: 'How many Docker containers are currently up, plus how many have stopped and remained exited.',
    howToRead: 'Running containers tell you what is active now. Exited containers can indicate failed jobs, stale workloads, or previous broken deploys.',
    notes: 'A growing exited count is a prompt to inspect logs and prune abandoned containers when appropriate.',
  },
]

export default function ServerMetricsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href="/help" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) transition-colors mb-6">
        <ArrowLeft size={12} />
        Docs
      </Link>

      <h1 className="text-gradient text-[32px] leading-tight font-semibold tracking-[-0.03em]">Server metrics</h1>
      <p className="mt-1 text-sm text-(--text-muted)">
        A quick guide to what Optizen shows on server cards and detail pages, and how to interpret those numbers without overreacting.
      </p>

      <div className="mt-8 border rounded-(--radius) border-(--border) divide-y divide-(--border)">
        {metrics.map((metric) => (
          <div key={metric.name} className="px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-(--text)">{metric.name}</h2>
              <span className="text-xs font-mono text-(--text-muted)">{metric.example}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-(--text-muted)">{metric.meaning}</p>
            <p className="mt-2 text-sm leading-6 text-(--text-muted)">
              <span className="text-(--text)">How to read it:</span> {metric.howToRead}
            </p>
            <p className="mt-2 text-sm leading-6 text-(--text-muted)">
              <span className="text-(--text)">Watch for:</span> {metric.notes}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 border rounded-(--radius) border-(--border) bg-(--surface) p-5">
        <h2 className="text-sm font-semibold text-(--text)">Rule of thumb</h2>
        <p className="mt-2 text-sm leading-6 text-(--text-muted)">
          No single metric proves a server is healthy or unhealthy. The strongest signal comes from combining machine metrics with app-level health checks and recent deploy outcomes.
        </p>
      </div>

      <div className="mt-8 border-t border-(--border) pt-6 flex items-center justify-between">
        <p className="text-xs text-(--text-muted)">Next: how to keep a server healthy over time</p>
        <Link href="/help/server-health" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border rounded-(--radius) border-(--border) px-3 py-1.5 transition-colors">
          Server health
          <ArrowLeft size={11} className="rotate-180" />
        </Link>
      </div>
    </div>
  )
}
