'use client'

import Link from 'next/link'
import { ArrowLeft, GitPullRequest, Terminal, Heart } from 'lucide-react'

const principles = [
  {
    title: 'Focus and Simplicity',
    copy: 'Keep changes intentional and easy to review. Prefer small, highly targeted improvements over broad, unrelated edits.'
  },
  {
    title: 'Maintain Operational Safety',
    copy: 'Preserve absolute trust in deploy, SSH credentials, and server operations by testing sensitive paths carefully.'
  },
  {
    title: 'Self-Documentation',
    copy: 'Write clean code and comment complex blocks so the next operator or developer can understand what the system is doing under pressure.'
  }
]

const workflow = [
  {
    n: '01',
    title: 'Fork and clone',
    body: 'Fork the repository on GitHub, then clone your fork locally to get started.',
    code: `git clone https://github.com/<your-username>/optizen.git\ncd optizen`,
  },
  {
    n: '02',
    title: 'Create a focused branch',
    body: 'Use a branch name that reflects a single feature, bugfix, or docs task.',
    code: `git checkout -b feat/your-feature-name`,
  },
  {
    n: '03',
    title: 'Start local environment',
    body: 'Install all monorepo dependencies and boot both the client and server services concurrently using Bun.',
    code: `bun install\nbun dev`,
  },
  {
    n: '04',
    title: 'Make your edits',
    body: 'Ensure code modifications respect existing styling and logic. Do not mix unrelated cleanups or package updates.',
    code: `# edit files in apps/web, apps/server, or packages/shared`,
  },
  {
    n: '05',
    title: 'Run diagnostics & verify',
    body: 'At minimum, verify that all TS checks compile and test your changed workflows manually in the browser.',
    code: `bun run type-check`,
  },
  {
    n: '06',
    title: 'Submit pull request',
    body: 'Push your changes to your fork and submit a pull request explaining the problem, solution, and manual verification steps.',
    code: `git add .\ngit commit -m "feat: short description"\ngit push origin your-branch-name`,
  },
]

export default function ContributePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Back button */}
      <Link 
        href="/help" 
        className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) transition-colors mb-6 font-mono"
      >
        <ArrowLeft size={12} />
        BACK TO DOCS
      </Link>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-(--text) tracking-tight">Contributing Guidelines</h1>
        <p className="mt-2 text-sm text-(--text-muted) max-w-xl">
          Optizen is built by and for the self-hosted community. Learn how to run the codebase locally, test changes, and submit pull requests safely.
        </p>
      </div>

      {/* Principles */}
      <section className="mb-12">
        <h2 className="text-sm font-semibold text-(--text) uppercase tracking-wider mb-4 font-mono flex items-center gap-2">
          <Heart size={14} className="text-(--accent)" />
          Contribution Principles
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {principles.map((p) => (
            <div key={p.title} className="border border-(--border) bg-(--surface) p-5">
              <h3 className="text-xs font-semibold text-(--text) mb-1.5">{p.title}</h3>
              <p className="text-xs leading-5 text-(--text-muted)">{p.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Development Steps */}
      <section className="mb-12">
        <h2 className="text-sm font-semibold text-(--text) uppercase tracking-wider mb-4 font-mono flex items-center gap-2">
          <Terminal size={14} className="text-(--accent)" />
          Setup & Workflow
        </h2>
        <div className="border border-(--border) divide-y divide-(--border)">
          {workflow.map((step) => (
            <div key={step.n} className="p-6">
              <div className="flex gap-5">
                <div className="text-xs font-mono text-(--text-subtle) w-6 shrink-0 pt-0.5">{step.n}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-(--text)">{step.title}</div>
                  <p className="mt-1.5 text-xs leading-5 text-(--text-muted)">{step.body}</p>
                  <pre className="mt-3 overflow-x-auto border border-(--border) bg-(--bg) px-4 py-3 font-mono text-xs leading-6 text-(--text-muted)">
{step.code}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pull Request Guide */}
      <section className="border border-(--border) bg-(--bg-subtle) p-6 md:p-8 mb-12">
        <h2 className="text-sm font-semibold text-(--text) uppercase tracking-wider mb-3 font-mono flex items-center gap-2">
          <GitPullRequest size={14} className="text-(--accent)" />
          Pull Request Checklist
        </h2>
        <p className="text-xs text-(--text-muted) leading-6 mb-4">
          A high-quality pull request makes merging fast and painless. Please make sure to include:
        </p>
        <ul className="space-y-2 text-xs text-(--text-muted)">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 block h-1 w-1 shrink-0 bg-(--accent)" />
            A clear explanation of the user or operator problem being solved.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 block h-1 w-1 shrink-0 bg-(--accent)" />
            A list of files or configurations that were changed.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 block h-1 w-1 shrink-0 bg-(--accent)" />
            Description of how the behavior was verified locally (screenshots or recordings are highly welcome).
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 block h-1 w-1 shrink-0 bg-(--accent)" />
            Any operational risks, migrations, or database changes introduced.
          </li>
        </ul>
      </section>

      {/* Footer Return */}
      <div className="text-center pt-4 border-t border-(--border)">
        <Link 
          href="/help" 
          className="text-xs text-(--text-muted) hover:text-(--text) hover:underline transition-all underline-offset-4"
        >
          ← Return to documentation
        </Link>
      </div>
    </div>
  )
}
