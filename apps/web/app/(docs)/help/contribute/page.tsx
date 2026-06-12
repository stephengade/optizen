import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const principles = [
  'Keep changes intentional and easy to review.',
  'Prefer small scoped improvements over broad unrelated edits.',
  'Preserve trust in deploy and server operations by testing risky paths carefully.',
  'Write code that helps the next operator understand what the system is doing.',
]

const workflow = [
  {
    n: '01',
    title: 'Start from your fork',
    body: 'Fork the repository, clone it locally, and sync with the latest upstream changes before starting new work.',
    code: `git clone https://github.com/<your-name>/launchpad.git\ncd launchpad`,
  },
  {
    n: '02',
    title: 'Create a focused branch',
    body: 'Use a branch name that reflects a single feature, fix, or cleanup task so review scope stays clear.',
    code: `git checkout -b feat/server-metrics-docs`,
  },
  {
    n: '03',
    title: 'Run the app locally',
    body: 'Install dependencies, start the web and server apps, and reproduce the problem or verify the feature before editing code.',
    code: `bun install\nbun dev`,
  },
  {
    n: '04',
    title: 'Make the smallest complete change',
    body: 'Try not to mix unrelated refactors into the same contribution. If you notice adjacent issues, capture them separately unless they block the current fix.',
    code: `# edit code, then verify the exact behavior you changed`,
  },
  {
    n: '05',
    title: 'Type-check and sanity-test',
    body: 'At minimum, run type checks and exercise the changed flow manually. For deploy, SSH, file, and telemetry paths, verify the real UI behavior whenever possible.',
    code: `bun run type-check`,
  },
  {
    n: '06',
    title: 'Open a clean pull request',
    body: 'Describe the user problem, the change you made, and how you verified it. Screenshots or short notes about server-side behavior are especially helpful for operational UI changes.',
    code: `git add .\ngit commit -m "docs: add contribution guide"\ngit push origin <branch-name>`,
  },
]

export default function ContributePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/help" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) transition-colors mb-6">
        <ArrowLeft size={12} />
        Docs
      </Link>

      <h1 className="text-xl font-semibold text-(--text)">Contribute</h1>
      <p className="mt-1 text-sm text-(--text-muted)">
        A lightweight guide for making Launchpad better without increasing review or operational risk.
      </p>

      <div className="mt-8 border border-(--border) bg-(--surface) p-5">
        <h2 className="text-sm font-semibold text-(--text)">Contribution principles</h2>
        <div className="mt-3 space-y-2 text-sm leading-6 text-(--text-muted)">
          {principles.map((principle) => (
            <p key={principle}>{principle}</p>
          ))}
        </div>
      </div>

      <div className="mt-8 border border-(--border) divide-y divide-(--border)">
        {workflow.map((step) => (
          <div key={step.n} className="px-5 py-5">
            <div className="flex gap-6">
              <div className="text-xs font-mono text-(--text-muted) w-6 shrink-0 pt-0.5">{step.n}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-(--text)">{step.title}</div>
                <p className="mt-1.5 text-sm leading-6 text-(--text-muted)">{step.body}</p>
                <pre className="mt-3 overflow-x-auto border border-(--border) bg-(--surface) px-4 py-4 font-mono text-xs leading-6 text-(--text-muted)">
{step.code}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border border-(--border) bg-(--surface) p-5">
        <h2 className="text-sm font-semibold text-(--text)">Good pull requests usually include</h2>
        <div className="mt-3 space-y-2 text-sm leading-6 text-(--text-muted)">
          <p>What user or operator problem the change solves.</p>
          <p>Which files or flows were intentionally changed.</p>
          <p>How the change was verified locally.</p>
          <p>Any remaining risks, follow-ups, or assumptions reviewers should know.</p>
        </div>
      </div>

      <div className="mt-8 border-t border-(--border) pt-6 flex items-center justify-between">
        <Link href="/help/get-started" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border border-(--border) px-3 py-1.5 transition-colors">
          <ArrowLeft size={11} />
          Get started
        </Link>
        <Link href="/help/setup" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border border-(--border) px-3 py-1.5 transition-colors">
          Quick start
          <ArrowLeft size={11} className="rotate-180" />
        </Link>
      </div>
    </div>
  )
}
