'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { Project, Server } from '@launchpad/shared'
import { Loader2, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'

type ServerSummary = Server & { projectCount?: number }

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

interface PaletteItem {
  id: string
  label: string
  detail: string
  href: string
  keywords: string
}

const staticItems: PaletteItem[] = [
  { id: 'servers', label: 'Open servers', detail: 'Fleet overview and server cards', href: '/servers', keywords: 'servers fleet hosts overview' },
  { id: 'scan', label: 'Open scan workspace', detail: 'Discover and import apps', href: '/scan', keywords: 'scan import discovery docker' },
  { id: 'help', label: 'Open help', detail: 'Operator guide and product model', href: '/help', keywords: 'help docs guide onboarding' },
  { id: 'settings', label: 'Open settings', detail: 'Notifications, demo privacy, configuration', href: '/settings', keywords: 'settings smtp webhooks privacy' },
]

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PaletteItem[]>(staticItems)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return

    async function load() {
      setLoading(true)
      try {
        const servers = await api.get<ServerSummary[]>('/servers')
        const projectLists = await Promise.all(
          servers.map(async (server) => {
            const projects = await api.get<Project[]>(`/servers/${server.id}/projects`)
            return { server, projects }
          })
        )

        const dynamicItems: PaletteItem[] = []

        for (const { server, projects } of projectLists) {
          dynamicItems.push({
            id: `server-${server.id}`,
            label: server.name,
            detail: `${server.user}@${server.host}:${server.port}`,
            href: `/servers/${server.id}`,
            keywords: `server ${server.name} ${server.host} ${server.user}`,
          })

          for (const project of projects) {
            dynamicItems.push({
              id: `project-${project.id}`,
              label: project.name,
              detail: `${project.runtime} on ${server.name}`,
              href: `/servers/${server.id}/projects/${project.id}`,
              keywords: `project ${project.name} ${project.runtime} ${project.source} ${project.repoImage}`,
            })
          }
        }

        setItems([...staticItems, ...dynamicItems])
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [open])

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return items.slice(0, 12)
    return items
      .filter((item) => `${item.label} ${item.detail} ${item.keywords}`.toLowerCase().includes(value))
      .slice(0, 12)
  }, [items, query])

  return (
    <Modal
      open={open}
      title="Quick actions"
      description="Use Cmd/Ctrl+K to jump between servers, projects, help, scan, and settings."
      onClose={onClose}
    >
      <div className="space-y-4">
        <label className="flex items-center gap-3 border rounded-(--radius) border-(--border) bg-(--surface-2) px-4 py-2.5">
          <Search size={14} className="text-(--text-muted) shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search actions, servers, or projects..."
            className="w-full bg-transparent text-sm text-(--text) outline-none placeholder:text-(--text-muted)"
          />
        </label>

        <div className="space-y-px">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              className="flex flex-col border rounded-(--radius) border-(--border) bg-(--surface-2) px-4 py-3 transition-colors hover:bg-(--surface-2)"
            >
              <div className="text-sm font-medium text-(--text)">{item.label}</div>
              <div className="mt-0.5 text-xs text-(--text-muted)">{item.detail}</div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="border rounded-(--radius) border-dashed border-(--border) px-4 py-6 text-sm text-(--text-muted)">
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Loading results...</span>
                </div>
              ) : 'No results.'}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
