'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Copy, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface GridColumn {
  name: string
  type?: string
}

interface Props {
  columns: GridColumn[]
  rows: (string | null)[][]
  /** Row number of the first row (for paged data) */
  offset?: number
  sort?: { column: string; desc: boolean } | null
  onSort?: (column: string) => void
  emptyLabel?: string
}

/** Data grid with sticky headers, NULL markers and a side panel for the full row. */
export function ResultGrid({ columns, rows, offset = 0, sort, onSort, emptyLabel = 'No rows' }: Props) {
  // The selection belongs to one set of rows; new rows clear it.
  const [selection, setSelection] = useState<{ rows: Props['rows']; index: number } | null>(null)
  const selected = selection?.rows === rows ? selection.index : null
  const setSelected = (index: number | null) => setSelection(index === null ? null : { rows, index })

  if (!columns.length) {
    return <div className="grid h-full place-items-center p-10 text-[13px] text-(--text-subtle)">{emptyLabel}</div>
  }

  const row = selected === null ? null : rows[selected]

  return (
    <div className="relative flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 font-mono text-[12.5px]">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 w-12 border-r border-b border-(--border) bg-(--surface-2) px-3 py-2 text-right font-normal text-(--text-subtle)">#</th>
              {columns.map((column) => {
                const active = sort?.column === column.name
                return (
                  <th key={column.name} className="sticky top-0 z-10 border-r border-b border-(--border) bg-(--surface-2) p-0 text-left font-normal">
                    <button
                      type="button"
                      disabled={!onSort}
                      onClick={() => onSort?.(column.name)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left disabled:cursor-default enabled:hover:bg-white/[0.03]"
                    >
                      <span className="font-sans text-[12.5px] font-medium text-(--text)">{column.name}</span>
                      {column.type && <span className="text-[11px] text-(--text-subtle)">{column.type}</span>}
                      {active && (sort?.desc ? <ArrowDown size={12} className="text-(--accent)" /> : <ArrowUp size={12} className="text-(--accent)" />)}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((values, rowIndex) => (
              <tr
                key={rowIndex}
                onClick={() => setSelected(rowIndex === selected ? null : rowIndex)}
                className={cn('group cursor-pointer', rowIndex === selected && '[&>td]:bg-(--accent-dim)')}
              >
                <td className="sticky left-0 z-[5] border-r border-b border-(--border) bg-(--bg-subtle) px-3 py-1.5 text-right text-(--text-subtle) group-hover:bg-(--surface)">
                  {offset + rowIndex + 1}
                </td>
                {values.map((value, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="max-w-[340px] truncate border-r border-b border-(--border) px-3 py-1.5 text-(--text) group-hover:bg-white/[0.025]"
                    title={value ?? 'NULL'}
                  >
                    {value === null ? <span className="text-(--text-subtle) italic">NULL</span> : value === '' ? <span className="text-(--text-subtle)">{"''"}</span> : value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-10 text-center text-[13px] text-(--text-subtle)">{emptyLabel}</div>}
      </div>

      {row && (
        <aside className="fade-in flex w-[340px] shrink-0 flex-col border-l border-(--border) bg-(--surface)">
          <div className="flex items-center justify-between border-b border-(--border) px-4 py-2.5">
            <span className="text-[13px] font-medium text-(--text)">Row {offset + (selected ?? 0) + 1}</span>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close row" className="rounded p-1 text-(--text-muted) hover:text-(--text)">
              <X size={15} />
            </button>
          </div>
          <dl className="min-h-0 flex-1 divide-y divide-(--border) overflow-auto">
            {columns.map((column, index) => (
              <RowValue key={column.name} column={column} value={row[index]} />
            ))}
          </dl>
        </aside>
      )}
    </div>
  )
}

function RowValue({ column, value }: { column: GridColumn; value: string | null }) {
  const [copied, setCopied] = useState(false)
  const pretty = value !== null && /^[[{]/.test(value.trim()) ? tryPretty(value) : value

  return (
    <div className="group px-4 py-2.5">
      <dt className="flex items-center justify-between gap-2 text-[12px] text-(--text-muted)">
        <span>
          {column.name}
          {column.type && <span className="ml-2 font-mono text-[11px] text-(--text-subtle)">{column.type}</span>}
        </span>
        {value !== null && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(value)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            }}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={`Copy ${column.name}`}
          >
            {copied ? <Check size={13} className="text-(--green)" /> : <Copy size={13} />}
          </button>
        )}
      </dt>
      <dd className="mt-1 font-mono text-[12.5px] break-words whitespace-pre-wrap text-(--text)">
        {value === null ? <span className="text-(--text-subtle) italic">NULL</span> : pretty}
      </dd>
    </div>
  )
}

function tryPretty(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export function toCsv(columns: string[], rows: (string | null)[][]): string {
  const cell = (value: string | null) => {
    if (value === null) return ''
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  }
  return [columns.map(cell).join(','), ...rows.map((row) => row.map(cell).join(','))].join('\n')
}
