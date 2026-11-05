'use client'

import { useEffect, useRef, useState } from 'react'
import { Database, Lock, Play, Table2, TriangleAlert } from 'lucide-react'
import { HighlightedSql } from '@/components/databases/SqlEditor'
import { EngineMark } from '@/components/databases/engine'
import { StatusPill } from '@/components/ui/StatusPill'

/**
 * A looping, self-typing picture of the Databases page for the landing page. Sample data only;
 * nothing here talks to a server. Plays only while on screen, and skips the typing for people
 * who prefer reduced motion.
 */

type Scene =
  | { sql: string; ms: number; columns: string[]; rows: (string | null)[][] }
  | { sql: string; blocked: true }

const SCENES: Scene[] = [
  {
    sql: `select c.email, count(o.id) as orders, sum(o.total) as revenue
from customers c
join orders o on o.customer_id = c.id
group by c.email
order by revenue desc
limit 5;`,
    ms: 18,
    columns: ['email', 'orders', 'revenue'],
    rows: [
      ['ada@lovelace.dev', '42', '12840.00'],
      ['grace@hopper.io', '37', '11205.50'],
      ['linus@kernel.org', '31', '9870.25'],
      ['ken@unix.dev', '24', '7310.00'],
      ['barbara@liskov.net', '19', '5625.75'],
    ],
  },
  {
    sql: `update orders set status = 'refunded'
where id = 1042;`,
    blocked: true,
  },
  {
    sql: `select id, status, total, paid_at
from orders
where status = 'failed'
order by id desc;`,
    ms: 9,
    columns: ['id', 'status', 'total', 'paid_at'],
    rows: [
      ['1187', 'failed', '89.00', null],
      ['1163', 'failed', '240.50', null],
      ['1129', 'failed', '19.99', null],
    ],
  },
]

const TABLES = [
  { name: 'customers', rows: '1.2k' },
  { name: 'invoices', rows: '8.4k' },
  { name: 'orders', rows: '23k' },
  { name: 'plans', rows: '4' },
  { name: 'sessions', rows: '310k' },
  { name: 'webhooks', rows: '57' },
]

type Phase = 'typing' | 'running' | 'done'

export function SqlDemo() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<{ scene: number; chars: number; phase: Phase }>({ scene: 0, chars: 0, phase: 'typing' })

  useEffect(() => {
    const node = rootRef.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    const scene = SCENES[state.scene]
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let delay = 0
    let next: typeof state

    if (state.phase === 'typing') {
      if (state.chars >= scene.sql.length) {
        delay = 450
        next = { ...state, phase: 'running' }
      } else {
        delay = reduced ? 0 : 26
        next = { ...state, chars: reduced ? scene.sql.length : state.chars + 2 }
      }
    } else if (state.phase === 'running') {
      delay = 'blocked' in scene ? 250 : 650
      next = { ...state, phase: 'done' }
    } else {
      delay = 'blocked' in scene ? 3200 : 4200
      next = { scene: (state.scene + 1) % SCENES.length, chars: 0, phase: 'typing' }
    }

    const timer = window.setTimeout(() => setState(next), delay)
    return () => window.clearTimeout(timer)
  }, [state, visible])

  const scene = SCENES[state.scene]
  const typed = scene.sql.slice(0, state.chars)
  const lines = Math.max(scene.sql.split('\n').length, 6)

  return (
    <div ref={rootRef} aria-hidden="true" className="pointer-events-none grid h-[470px] grid-cols-[200px_1fr] text-left select-none max-sm:grid-cols-1">
      {/* Tables */}
      <aside className="border-r border-(--border) bg-(--bg-subtle) p-2.5 max-sm:hidden">
        <div className="flex items-center gap-2 px-1.5 pb-3">
          <EngineMark engine="postgres" size={22} />
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-medium text-(--text)">shop-db</div>
            <div className="text-[11px] text-(--text-subtle)">container postgres</div>
          </div>
        </div>
        <div className="px-1.5 pb-1.5 text-[10.5px] font-medium tracking-wide text-(--text-subtle) uppercase">public</div>
        {TABLES.map((table) => (
          <div
            key={table.name}
            className={`flex items-center gap-2 rounded-(--radius-sm) px-2 py-[5px] text-[12.5px] ${
              table.name === 'orders' ? 'bg-(--surface-2) text-(--text)' : 'text-(--text-muted)'
            }`}
          >
            <Table2 size={13} className={table.name === 'orders' ? 'text-(--accent)' : 'text-(--text-subtle)'} />
            {table.name}
            <span className="ml-auto font-mono text-[10.5px] text-(--text-subtle)">{table.rows}</span>
          </div>
        ))}
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-(--border) px-3.5 py-2.5">
          <span className="rounded-(--radius-sm) px-2.5 py-1 text-[12.5px] text-(--text-muted)">Data</span>
          <span className="rounded-(--radius-sm) bg-(--surface-2) px-2.5 py-1 text-[12.5px] text-(--text) shadow-[inset_0_0_0_1px_var(--border)]">SQL</span>
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] whitespace-nowrap text-(--text-subtle)">
            <Lock size={12} />
            Read-only
          </span>
          <span className={`btn-primary inline-flex h-7 items-center gap-1.5 rounded-(--radius-sm) px-2.5 text-[12px] font-medium transition-[filter] ${state.phase === 'running' ? 'brightness-125' : ''}`}>
            <Play size={11} fill="currentColor" />
            Run
            <kbd className="font-sans text-[10.5px] opacity-70">⌘↵</kbd>
          </span>
        </div>

        {/* Editor */}
        <div className="flex border-b border-(--border) bg-(--code-bg) font-mono text-[12.5px] leading-[21px]">
          <div className="w-9 shrink-0 border-r border-(--border) py-2.5 pr-2 text-right text-(--text-subtle)">
            {Array.from({ length: lines }, (_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>
          <pre className="m-0 min-w-0 flex-1 overflow-hidden px-3.5 py-2.5 whitespace-pre text-(--text)">
            <HighlightedSql sql={typed} />
            {state.phase === 'typing' && <span className="blink inline-block h-3.5 w-[7px] translate-y-0.5 bg-(--accent)" />}
          </pre>
        </div>

        {/* Result */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {state.phase === 'running' && (
            <div className="flex h-full items-center justify-center gap-2 text-[12.5px] text-(--text-muted)">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-(--border-strong) border-t-(--accent)" />
              Running on prod-lagos-01…
            </div>
          )}

          {state.phase === 'done' && 'blocked' in scene && (
            <div className="fade-in m-3.5 flex gap-3 rounded-(--radius) border border-[rgba(245,183,79,0.28)] bg-(--yellow-dim) p-3.5 text-[12.5px] leading-relaxed">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-(--yellow)" />
              <div>
                <div className="font-medium text-(--text)">This query changes data.</div>
                <div className="text-(--text-muted)">Turn on “Allow writes” to run it. You&apos;ll confirm the statements and enter your password first.</div>
              </div>
            </div>
          )}

          {state.phase === 'done' && 'rows' in scene && (
            <div className="fade-in">
              <div className="flex items-center gap-2 px-3.5 py-2 text-[11.5px] text-(--text-subtle)">
                <StatusPill tone="ok">{scene.rows.length} rows</StatusPill>
                <span className="font-mono">{scene.ms} ms</span>
              </div>
              <table className="w-full border-collapse font-mono text-[12px]">
                <thead>
                  <tr className="border-y border-(--border) bg-(--bg-subtle) text-left text-(--text-muted)">
                    <th className="w-9 py-1.5 pr-2 text-right font-normal text-(--text-subtle)">#</th>
                    {scene.columns.map((column) => (
                      <th key={column} className="px-3 py-1.5 font-medium">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scene.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="fade-in border-b border-(--border)" style={{ animationDelay: `${rowIndex * 60}ms` }}>
                      <td className="py-1.5 pr-2 text-right text-(--text-subtle)">{rowIndex + 1}</td>
                      {row.map((value, cellIndex) => (
                        <td key={cellIndex} className={`truncate px-3 py-1.5 ${value === null ? 'text-(--text-subtle) italic' : /^\d/.test(value) ? 'text-[#f5b74f]' : 'text-(--text)'}`}>
                          {value ?? 'NULL'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {state.phase === 'typing' && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-[12.5px] text-(--text-subtle)">
              <Database size={18} />
              Results appear here
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
