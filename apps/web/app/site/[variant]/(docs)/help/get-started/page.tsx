import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const steps = [
  {
    n: '01',
    title: 'Fork the repository',
    body: 'Create your own fork on GitHub first if you plan to make changes or keep a private working branch. If you only want to explore locally, you can clone the main repository directly.',
    code: `# in GitHub:\n# click Fork on the Optizen repository`,
  },
  {
    n: '02',
    title: 'Clone your copy',
    body: 'Clone the fork to your machine and move into the project root.',
    code: `git clone https://github.com/<your-name>/launchpad.git\ncd launchpad`,
  },
  {
    n: '03',
    title: 'Install Bun and dependencies',
    body: 'Optizen uses Bun workspaces in a monorepo. Install Bun first, then install repo dependencies once from the root.',
    code: `bun install`,
  },
  {
    n: '04',
    title: 'Create local env files',
    body: 'The web app and API each expect local environment files. Start from the examples when available.',
    code: `cp apps/server/.env.example apps/server/.env\ncp apps/web/.env.example apps/web/.env.local`,
  },
  {
    n: '05',
    title: 'Run the project locally',
    body: 'Start both apps together from the repo root, or run each app separately if you only need one side.',
    code: `# both apps\nbun dev\n\n# or individually\ncd apps/server && bun dev\ncd apps/web && bun dev`,
  },
  {
    n: '06',
    title: 'Open the app and complete first-run setup',
    body: 'Visit the local web app, enter the setup code printed in the API terminal, create the master password, then add a server record and test SSH. Optizen stores encrypted config locally, so your first run sets up that trust boundary.',
    code: `# typical local web URL\nhttp://localhost:3000`,
  },
]

export default function GetStartedPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/help" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) transition-colors mb-6">
        <ArrowLeft size={12} />
        Docs
      </Link>

      <h1 className="text-xl font-semibold text-(--text)">Get started</h1>
      <p className="mt-1 text-sm text-(--text-muted)">
        From fork to a running local Optizen workspace.
      </p>

      <div className="mt-8 border border-(--border) divide-y divide-(--border)">
        {steps.map((step) => (
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
        <h2 className="text-sm font-semibold text-(--text)">Helpful notes</h2>
        <div className="mt-3 space-y-2 text-sm leading-6 text-(--text-muted)">
          <p>Bun is the default package manager and dev runtime used in this repo.</p>
          <p>The web app lives in `apps/web`, the API lives in `apps/server`, and shared types live in `packages/shared`.</p>
          <p>If type-check scripts fail through `bun` locally, verify the install first with a fresh `bun install`.</p>
        </div>
      </div>

      <div className="mt-8 border-t border-(--border) pt-6 flex items-center justify-between">
        <p className="text-xs text-(--text-muted)">Next: complete product setup inside Optizen</p>
        <Link href="/help/setup" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border border-(--border) px-3 py-1.5 transition-colors">
          Quick start
          <ArrowLeft size={11} className="rotate-180" />
        </Link>
      </div>
    </div>
  )
}
