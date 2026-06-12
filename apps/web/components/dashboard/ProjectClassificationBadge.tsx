'use client'

import type { ProjectRuntime, ProjectSource } from '@launchpad/shared'

interface ProjectClassificationBadgeProps {
  source: ProjectSource
  runtime: ProjectRuntime
}

const runtimeLabel: Record<ProjectRuntime, string> = {
  compose: 'Compose',
  image: 'Image',
  proxy: 'Proxy',
  custom: 'Custom',
}

export function ProjectClassificationBadge({ source, runtime }: ProjectClassificationBadgeProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="border border-(--border) px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-(--text-muted)">
        {source}
      </span>
      <span className="border border-(--accent) px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-(--accent)">
        {runtimeLabel[runtime]}
      </span>
    </div>
  )
}
