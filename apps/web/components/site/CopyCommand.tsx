'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard can be blocked (http, permissions); the command is still selectable.
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-(--border-strong) bg-(--code-bg) py-3 pr-3 pl-5 font-mono text-sm text-(--text)">
      <span className="min-w-0 overflow-x-auto whitespace-nowrap">
        <span className="mr-3 text-(--accent)">$</span>
        {command}
      </span>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-(--radius-sm) border border-(--border-strong) bg-white/[0.03] px-3 font-sans text-[12.5px] text-(--text) transition-colors hover:bg-white/[0.06]"
      >
        {copied ? <Check size={14} className="text-(--green)" /> : <Copy size={14} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
