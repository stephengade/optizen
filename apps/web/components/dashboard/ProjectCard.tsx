'use client'

import Link from 'next/link'
import type { Project } from '@launchpad/shared'
import { ArrowRight, Bell, Globe, HeartPulse, Terminal } from 'lucide-react'
import { SensitiveText } from '@/components/ui/SensitiveText'
import { formatRelative } from '@/lib/utils'
import { HealthBadge } from './HealthBadge'
import { ProjectClassificationBadge } from './ProjectClassificationBadge'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <article className="border rounded-(--radius) border-(--border) bg-(--surface) p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-(--text)">{project.name}</h3>
          <p className="mt-0.5 text-xs text-(--text-muted)">
            <SensitiveText value={project.repoImage} />
          </p>
        </div>
        <HealthBadge status={project.healthStatus?.status} />
      </div>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <ProjectClassificationBadge source={project.source} runtime={project.runtime} />
        <span className="border rounded-(--radius) border-(--border) px-2 py-0.5 text-[11.5px] font-medium text-(--text-muted)">
          {project.proxyType === 'none' ? 'no proxy' : project.proxyType}
        </span>
      </div>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--text-muted)">
        <span className="inline-flex items-center gap-1.5">
          <Terminal size={11} />
          {project.deployCommands.length} cmd{project.deployCommands.length !== 1 ? 's' : ''}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Globe size={11} />
          {project.webhookEnabled ? 'Webhook on' : 'Webhook off'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Bell size={11} />
          {project.notifications.onSuccess || project.notifications.onFailure ? 'Notifs on' : 'Notifs off'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <HeartPulse size={11} />
          {project.healthStatus?.lastSuccessfulAt
            ? `Heartbeat ${formatRelative(project.healthStatus.lastSuccessfulAt)}`
            : 'No heartbeat'}
        </span>
      </div>

      {/* Last deploy */}
      <div className="mt-3 border-t border-(--border) pt-3 flex items-center justify-between gap-4">
        <p className="text-xs text-(--text-muted)">
          {project.lastDeploy
            ? `Last deploy ${project.lastDeploy.status} ${formatRelative(project.lastDeploy.triggeredAt)}`
            : 'No deploys yet'}
        </p>
        <Link
          href={`/servers/${project.serverId}/projects/${project.id}`}
          className="inline-flex items-center gap-1 text-xs text-(--text-muted) hover:text-(--text) transition-colors shrink-0"
        >
          Open
          <ArrowRight size={11} />
        </Link>
      </div>
    </article>
  )
}
