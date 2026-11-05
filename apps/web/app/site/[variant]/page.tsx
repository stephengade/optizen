import Link from 'next/link'
import {
  ArrowRight,
  CircleCheck,
  Container,
  Eye,
  FileCode2,
  Globe,
  History,
  Lock,
  Package,
  Rocket,
  ScanSearch,
  Server,
  ShieldCheck,
  SquareTerminal,
} from 'lucide-react'
import { GITHUB_REPO_URL } from '@/lib/links'
import { SiteFooter, SiteHeader } from '@/components/site/SiteChrome'
import { DashboardPreview } from '@/components/site/DashboardPreview'
import { Meter } from '@/components/ui/Meter'
import { CopyCommand } from '@/components/site/CopyCommand'
import { GithubIcon } from '@/components/site/GithubIcon'
import { StatusPill } from '@/components/ui/StatusPill'

// ─── Content ─────────────────────────────────────────────────────────────────

const stack = [
  { icon: Container, label: 'Docker Compose' },
  { icon: Package, label: 'Docker images' },
  { icon: Globe, label: 'Caddy' },
  { icon: Globe, label: 'Nginx' },
  { icon: SquareTerminal, label: 'Shell scripts' },
  { icon: Lock, label: 'Any Linux server over SSH' },
]

const runtimes = [
  { icon: Container, title: 'Docker Compose', copy: 'Pull and bring the stack up from its working directory.', code: 'docker compose up -d' },
  { icon: Package, title: 'Docker image', copy: 'Pin a tag, track image history and roll back to any earlier one.', code: 'ghcr.io/you/api:2.14.0' },
  { icon: Globe, title: 'Caddy / Nginx', copy: 'Edit config in the browser, preview, back up and reload.', code: 'caddy reload' },
  { icon: SquareTerminal, title: 'Custom scripts', copy: "Any commands you'd run over SSH, written once and reviewed every run.", code: './scripts/release.sh' },
]

const security = [
  { icon: Lock, title: 'Encrypted at rest', copy: 'Passwords and passphrases are encrypted. Private keys are never stored, only their path.' },
  { icon: ShieldCheck, title: 'Re-auth for risky actions', copy: 'Deploys, deletes, env writes and proxy reloads can ask for your password again.' },
  { icon: History, title: 'Full audit trail', copy: 'Every change, reveal and sign-in is recorded with a timestamp.' },
  { icon: Eye, title: 'Privacy mode', copy: 'Blur hosts and secrets while you screen-share or record a demo.' },
]

const steps = [
  { title: 'Install', copy: 'Clone the repo, add a .env and run docker compose on your VPS.' },
  { title: 'Connect a server', copy: 'Add a host with SSH. Optizen tests it and takes a snapshot.' },
  { title: 'Import projects', copy: 'Scan for running workloads or model them by hand.' },
  { title: 'Deploy calmly', copy: 'Review, run, watch the log, roll back if needed.' },
]

const faqs = [
  { q: 'Is Optizen really free?', a: "Yes. It's open source under AGPL-3.0. There's no paid tier, no account and no usage limit." },
  { q: 'Where does it run?', a: 'On any Linux server with Docker, including the same VPS you manage. It reaches your other servers over SSH.' },
  { q: 'Do I need an agent on my servers?', a: 'No. Optizen uses plain SSH and the tools already on the box, like Docker and your proxy.' },
  { q: 'How are my credentials protected?', a: 'Secrets are encrypted at rest with your master password, sign-in is rate-limited, and risky actions can ask for your password again.' },
  { q: 'Can I contribute?', a: 'Please do. Issues, docs and pull requests are all welcome on GitHub.' },
]

const deployLog: { t: string; line: React.ReactNode }[] = [
  { t: '20:41:02', line: <><span className="text-[#a5b4fc]">$</span> docker compose pull</> },
  { t: '20:41:05', line: <>api Pulled <span className="text-(--green)">✓</span></> },
  { t: '20:41:05', line: <>worker Pulled <span className="text-(--green)">✓</span></> },
  { t: '20:41:06', line: <><span className="text-[#a5b4fc]">$</span> docker compose up -d --remove-orphans</> },
  { t: '20:41:09', line: <>Container api-service-api-1 <span className="text-(--green)">Started</span></> },
  { t: '20:41:10', line: <>Container api-service-worker-1 <span className="text-(--green)">Started</span></> },
  { t: '20:41:12', line: <><span className="text-(--yellow)">…</span> waiting for GET /health</> },
  { t: '20:41:13', line: <><span className="text-(--green)">✓ healthy</span> 200 in 84 ms <span className="blink inline-block h-3.5 w-[7px] translate-y-0.5 bg-(--accent)" /></> },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function Home({ params }: { params: Promise<{ variant: string }> }) {
  // Optizen is self-hosted: there is no sign-up. Every call to action sends people to GitHub (or
  // the install guide), never to this instance's setup page. The public host also never links to
  // sign-in; it offers the GitHub download in that spot instead.
  const publicSite = (await params).variant === 'public'

  return (
    <main className="min-h-screen bg-(--bg)">
      <SiteHeader publicSite={publicSite} />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-24 text-center">
        <div className="hero-glow" />
        <div className="hero-grid" />
        <div className="relative mx-auto max-w-290 px-6">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-(--border-strong) bg-white/[0.03] py-1.5 pr-1.5 pl-3.5 text-[12.5px] text-(--text-muted)">
            Open source · AGPL-3.0 · Self-hosted
            <b className="rounded-full bg-(--surface-3) px-2.5 py-0.5 text-[11.5px] font-medium text-(--text)">Free</b>
          </span>
          <h1 className="text-gradient mx-auto mt-6.5 max-w-215 text-[44px] leading-[1.02] font-semibold tracking-[-0.045em] sm:text-[68px]">
            The control plane for your self-hosted servers.
          </h1>
          <p className="mx-auto mt-5.5 max-w-145 text-[17px] leading-relaxed text-(--text-muted)">
            Servers, deploys, env files and proxy configs in one calm dashboard. Runs on your own VPS. No cloud account, no lock-in.
          </p>
          <div className="mt-8.5 flex flex-wrap justify-center gap-3">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex h-10 items-center gap-2 rounded-(--radius-sm) px-4.5 text-[13.5px] font-medium">
              <GithubIcon size={15} />
              Get it free on GitHub
            </a>
            <Link href="/help/install" className="inline-flex h-10 items-center gap-2 rounded-(--radius-sm) border border-(--border-strong) bg-white/[0.03] px-4.5 text-[13.5px] font-medium text-(--text) transition-colors hover:bg-white/[0.06]">
              How to install
              <ArrowRight size={15} />
            </Link>
          </div>
          <p className="mt-4 text-[12.5px] text-(--text-subtle)">No sign-up. Clone it and run it on your own server.</p>

          {/* Product frame */}
          <div className="mx-auto mt-18 max-w-270 rounded-[18px] border border-(--border-strong) bg-linear-to-b from-white/[0.06] to-white/[0.01] p-2 shadow-[0_-20px_80px_-20px_rgba(124,131,255,0.35),0_40px_100px_-30px_rgba(0,0,0,0.9)] [mask-image:linear-gradient(#000_70%,transparent)]">
            <div className="overflow-hidden rounded-xl border border-(--border) bg-(--bg) [zoom:0.78] max-md:[zoom:0.6]">
              <DashboardPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stack strip ── */}
      <section className="px-6 pt-16 pb-2 text-center">
        <p className="text-[13px] text-(--text-subtle)">Works with the stack you already run</p>
        <div className="mt-5.5 flex flex-wrap justify-center gap-3">
          {stack.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex h-10 items-center gap-2.5 rounded-full border border-(--border) bg-white/[0.015] px-4 text-[13.5px] text-(--text-muted)">
              <Icon size={15} className="text-(--text)" />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ── Feature bento ── */}
      <Section id="features">
        <Eyebrow>What it does</Eyebrow>
        <H2>Everything you SSH in for, without SSHing in.</H2>
        <Sub>Four layers, each with a clear job: servers, projects, deploys and infra files.</Sub>
        <div className="mt-12 grid gap-3.5 md:grid-cols-6">
          <Card className="md:col-span-4" icon={Rocket} title="Reviewable deploys" copy="See the exact commands before they run, watch the live log, and keep every run on record with its health result.">
            <pre className="mt-5.5 overflow-x-auto rounded-(--radius) border border-(--border) bg-(--code-bg) px-4.5 py-4 text-[12.5px] leading-[1.75] text-(--text-muted)">
              <span className="text-(--text-subtle)"># api-service · compose · prod-lagos-01</span>{'\n'}
              <span className="text-[#a5b4fc]">$</span> docker compose pull{'\n'}
              <span className="text-[#a5b4fc]">$</span> docker compose up -d --remove-orphans{'\n'}
              <span className="text-(--green)">✓ healthy</span> GET /health 200 in 84 ms
            </pre>
          </Card>
          <Card className="md:col-span-2" icon={Server} title="Fleet at a glance" copy="CPU, memory, disk, load and uptime for every host, with a heartbeat you can trust." />
          <Card className="md:col-span-2" icon={FileCode2} title="Safe infra edits" copy="Edit .env and Caddy or Nginx config with a diff preview, remote backup and revision history." />
          <Card className="md:col-span-2" icon={ShieldCheck} title="Built for trust" copy="Re-auth before risky actions, encrypted secrets, rate-limited sign-in and a full audit trail." />
          <Card className="md:col-span-2" icon={ScanSearch} title="Discover what's running" copy="Scan a server to find Docker workloads and import them as projects in a click." />
        </div>
      </Section>

      {/* ── Deep dives ── */}
      <Section>
        <Split
          eyebrow="Deploys"
          title="Every deploy, reviewed and on record."
          copy="Optizen shows the exact commands before they run, streams the log as it happens and checks health when it's done."
          points={['Confirm the target and commands before anything runs', 'Live log stream, kept with the deploy record', 'Health check after every run, with rollback']}
        >
          <Visual title="Deploy · api-service · prod-lagos-01" badge={<StatusPill tone="info" pulse>Running</StatusPill>}>
            <div className="rounded-(--radius) border border-(--border) bg-(--code-bg) px-4.5 py-4 font-mono text-[12.5px] leading-[1.9] text-(--text-muted)">
              {deployLog.map((row, i) => (
                <div key={i} className="whitespace-nowrap"><span className="mr-3 text-(--text-subtle)">{row.t}</span>{row.line}</div>
              ))}
            </div>
          </Visual>
        </Split>

        <Split
          reverse
          eyebrow="Infra files"
          title="Edit .env and proxy config without fear."
          copy="Optizen fetches the live file, shows a diff before saving and keeps a backup on the server, so a typo is never a mystery."
          points={['Diff preview and syntax check before every save', 'Remote backup and full revision history', 'Reload Caddy or Nginx from the browser']}
        >
          <Visual title="/srv/api-service/.env" badge={<StatusPill dot={false}>2 changes</StatusPill>}>
            <div className="rounded-(--radius) border border-(--border) bg-(--code-bg) py-3 font-mono text-[12.5px] leading-[1.9] text-(--text-muted)">
              <DiffLine n={1}>NODE_ENV=production</DiffLine>
              <DiffLine n={2}>PORT=3000</DiffLine>
              <DiffLine n={3} kind="rm">- LOG_LEVEL=debug</DiffLine>
              <DiffLine n={3} kind="add">+ LOG_LEVEL=info</DiffLine>
              <DiffLine n={4}>DATABASE_URL=••••••••••••••••</DiffLine>
              <DiffLine n={5} kind="add">+ RATE_LIMIT=120</DiffLine>
            </div>
            <div className="mt-2 grid gap-px overflow-hidden rounded-(--radius) border border-(--border) bg-(--border) text-[12.5px] text-(--text-muted)">
              <div className="flex justify-between bg-(--surface) px-3.5 py-2.5"><b className="font-medium text-(--text)">Saved by owner</b><span>just now · backup kept on server</span></div>
              <div className="flex justify-between bg-(--surface) px-3.5 py-2.5"><span>Restored revision 14</span><span>2 days ago</span></div>
            </div>
          </Visual>
        </Split>

        <Split
          eyebrow="Observability"
          title="Know how your fleet is doing at a glance."
          copy="Each server reports its vitals on a heartbeat, and each project its health, so problems surface before your users notice."
          points={['CPU, memory, disk, inodes, load and uptime', 'Running and exited containers per host', 'Activity timeline of every change and deploy']}
        >
          <Visual title="prod-lagos-01" badge={<StatusPill tone="ok">Connected · 38 ms</StatusPill>}>
            <div className="grid grid-cols-2 gap-2 rounded-(--radius) border border-(--border) bg-(--code-bg) p-2.5 sm:grid-cols-3">
              <Tile label="CPU" value="23%"><Meter percent={23} /></Tile>
              <Tile label="Memory" value="3.1 GB"><Meter percent={39} /></Tile>
              <Tile label="Disk" value="76%"><Meter percent={76} /></Tile>
              <Tile label="Load (1m)" value="0.42" />
              <Tile label="Containers" value={<>14 <span className="text-[13px] text-(--text-subtle)">/ 1 exited</span></>} />
              <Tile label="Uptime" value="41d" />
            </div>
          </Visual>
        </Split>
      </Section>

      {/* ── Runtimes ── */}
      <Section>
        <Eyebrow>Runtimes</Eyebrow>
        <H2>Whatever you deploy, it fits.</H2>
        <Sub>Each project picks a runtime. Optizen knows what to run and what to check afterwards.</Sub>
        <div className="mt-12 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {runtimes.map((r) => (
            <Card key={r.title} icon={r.icon} title={r.title} copy={r.copy}>
              <code className="mt-4 block border-t border-(--border) pt-3.5 text-[11.5px] text-(--text-subtle)">{r.code}</code>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── Security ── */}
      <Section>
        <div className="grid gap-14 rounded-[20px] border border-(--border) bg-[radial-gradient(600px_300px_at_0%_0%,rgba(124,131,255,0.12),transparent_70%),linear-gradient(180deg,var(--surface),var(--bg))] p-7 sm:p-14 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <Eyebrow>Security</Eyebrow>
            <H2>Your servers. Your data. Your rules.</H2>
            <Sub>Optizen runs on your own machine and talks to your servers over SSH. Nothing is sent anywhere else.</Sub>
            <Link href="/help/security" className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-(--accent) hover:underline underline-offset-4">
              How Optizen protects you <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {security.map(({ icon: Icon, title, copy }) => (
              <div key={title}>
                <h4 className="flex items-center gap-2.5 text-[14.5px] font-semibold text-(--text)"><Icon size={16} className="text-(--accent)" />{title}</h4>
                <p className="mt-2 text-[13.5px] leading-relaxed text-(--text-muted)">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Get started ── */}
      <Section>
        <Eyebrow>Get started</Eyebrow>
        <H2>Up and running in four steps.</H2>
        <div className="mt-12 grid border-t border-(--border) sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="pt-6.5 pr-6">
              <div className="font-mono text-xs text-(--text-subtle)">{String(i + 1).padStart(2, '0')}</div>
              <h4 className="mt-3.5 text-[15px] font-semibold text-(--text)">{s.title}</h4>
              <p className="mt-2 text-[13.5px] leading-relaxed text-(--text-muted)">{s.copy}</p>
            </div>
          ))}
        </div>
        <div className="mt-12">
          <CopyCommand command={`git clone ${GITHUB_REPO_URL}.git && cd optizen`} />
          <p className="mt-3 text-[13px] text-(--text-subtle)">
            Then follow the <Link href="/help/install" className="text-(--text-muted) underline underline-offset-4 hover:text-(--text)">install guide</Link> to add your .env and start it.
          </p>
        </div>
      </Section>

      {/* ── FAQ ── */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <H2>Questions, answered.</H2>
            <Sub>
              Something else?{' '}
              <a href={`${GITHUB_REPO_URL}/issues`} target="_blank" rel="noopener noreferrer" className="text-(--text) underline underline-offset-4">Open an issue on GitHub</a>.
            </Sub>
          </div>
          <div className="border-t border-(--border)">
            {faqs.map((f, i) => (
              <details key={f.q} open={i === 0} className="group border-b border-(--border) py-5.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-(--text) [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-xl leading-none text-(--text-subtle) transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-180 text-[14.5px] leading-relaxed text-(--text-muted)">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden border-t border-(--border) py-28 text-center">
        <div className="pointer-events-none absolute -bottom-50 left-1/2 h-100 w-200 -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(124,131,255,0.25),transparent)]" />
        <div className="relative px-6">
          <h2 className="mx-auto max-w-175 text-4xl font-semibold tracking-[-0.035em] text-(--text) sm:text-5xl">Own your servers again.</h2>
          <p className="mx-auto mt-4 max-w-135 text-base leading-relaxed text-(--text-muted)">Free and open source. No account, no telemetry.</p>
          <div className="mt-8.5 flex flex-wrap justify-center gap-3">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex h-10 items-center gap-2 rounded-(--radius-sm) px-4.5 text-[13.5px] font-medium">
              <GithubIcon size={15} />
              Get it free on GitHub
            </a>
            <Link href="/help" className="inline-flex h-10 items-center gap-2 rounded-(--radius-sm) border border-(--border-strong) bg-white/[0.03] px-4.5 text-[13.5px] font-medium text-(--text) transition-colors hover:bg-white/[0.06]">
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function Section({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16 border-t border-(--border) py-24 sm:py-28 first-of-type:border-t-0">
      <div className="mx-auto max-w-290 px-6">{children}</div>
    </section>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[12.5px] font-medium tracking-wide text-(--accent)">{`// ${children}`}</div>
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3.5 max-w-155 text-[32px] leading-[1.1] font-semibold tracking-[-0.035em] text-(--text) sm:text-[40px]">{children}</h2>
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="mt-3.5 max-w-135 text-base leading-relaxed text-(--text-muted)">{children}</p>
}

function Card({ icon: Icon, title, copy, className = '', children }: { icon: typeof Server; title: string; copy: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={`card p-6.5 ${className}`}>
      <div className="grid h-9 w-9 place-items-center rounded-[9px] border border-(--accent-border) bg-(--accent-dim) text-(--accent)">
        <Icon size={16} />
      </div>
      <h3 className="mt-4.5 text-[15.5px] font-semibold tracking-tight text-(--text)">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-(--text-muted)">{copy}</p>
      {children}
    </div>
  )
}

function Split({ eyebrow, title, copy, points, reverse, children }: { eyebrow: string; title: string; copy: string; points: string[]; reverse?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16 [&+&]:mt-28">
      <div className={reverse ? 'lg:order-2' : undefined}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <H2>{title}</H2>
        <Sub>{copy}</Sub>
        <ul className="mt-6.5 grid gap-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-[14.5px] text-(--text-muted)">
              <CircleCheck size={16} className="mt-0.5 shrink-0 text-(--accent)" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Visual({ title, badge, children }: { title: string; badge: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative isolate rounded-2xl border border-(--border-strong) bg-linear-to-b from-(--surface) to-(--bg-subtle) p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
      <div className="absolute -inset-10 -z-10 bg-[radial-gradient(closest-side,rgba(124,131,255,0.16),transparent)]" />
      <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-3 text-[12.5px] text-(--text-muted)">
        <span className="flex gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-(--surface-3)" />
          <i className="h-2.5 w-2.5 rounded-full bg-(--surface-3)" />
          <i className="h-2.5 w-2.5 rounded-full bg-(--surface-3)" />
        </span>
        <span className="truncate">{title}</span>
        <span className="ml-auto">{badge}</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function DiffLine({ n, kind, children }: { n: number; kind?: 'add' | 'rm'; children: React.ReactNode }) {
  const tone = kind === 'add' ? 'bg-[rgba(74,222,128,0.08)] text-[#86efac]' : kind === 'rm' ? 'bg-[rgba(242,109,109,0.08)] text-[#fca5a5]' : ''
  return (
    <div className={`px-4.5 whitespace-nowrap ${tone}`}>
      <span className="inline-block w-6.5 text-(--text-subtle)">{n}</span>
      {children}
    </div>
  )
}

function Tile({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-(--radius) border border-(--border) bg-(--surface) p-3.5">
      <div className="text-xs text-(--text-muted)">{label}</div>
      <div className="mt-1.5 mb-1 text-xl font-semibold tracking-[-0.02em] text-(--text) tabular-nums">{value}</div>
      {children}
    </div>
  )
}
