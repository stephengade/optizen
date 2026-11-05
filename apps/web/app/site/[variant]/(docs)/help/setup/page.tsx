import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const steps = [
  {
    n: '01',
    title: 'Create a master password',
    body: 'On first run, Optizen prompts you to set a master password. This encrypts all credentials stored on disk. Keep it somewhere safe — there is no recovery path.',
  },
  {
    n: '02',
    title: 'Add a server',
    body: 'Go to Servers and add a host with the SSH user, port, and key path. Use a dedicated deploy user when possible. Optizen never stores your private key — only the path.',
  },
  {
    n: '03',
    title: 'Test the SSH connection',
    body: 'After saving, click "Test SSH". This confirms Optizen can reach the machine and pulls a telemetry snapshot. If it fails, check the key path and user permissions first.',
  },
  {
    n: '04',
    title: 'Add a project',
    body: 'Open the server and add a project. Choose the right type (compose, image, custom, etc.), set the working directory, and write out the exact deploy commands.',
  },
  {
    n: '05',
    title: 'Configure a health check',
    body: 'Add a health endpoint like /health or a TCP port check. This gives you a signal beyond "container is running" — Optizen polls it after every deploy.',
  },
  {
    n: '06',
    title: 'Run a test deploy',
    body: 'Review the command preview, confirm the target, and watch the live log stream. Check the health status after it finishes. If everything is green, you are ready for production.',
  },
]

export default function SetupPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/help" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) transition-colors mb-6">
        <ArrowLeft size={12} />
        Docs
      </Link>

      <h1 className="text-xl font-semibold text-(--text)">Quick start</h1>
      <p className="mt-1 text-sm text-(--text-muted)">Six steps from zero to a working deploy.</p>

      <div className="mt-8 border border-(--border) divide-y divide-(--border)">
        {steps.map((step) => (
          <div key={step.n} className="flex gap-6 px-5 py-5">
            <div className="text-xs font-mono text-(--text-muted) w-6 shrink-0 pt-0.5">{step.n}</div>
            <div>
              <div className="text-sm font-semibold text-(--text)">{step.title}</div>
              <p className="mt-1.5 text-sm leading-6 text-(--text-muted)">{step.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-(--text) mb-3">Example project config</h2>
        <pre className="border border-(--border) bg-(--surface) px-5 py-5 font-mono text-xs text-(--text-muted) overflow-x-auto leading-6">
{`name:         marketing-site
type:         compose
working_dir:  /var/www/marketing-site
env_path:     /var/www/marketing-site/.env
health:       GET /health
deploy:
  docker compose pull
  docker compose up -d`}
        </pre>
      </div>

      <div className="mt-8 border-t border-(--border) pt-6 flex items-center justify-between">
        <Link href="/help/server-metrics" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border border-(--border) px-3 py-1.5 transition-colors">
          Server metrics
          <ArrowLeft size={11} className="rotate-180" />
        </Link>
        <Link href="/help/projects" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border border-(--border) px-3 py-1.5 transition-colors">
          Project types
          <ArrowLeft size={11} className="rotate-180" />
        </Link>
      </div>
    </div>
  )
}
