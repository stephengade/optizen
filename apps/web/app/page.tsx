import Link from 'next/link'
import { ArrowRight, Star } from 'lucide-react'

// ─── Data ────────────────────────────────────────────────────────────────────

const features = [
  {
    title: 'Servers',
    copy: 'Store SSH trust once. Optizen keeps the host, user, key path, and connection state in one place — and tests connectivity on demand.',
  },
  {
    title: 'Projects',
    copy: 'Model each app with its runtime type, deploy commands, working directory, env path, and health expectations. No more undocumented deploy notes.',
  },
  {
    title: 'Deploys',
    copy: 'Every deploy is a reviewable, logged execution record. Commands, outcome, live stream, and health result — all stored for rollback.',
  },
  {
    title: 'Infra files',
    copy: 'Env files and proxy configs edited with previews, remote backups, and revision history. No more guessing what changed last week.',
  },
]

const runtimes = [
  {
    label: 'Compose',
    icon: '🐳',
    copy: 'Point Optizen at a working directory. It runs docker compose pull and docker compose up -d — with a live log stream and health check after.',
  },
  {
    label: 'Caddy / Nginx',
    icon: '⚡',
    copy: 'Load the config file, edit it in-browser, preview the diff, save with a backup, and reload the proxy — all without touching the terminal.',
  },
  {
    label: 'Docker image',
    icon: '📦',
    copy: 'Pull a specific image tag or roll back to a previous one. Optizen tracks image history alongside deploy records.',
  },
  {
    label: 'Custom scripts',
    icon: '⚙️',
    copy: 'Any shell commands you\'d normally run over SSH. Write them once, review them before every run, and keep the log forever.',
  },
]

const importSteps = [
  {
    n: '01',
    title: 'Connect a server',
    body: 'Add a host with SSH credentials. Optizen tests connectivity and takes a telemetry snapshot: CPU, RAM, disk, uptime, load average, and container counts.',
  },
  {
    n: '02',
    title: 'Scan or model projects',
    body: 'Run a scan to discover running Docker workloads — Optizen infers the runtime type, working directory, env path, and compose structure. Or model projects manually for full control.',
  },
  {
    n: '03',
    title: 'Configure health checks',
    body: 'Set a health endpoint like /health or a TCP port check per project. After every deploy, Optizen polls it and stores the result alongside the deploy record.',
  },
  {
    n: '04',
    title: 'Deploy with confidence',
    body: 'Review the exact commands, confirm the target, watch the live log stream. Re-auth can be required before any destructive action. Rollback if needed.',
  },
]

const deployTemplate = `name:         api-service
type:         compose
server:       prod-01
working_dir:  /srv/api-service
env_path:     /srv/api-service/.env
health:       GET /health :3000
deploy:
  docker compose pull
  docker compose up -d --remove-orphans`

const envFeatures = [
  'Fetches the live file from the server before editing',
  'Validates syntax before saving',
  'Creates a remote backup before overwriting',
  'Stores revision history — restore any previous version',
  'Logs every change to the activity trail with a timestamp',
]

const trustFeatures = [
  {
    title: 'Re-authentication',
    copy: 'Deploys, rollbacks, deletes, env writes, and proxy reloads can require a fresh password check. Configurable per workspace.',
  },
  {
    title: 'Encrypted credentials',
    copy: 'Passwords and passphrases are encrypted at rest. SSH private keys are never stored — only the path is referenced.',
  },
  {
    title: 'Activity audit trail',
    copy: 'Session elevations, security setting changes, and sensitive value reveals all appear in the security audit log.',
  },
  {
    title: 'Demo privacy mode',
    copy: 'Mask all sensitive values in the UI while screen-sharing or recording — without touching actual data.',
  },
]

const telemetry = [
  'CPU usage %',
  'RAM used / total',
  'Disk used / total',
  'Uptime',
  'Load average (1m / 5m / 15m)',
  'Inode pressure %',
  'Running container count',
  'Exited container count',
  'Project health status',
  'Last heartbeat timestamp',
  'Recent deploy outcomes',
  'Activity timeline',
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main className="min-h-screen bg-(--bg)">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 border-b border-(--border) bg-(--bg) px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <OptizenMark />
            <span className="text-sm font-semibold text-(--text) tracking-tight">Optizen</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/stephengade/optizen"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-(--text-muted) hover:text-(--text) transition-colors"
            >
              <Star size={12} />
              Star on GitHub
            </a>
            <Link
              href="/help"
              className="text-xs text-(--text-muted) hover:text-(--text) transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/login"
              className="inline-flex h-7 items-center gap-1.5 border border-(--border) px-3 text-xs text-(--text-muted) hover:text-(--text) hover:border-(--border-strong) transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <div className="inline-flex items-center gap-2 border border-(--border) px-3 py-1 text-xs text-(--text-muted) mb-6">
          <span className="h-1.5 w-1.5 bg-(--accent)" />
          Open source · AGPL-3.0 · Self-hosted
        </div>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-(--text) lg:text-6xl leading-[1.06]">
          A control plane for your<br />self-hosted VPS fleet.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-(--text-muted)">
          Optizen gives small teams a clear operating model for servers, projects, and deploys.
          SSH trust, runtime health, env files, and proxy config — all visible and under control.
          No cloud dependency. Runs on your own machine.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/setup"
            className="inline-flex h-9 items-center gap-2 bg-(--accent) px-5 text-sm font-semibold text-(--bg) transition-opacity hover:opacity-90"
          >
            Get started free
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/help"
            className="inline-flex h-9 items-center gap-2 border border-(--border) px-5 text-sm text-(--text-muted) transition-colors hover:text-(--text) hover:border-(--border-strong)"
          >
            Read the docs
          </Link>
          <a
            href="https://github.com/stephengade/optizen"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 border border-(--border) px-5 text-sm text-(--text-muted) transition-colors hover:text-(--text) hover:border-(--border-strong)"
          >
            <Star size={13} />
            GitHub
          </a>
        </div>
        <p className="mt-4 text-xs text-(--text-subtle)">No account needed. Self-hosted on your own server.</p>
      </section>

      {/* ── 4-layer model ── */}
      <section className="border-t border-(--border)">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">The model</p>
          <h2 className="mt-3 text-2xl font-semibold text-(--text)">Four layers, clearly separated</h2>
          <p className="mt-2 text-sm text-(--text-muted) max-w-xl">
            Each layer owns its responsibility. Mixing them is how production incidents start.
          </p>
          <div className="mt-8 grid gap-px bg-(--border) border border-(--border) md:grid-cols-2 xl:grid-cols-4">
            {features.map((item) => (
              <div key={item.title} className="bg-(--bg) p-6">
                <div className="text-sm font-semibold text-(--text)">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-(--text-muted)">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Runtime support ── */}
      <section className="border-t border-(--border) bg-(--surface)">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">Runtime support</p>
          <h2 className="mt-3 text-2xl font-semibold text-(--text)">Works with what you already run</h2>
          <p className="mt-2 text-sm text-(--text-muted) max-w-xl">
            Docker Compose, Caddy, Nginx, raw images, and custom scripts. If it runs on your VPS, Optizen can manage it.
          </p>
          <div className="mt-8 grid gap-px bg-(--border) border border-(--border) md:grid-cols-2">
            {runtimes.map((r) => (
              <div key={r.label} className="bg-(--surface) p-6 flex gap-4">
                <span className="text-2xl shrink-0">{r.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-(--text)">{r.label}</div>
                  <p className="mt-1.5 text-sm leading-6 text-(--text-muted)">{r.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-(--border)">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">How it works</p>
          <h2 className="mt-3 text-2xl font-semibold text-(--text)">From SSH key to safe deploy in four steps</h2>
          <div className="mt-8 grid gap-px bg-(--border) border border-(--border) md:grid-cols-2">
            {importSteps.map((s) => (
              <div key={s.n} className="bg-(--bg) p-6 flex gap-5">
                <div className="text-xs font-mono text-(--text-subtle) shrink-0 pt-0.5 w-6">{s.n}</div>
                <div>
                  <div className="text-sm font-semibold text-(--text)">{s.title}</div>
                  <p className="mt-1.5 text-sm leading-6 text-(--text-muted)">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Deploy config template ── */}
      <section className="border-t border-(--border) bg-(--surface)">
        <div className="mx-auto max-w-6xl px-6 py-16 grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">Deploy config</p>
            <h2 className="mt-3 text-2xl font-semibold text-(--text)">Define it once, deploy with confidence</h2>
            <p className="mt-3 text-sm leading-6 text-(--text-muted)">
              Every project has a deploy contract — the exact commands, health check, working directory, and env path.
              Optizen shows you this before every deploy so there are no surprises.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                'Commands are reviewable before execution',
                'Working directory is explicit, not assumed',
                'Health check runs after every deploy',
                'Env path is tracked — editor shows current live value',
                'Full log stream stored per deploy record',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-(--text-muted)">
                  <span className="mt-2 block h-1 w-1 shrink-0 bg-(--accent)" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-(--text-muted) mb-3">Example project config</div>
            <pre className="border border-(--border) bg-(--bg) px-5 py-5 font-mono text-xs text-(--text-muted) overflow-x-auto leading-6">
              {deployTemplate}
            </pre>
          </div>
        </div>
      </section>

      {/* ── Env & proxy editing ── */}
      <section className="border-t border-(--border)">
        <div className="mx-auto max-w-6xl px-6 py-16 grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">Infra file editing</p>
            <h2 className="mt-3 text-2xl font-semibold text-(--text)">Edit env files and proxy config safely</h2>
            <p className="mt-3 text-sm leading-6 text-(--text-muted)">
              Stop editing .env files over raw SSH with no undo. Optizen's built-in editors give you guardrails
              for every write — including Caddy and Nginx config with live reload.
            </p>
            <div className="mt-6 border border-(--border) divide-y divide-(--border)">
              {envFeatures.map((f) => (
                <div key={f} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-2 block h-1 w-1 shrink-0 bg-(--accent)" />
                  <span className="text-sm text-(--text-muted)">{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">Proxy management</p>
            <h2 className="mt-3 text-2xl font-semibold text-(--text)">Caddy and Nginx, in the browser</h2>
            <p className="mt-3 text-sm leading-6 text-(--text-muted)">
              Optizen auto-detects running Caddy and Nginx services. Load the config file, edit it, preview the diff,
              save with a backup, and reload — all from the dashboard.
            </p>
            <div className="mt-6 border border-(--border) bg-(--surface) p-5 font-mono text-xs text-(--text-muted) leading-6">
              <div className="text-(--accent)">$ caddy reload --config /etc/caddy/Caddyfile</div>
              <div className="mt-2 text-(--text-subtle)"># Optizen runs this after validating</div>
              <div className="mt-2"># and backing up the previous version.</div>
              <div className="mt-2 text-(--text)"># Previous: /etc/caddy/Caddyfile.bak.1718200000</div>
              <div className="mt-1 text-(--accent)">✓ Proxy reloaded successfully</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Telemetry ── */}
      <section className="border-t border-(--border) bg-(--surface)">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">Observability</p>
          <h2 className="mt-3 text-2xl font-semibold text-(--text)">Know the state of every server at a glance</h2>
          <p className="mt-2 text-sm text-(--text-muted) max-w-xl">
            Optizen collects a telemetry snapshot every time you test SSH or open the dashboard. No agents, no sidecar processes.
          </p>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 border border-(--border) divide-y md:divide-y-0 bg-(--border) gap-px">
            {telemetry.map((item) => (
              <div key={item} className="bg-(--surface) px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-1 w-1 bg-(--accent)" />
                  <span className="text-sm text-(--text-muted)">{item}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust ── */}
      <section className="border-t border-(--border)">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">Security</p>
          <h2 className="mt-3 text-2xl font-semibold text-(--text)">Trust-first from the ground up</h2>
          <p className="mt-2 text-sm text-(--text-muted) max-w-xl">
            Every dangerous action has a confirmation, a preview, or a re-auth gate. Nothing happens silently.
          </p>
          <div className="mt-8 grid gap-px bg-(--border) border border-(--border) md:grid-cols-2">
            {trustFeatures.map((t) => (
              <div key={t.title} className="bg-(--bg) p-6">
                <div className="text-sm font-semibold text-(--text)">{t.title}</div>
                <p className="mt-1.5 text-sm leading-6 text-(--text-muted)">{t.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Before / After ── */}
      <section className="border-t border-(--border) bg-(--surface)">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.2em] text-(--text-muted)">Why Optizen</p>
          <h2 className="mt-3 text-2xl font-semibold text-(--text)">Replace SSH rituals with a real operator workflow</h2>
          <div className="mt-8 grid gap-px bg-(--border) border border-(--border) md:grid-cols-2">
            <div className="bg-(--surface) p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-(--red) mb-4">Without Optizen</div>
              <ul className="space-y-3">
                {[
                  'Deploy commands live in Slack messages and Notion docs',
                  'Env changes made over SSH with no history',
                  'Proxy reloads done manually, sometimes forgotten',
                  '"Is it healthy?" means checking container state and hoping',
                  'Shell history is the only audit trail',
                  'Rollback means digging through git and guessing',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-(--text-muted)">
                    <span className="mt-2 block h-1 w-1 shrink-0 bg-(--text-subtle)" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-(--bg) p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-(--accent) mb-4">With Optizen</div>
              <ul className="space-y-3">
                {[
                  'Deploy commands are modeled, versioned, and reviewable',
                  'Env edits have previews, backups, and revision history',
                  'Proxy reloads are a dashboard action with validation',
                  'Health checks run automatically after every deploy',
                  'Every dangerous action appears in the audit trail',
                  'Rollback picks a previous deploy record and re-runs it',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-(--text-muted)">
                    <span className="mt-2 block h-1 w-1 shrink-0 bg-(--accent)" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-(--border)">
        <div className="mx-auto max-w-6xl px-6 py-20 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl font-semibold text-(--text)">Ready to stop guessing what's running in production?</h2>
            <p className="mt-3 text-sm text-(--text-muted) max-w-lg">
              Optizen is free, open source, and runs entirely on your own infrastructure. No SaaS, no subscription, no vendor lock-in.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/setup"
              className="inline-flex h-9 items-center gap-2 bg-(--accent) px-5 text-sm font-semibold text-(--bg) transition-opacity hover:opacity-90"
            >
              Get started
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/help"
              className="inline-flex h-9 items-center border border-(--border) px-5 text-sm text-(--text-muted) transition-colors hover:text-(--text)"
            >
              Read docs
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-(--border) px-6 py-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <OptizenMark />
            <div>
              <div className="text-sm font-semibold text-(--text)">Optizen</div>
             
            </div>
            
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-(--text-muted)">
            <Link href="/help" className="hover:text-(--text) transition-colors">Docs</Link>
            <Link href="/help/setup" className="hover:text-(--text) transition-colors">Quick start</Link>
            <Link href="/help/security" className="hover:text-(--text) transition-colors">Security</Link>
            <a
              href="https://github.com/stephengade/optizen"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-(--text) transition-colors flex items-center gap-1"
            >
              <Star size={11} />
              GitHub
            </a>
          </div>
        </div>
         <div className="text-xs max-w-6xl  mx-auto text-(--text-subtle) mt-1">Continuous improvement for your ops.</div>
        <div className="mx-auto max-w-6xl mt-6 pt-6 border-t border-(--border) flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-(--text-subtle)">
            AGPL-3.0 License · Free and open source · Self-hosted, your infrastructure.
          </p>
          <p className="text-xs text-(--text-subtle)">
            Built by{' '}
            <a
              href="https://github.com/stephengade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--text-muted) hover:text-(--text) transition-colors underline underline-offset-2"
            >
              stephengade
            </a>
          </p>
        </div>
      </footer>

    </main>
  )
}

function OptizenMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect width="18" height="18" fill="var(--accent)" />
      <path d="M5 9h8M9 5v8" stroke="var(--bg)" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  )
}
