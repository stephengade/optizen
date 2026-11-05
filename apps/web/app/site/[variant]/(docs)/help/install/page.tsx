import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { GITHUB_REPO_URL } from '@/lib/links'
import { pageMetadata } from '@/lib/site-meta'

export const metadata = pageMetadata('/help/install')

const steps = [
  {
    n: '01',
    title: 'Prepare a server and a domain',
    body: 'Any Linux VPS with Docker and the Compose plugin works. Point a DNS A record for the domain you will use for Optizen at that server, and open ports 80 and 443. Caddy fetches the HTTPS certificate on first start.',
    code: `# on the server\ndocker --version\ndocker compose version`,
  },
  {
    n: '02',
    title: 'Get the code',
    body: 'Clone the repository onto the server and move into it.',
    code: `git clone ${GITHUB_REPO_URL}.git\ncd optizen`,
  },
  {
    n: '03',
    title: 'Create the .env file',
    body: 'Docker Compose reads these values from a .env file in the repository root. Pick a dashboard hostname that is hard to guess. The session secret must be random and kept private: the API refuses to start with a missing or short one.',
    code: `DOMAIN=ops.example.com\nACME_EMAIL=you@example.com\nSESSION_SECRET=<output of: openssl rand -hex 32>`,
  },
  {
    n: '04',
    title: 'Add the SSH keys Optizen will use',
    body: 'Put the private keys for the servers you want to manage in ./ssh. They are mounted read-only into the API container, so in the dashboard you enter paths like /app/ssh/id_ed25519. Keys protected by a passphrase are supported.',
    code: `mkdir -p ssh\ncp ~/.ssh/id_ed25519 ssh/\nchmod 600 ssh/*`,
  },
  {
    n: '05',
    title: 'Build and start',
    body: 'This builds the web app and API and starts them behind Caddy. Your data is stored in ./data, encrypted with the master password you create next.',
    code: `docker compose up -d --build`,
  },
  {
    n: '06',
    title: 'Create your master password',
    body: 'A fresh install prints a one-time setup code to the API log. Open https://<DOMAIN>, enter that code and choose your master password. Without the code nobody else can claim the instance, even if they find the page first. The code changes on every restart. There is no recovery if you lose the password.',
    code: `docker compose logs server | grep "Setup code"
# then open https://ops.example.com`,
  },
]

export default function InstallPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/help" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) transition-colors mb-6">
        <ArrowLeft size={12} />
        Docs
      </Link>

      <h1 className="text-gradient text-[32px] leading-tight font-semibold tracking-[-0.03em]">Install on your server</h1>
      <p className="mt-1 text-sm text-(--text-muted)">
        Run your own Optizen with Docker. Each install is private: its own data, password, and SSH keys.
      </p>

      <div className="mt-6 flex flex-col gap-4 border rounded-(--radius) border-(--accent) bg-(--accent-dim) p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-(--text)">Free and open source. No sign-up, no sign-in.</div>
          <p className="mt-1 text-sm text-(--text-muted)">
            There are no accounts on this site. Get Optizen from GitHub and run your own copy: you sign in to your own dashboard, on your own server.
          </p>
        </div>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 shrink-0 items-center gap-2 btn-primary px-5 text-sm font-semibold"
        >
          Get it on GitHub
          <ArrowUpRight size={14} />
        </a>
      </div>

      <div className="mt-8 border rounded-(--radius) border-(--border) divide-y divide-(--border)">
        {steps.map((step) => (
          <div key={step.n} className="px-5 py-5">
            <div className="flex gap-6">
              <div className="text-xs font-mono text-(--text-muted) w-6 shrink-0 pt-0.5">{step.n}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-(--text)">{step.title}</div>
                <p className="mt-1.5 text-sm leading-6 text-(--text-muted)">{step.body}</p>
                <pre className="mt-3 overflow-x-auto border rounded-(--radius) border-(--border) bg-(--surface) px-4 py-4 font-mono text-xs leading-6 text-(--text-muted)">
{step.code}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border rounded-(--radius) border-(--border) bg-(--surface) p-5">
        <h2 className="text-sm font-semibold text-(--text)">Good to know</h2>
        <div className="mt-3 space-y-2 text-sm leading-6 text-(--text-muted)">
          <p>Optizen backs up its data once a day to ./data/backups (Settings → Backups, where you can also download and restore). Those copies live on the same server, so download one now and then or sync the folder elsewhere. Secrets in a backup stay encrypted: keep the master password safe too.</p>
          <p>The encryption key lives only in memory. After the API container restarts, sign in once before webhook deploys can run.</p>
          <p>Never commit .env, ./ssh, or ./data. All three are already in .gitignore.</p>
          <p>Want to work on Optizen itself instead? See <Link href="/help/get-started" className="text-(--text) underline underline-offset-2">Get started</Link> for local development.</p>
        </div>
      </div>

      <div className="mt-8 border-t border-(--border) pt-6 flex items-center justify-between">
        <p className="text-xs text-(--text-muted)">Next: add your first server and project</p>
        <Link href="/help/setup" className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) border rounded-(--radius) border-(--border) px-3 py-1.5 transition-colors">
          Quick start
          <ArrowLeft size={11} className="rotate-180" />
        </Link>
      </div>
    </div>
  )
}
