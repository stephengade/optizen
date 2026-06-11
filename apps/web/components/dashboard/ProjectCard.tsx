'use client'

import Link from 'next/link'
import type { Project } from '@launchpad/shared'
import { ArrowRight, Bell, Globe, Terminal } from 'lucide-react'
import { SensitiveText } from '@/components/ui/SensitiveText'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">{project.name}</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            <SensitiveText value={project.repoImage} />
          </p>
        </div>
        <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {project.proxyType}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2">
          <Terminal size={13} />
          {project.deployCommands.length} command{project.deployCommands.length === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-2">
          <Globe size={13} />
          {project.webhookEnabled ? 'Webhook ready' : 'Webhook off'}
        </span>
        <span className="inline-flex items-center gap-2">
          <Bell size={13} />
          {project.notifications.onSuccess || project.notifications.onFailure ? 'Notifications on' : 'Notifications off'}
        </span>
      </div>

      <Link
        href={`/servers/${project.serverId}/projects/${project.id}`}
        className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[var(--green)]"
      >
        Open project
        <ArrowRight size={13} />
      </Link>
    </article>
  )
}
