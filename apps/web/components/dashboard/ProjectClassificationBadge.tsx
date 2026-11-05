'use client'

import type { ProjectRuntime, ProjectSource } from '@launchpad/shared'

interface ProjectClassificationBadgeProps {
  source: ProjectSource
  runtime: ProjectRuntime
}

const runtimeLabel: Record<ProjectRuntime, string> = {
  compose: 'compose',
  image: 'image',
  proxy: 'proxy',
  custom: 'custom',
}

export function ProjectClassificationBadge({ source, runtime }: ProjectClassificationBadgeProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-md border border-(--border-strong) px-1.5 py-0.5 font-mono text-[11px] text-(--text-muted)">
        {source}
      </span>
      <span className="rounded-md border border-(--accent-border) bg-(--accent-dim) px-1.5 py-0.5 font-mono text-[11px] text-(--accent)">
        {runtimeLabel[runtime]}
      </span>
    </div>
  )
}
