'use client'

import type { ProjectRuntime, ProjectSource } from '@launchpad/shared'

interface ProjectClassificationBadgeProps {
  source: ProjectSource
  runtime: ProjectRuntime
}

const runtimeLabel: Record<ProjectRuntime, string> = {
  compose: 'Compose app',
  image: 'Image app',
  proxy: 'Proxy app',
  custom: 'Custom app',
}

export function ProjectClassificationBadge({ source, runtime }: ProjectClassificationBadgeProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {source}
      </span>
      <span className="rounded-full border border-[var(--green)] bg-[var(--green-dim)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--green)]">
        {runtimeLabel[runtime]}
      </span>
    </div>
  )
}
