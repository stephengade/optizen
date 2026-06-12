'use client'

import type { DeployRecord } from '@launchpad/shared'
import { Button } from '@/components/ui/Button'
import { SensitiveText } from '@/components/ui/SensitiveText'

export interface ImageStatus {
  containerId: string
  name: string
  image: string
  tag: string
  status: string
  uptime: string
  ports: string[]
  restartCount: number
}

interface ImagePanelProps {
  repoImage: string
  status: ImageStatus | null
  tags: string[]
  selectedTag: string
  pulling?: boolean
  pruning?: boolean
  rollingBack?: boolean
  rollbackCandidates: DeployRecord[]
  selectedRollbackId: string
  onTagChange: (tag: string) => void
  onRollbackChange: (deployId: string) => void
  onPull: () => void
  onPrune: () => void
  onRefresh: () => void
  onRollback: () => void
}

export function ImagePanel({
  repoImage,
  status,
  tags,
  selectedTag,
  pulling,
  pruning,
  rollingBack,
  rollbackCandidates,
  selectedRollbackId,
  onTagChange,
  onRollbackChange,
  onPull,
  onPrune,
  onRefresh,
  onRollback,
}: ImagePanelProps) {
  return (
    <section className="rounded-2xl border border-(--border) bg-(--surface) p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
                    <h2 className="mt-2 text-lg font-semibold text-(--text)">Docker image manager</h2>
          <p className="mt-1 text-sm text-(--text-muted)">
            Inspect the running container, pull new tags, and roll back using recent successful deploys.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className=" border border-(--border) bg-(--surface-2) p-4">
          <h3 className="text-sm font-medium text-(--text)">Container status</h3>
          {status ? (
            <div className="mt-3 grid gap-2 text-sm text-(--text-muted)">
              <div>Image: <SensitiveText value={status.image || repoImage} className="text-(--text)" /></div>
              <div>Tag: <span className="text-(--text)">{status.tag}</span></div>
              <div>Status: <span className="text-(--text)">{status.status || 'unknown'}</span></div>
              <div>Container: <SensitiveText value={status.name || 'not running'} className="font-mono text-(--text)" /></div>
              <div>Uptime: <span className="text-(--text)">{status.uptime || 'n/a'}</span></div>
              <div>Ports: <SensitiveText value={status.ports.length > 0 ? status.ports.join(', ') : 'n/a'} className="text-(--text)" /></div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-(--text-muted)">No status loaded yet.</p>
          )}
        </div>

        <div className="space-y-4">
          <div className=" border border-(--border) bg-(--surface-2) p-4">
            <h3 className="text-sm font-medium text-(--text)">Pull tag</h3>
            <div className="mt-3 space-y-3">
              <select
                value={selectedTag}
                onChange={(event) => onTagChange(event.target.value)}
                className="h-10 w-full rounded border border-(--border) bg-(--surface) px-3 text-sm text-(--text) outline-none focus:border-(--border-strong)"
              >
                <option value="">latest</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={onPull} loading={pulling}>
                Pull image
              </Button>
            </div>
          </div>

          <div className=" border border-(--border) bg-(--surface-2) p-4">
            <h3 className="text-sm font-medium text-(--text)">Rollback</h3>
            <div className="mt-3 space-y-3">
              <select
                value={selectedRollbackId}
                onChange={(event) => onRollbackChange(event.target.value)}
                className="h-10 w-full rounded border border-(--border) bg-(--surface) px-3 text-sm text-(--text) outline-none focus:border-(--border-strong)"
              >
                <option value="">Select successful deploy</option>
                {rollbackCandidates.map((record) => (
                  <option key={record.id} value={record.id}>
                    {(record.imageTag || 'untagged') + ' · ' + new Date(record.triggeredAt).toLocaleString()}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                onClick={onRollback}
                loading={rollingBack}
                disabled={!selectedRollbackId}
              >
                Roll back
              </Button>
            </div>
          </div>

          <div className=" border border-(--border) bg-(--surface-2) p-4">
            <h3 className="text-sm font-medium text-(--text)">Cleanup</h3>
            <p className="mt-2 text-sm text-(--text-muted)">Prune dangling images on the remote host.</p>
            <div className="mt-3">
              <Button size="sm" variant="ghost" onClick={onPrune} loading={pruning}>
                Prune images
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
