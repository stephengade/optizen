'use client'

import Link from 'next/link'
import { FileText, Shield, Info, Heart } from 'lucide-react'
import { GITHUB_REPO_URL } from '@/lib/links'

export default function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      {/* Intro Header */}
      <div className="mb-12 border-b border-(--border) pb-8">
        <div className="flex items-center gap-3 text-xs text-(--accent) font-medium mb-2 font-mono">
          <Info size={14} />
          About Optizen
        </div>
        <h1 className="text-gradient text-[32px] leading-tight font-semibold tracking-[-0.03em]">
          A modern, open-source VPS control plane.
        </h1>
        <p className="mt-4 text-base leading-7 text-(--text-muted)">
          Optizen was created to solve the lack of visibility and control in traditional self-hosted setups. 
          Instead of running brittle SSH scripts from developer laptops or paying for heavy SaaS agents, 
          Optizen models servers, projects, env configurations, and reverse proxy settings into a secure, 
          self-contained dashboard that runs on your own hardware.
        </p>
      </div>

      {/* Core Principles */}
      <div className="grid gap-6 md:grid-cols-2 mb-16">
        <div className="border rounded-(--radius) border-(--border) bg-(--surface) p-6">
          <div className="flex items-center gap-2.5 mb-3 text-(--accent)">
            <Heart size={16} />
            <h2 className="text-sm font-semibold text-(--text)">Privacy First</h2>
          </div>
          <p className="text-xs leading-5 text-(--text-muted)">
            Optizen stores credentials and credentials-key path references locally on your own filesystem. 
            Passwords and passphrases are encrypted at rest with AES-256-GCM. There is no cloud telemetry or phone-home reporting.
          </p>
        </div>
        <div className="border rounded-(--radius) border-(--border) bg-(--surface) p-6">
          <div className="flex items-center gap-2.5 mb-3 text-(--accent)">
            <Shield size={16} />
            <h2 className="text-sm font-semibold text-(--text)">Operation Guardrails</h2>
          </div>
          <p className="text-xs leading-5 text-(--text-muted)">
            Every dangerous operation—like deploys, rollbacks, and file edits—includes syntax validation, 
            diff previews, and optional multi-factor session re-authentication.
          </p>
        </div>
      </div>

      {/* Dedicated License Explanation Section */}
      <section className="border rounded-(--radius) border-(--border) bg-(--bg-subtle) p-6 md:p-8 mb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 h-32 w-32 bg-(--accent-dim) rounded-full blur-3xl opacity-30 -mr-16 -mt-16 pointer-events-none" />
        
        <div className="flex items-center gap-3 text-xs text-(--accent) font-medium mb-3 font-mono">
          <Shield size={14} />
          License Terms
        </div>
        <h2 className="text-xl font-semibold text-(--text) tracking-tight mb-4">
          GNU Affero General Public License (AGPL-3.0)
        </h2>
        
        <div className="space-y-4 text-sm leading-6 text-(--text-muted)">
          <p>
            Optizen is distributed under the <span className="text-(--text) font-semibold">GNU AGPLv3</span>. 
            This is a strong copyleft license designed specifically for network server software to protect user freedom.
          </p>

          <div className="border-l-2 border-(--accent) pl-4 my-6 py-1 space-y-3 bg-(--surface) pr-4">
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-(--text) font-mono mb-1">
                ✓ Free for Personal & Internal Use
              </h3>
              <p className="text-xs text-(--text-muted)">
                You can host Optizen on your own VPS fleets, run it within your company, write custom deployment hooks, 
                and modify the source code however you need for internal operations.
              </p>
            </div>
            <div className="pt-2 border-t border-(--border)">
              <h3 className="text-xs font-semibold tracking-wider text-(--text) font-mono mb-1">
                ✗ Restricted Commercial Closed-Source Repackaging
              </h3>
              <p className="text-xs text-(--text-muted)">
                Under the network interaction clause of the AGPLv3 (Section 13), if you modify Optizen and make it 
                accessible to third-party users over a network (such as selling it as a hosted SaaS, white-labeled control plane, 
                or cloud product), you <span className="text-(--text) font-semibold">must make your modified source code publicly available</span> under the same license.
              </p>
            </div>
          </div>

          <p className="text-xs">
            This prevents companies from taking this open-source orchestrator, wrapping it in a proprietary commercial SaaS platform, 
            and selling it without contributing their changes back to the community.
          </p>

          <div className="pt-4 flex flex-wrap items-center gap-4 border-t border-(--border) mt-6">
            <a 
              href="https://www.gnu.org/licenses/agpl-3.0.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-(--text) hover:text-(--accent) transition-colors border rounded-(--radius) border-(--border) px-3 py-1.5 bg-(--surface) hover:border-(--border-strong)"
            >
              <FileText size={13} />
              Read Full License Text
            </a>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-(--text-muted) hover:underline"
            >
              View GitHub Repository
            </a>
          </div>
        </div>
      </section>

      {/* Back to Homepage */}
      <div className="text-center pt-4 border-t border-(--border)">
        <Link 
          href="/" 
          className="text-xs text-(--text-muted) hover:text-(--text) hover:underline transition-all underline-offset-4"
        >
          ← Return to homepage
        </Link>
      </div>
    </main>
  )
}
