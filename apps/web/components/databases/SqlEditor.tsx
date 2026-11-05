'use client'

import { useMemo, useRef } from 'react'

const KEYWORDS = new Set(
  `select from where and or not in is null as on join left right inner outer full cross group by order having limit offset
  insert into values update set delete create table view index drop alter add column primary key foreign references
  distinct union all exists between like ilike case when then else end asc desc with returning default unique check
  constraint begin commit rollback transaction explain analyze show describe truncate grant revoke cascade if
  true false count sum avg min max coalesce cast interval now`.split(/\s+/)
)

type Token = { text: string; kind?: 'kw' | 'str' | 'num' | 'comment' | 'ident' }

function tokenize(sql: string): Token[] {
  const tokens: Token[] = []
  const pattern = /(--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:[^']|'')*'?)|("(?:[^"]|"")*"?|`[^`]*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g
  let last = 0
  for (const match of sql.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) tokens.push({ text: sql.slice(last, index) })
    const [text, comment, str, ident, num, word] = match
    if (comment) tokens.push({ text, kind: 'comment' })
    else if (str) tokens.push({ text, kind: 'str' })
    else if (ident) tokens.push({ text, kind: 'ident' })
    else if (num) tokens.push({ text, kind: 'num' })
    else if (word && KEYWORDS.has(word.toLowerCase())) tokens.push({ text, kind: 'kw' })
    else tokens.push({ text })
    last = index + text.length
  }
  if (last < sql.length) tokens.push({ text: sql.slice(last) })
  return tokens
}

const COLORS: Record<NonNullable<Token['kind']>, string> = {
  kw: 'text-[#a9adff]',
  str: 'text-[#86e0a5]',
  num: 'text-[#f5b74f]',
  comment: 'text-(--text-subtle) italic',
  ident: 'text-[#7dd3fc]',
}

/** Read-only SQL with the editor's colours (used by the landing page demo). */
export function HighlightedSql({ sql }: { sql: string }) {
  return (
    <>
      {tokenize(sql).map((token, index) =>
        token.kind ? <span key={index} className={COLORS[token.kind]}>{token.text}</span> : token.text
      )}
    </>
  )
}

/**
 * A textarea with SQL highlighting drawn underneath it. The textarea is transparent and on top,
 * so selection, undo, IME and spellcheck all behave like a normal field.
 */
export function SqlEditor({
  value,
  onChange,
  onRun,
  minRows = 8,
}: {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  minRows?: number
}) {
  const highlightRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const tokens = useMemo(() => tokenize(value), [value])
  const lineCount = Math.max(value.split('\n').length, minRows)

  function syncScroll(event: React.UIEvent<HTMLTextAreaElement>) {
    const { scrollTop, scrollLeft } = event.currentTarget
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop
      highlightRef.current.scrollLeft = scrollLeft
    }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      onRun()
      return
    }
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault()
      const target = event.currentTarget
      const { selectionStart, selectionEnd } = target
      const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`
      onChange(next)
      requestAnimationFrame(() => target.setSelectionRange(selectionStart + 2, selectionStart + 2))
    }
  }

  const shared = 'm-0 whitespace-pre px-4 py-3 font-mono text-[13px] leading-[1.7] tracking-normal'

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-(--code-bg)">
      <div
        ref={gutterRef}
        aria-hidden
        className="w-11 shrink-0 overflow-hidden border-r border-(--border) py-3 pr-2.5 text-right font-mono text-[12px] leading-[1.7] text-(--text-subtle) select-none"
        style={{ lineHeight: '22.1px' }}
      >
        {Array.from({ length: lineCount }, (_, index) => (
          <div key={index}>{index + 1}</div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <pre ref={highlightRef} aria-hidden className={`${shared} pointer-events-none absolute inset-0 overflow-hidden text-(--text)`}>
          {tokens.map((token, index) =>
            token.kind ? <span key={index} className={COLORS[token.kind]}>{token.text}</span> : token.text
          )}
          {'\n'}
        </pre>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="SQL query"
          placeholder="select * from users limit 50;"
          className={`${shared} absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent text-transparent caret-(--text) outline-none placeholder:text-(--text-subtle) selection:bg-[rgba(124,131,255,0.35)]`}
        />
      </div>
    </div>
  )
}
