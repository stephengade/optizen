import Link from 'next/link'
import { ArrowRight, BookOpen, FolderGit2, HeartPulse, Layers3, Server, ShieldCheck, Wrench } from 'lucide-react'

const setupSteps = [
  {
    id: 'first-server',
    title: '1. Add a server',
    copy:
      'Create a server record with the host, port, SSH user, and key path that Launchpad can access from the machine where it runs.',
  },
  {
    id: 'first-project',
    title: '2. Model each project clearly',
    copy:
      'Pick the right project source and runtime so Launchpad can explain what the app is, how it deploys, and which files belong to it.',
  },
  {
    id: 'first-health',
    title: '3. Configure a heartbeat',
    copy:
      'Add a health endpoint like `/health` or a port check so a successful deploy is not the only signal you have.',
  },
  {
    id: 'first-files',
    title: '4. Manage env and proxy files safely',
    copy:
      'Use the built-in editors when you need a change preview, remote backup, revision history, and a clear activity trail.',
  },
]

const projectTypes = [
  { label: 'Manual', copy: 'You created the project in Launchpad yourself and control its deploy commands directly.' },
  { label: 'Imported', copy: 'The project came from a server scan and should be reviewed before you rely on the suggested metadata.' },
  { label: 'Compose app', copy: 'Deploys are usually driven by `docker compose` from a working directory on the server.' },
  { label: 'Image app', copy: 'Deploys are driven primarily by pulling or running a container image.' },
  { label: 'Proxy app', copy: 'The project itself behaves like infra, usually around Caddy or Nginx config and runtime.' },
  { label: 'Custom app', copy: 'Use this when your workflow does not fit neatly into compose or image-based assumptions.' },
]

const dailyFlows = [
  {
    title: 'Deploy with confidence',
    copy:
      'Open the project, review the exact commands, confirm the target tag, and watch the live stream. After deploys, Launchpad stores the outcome and refreshes health.',
  },
  {
    title: 'Edit env or proxy files with guardrails',
    copy:
      'Launchpad validates what it can, saves the previous version, creates a remote backup, then writes the live file. If something goes wrong, restore from history.',
  },
  {
    title: 'Use logs and heartbeats together',
    copy:
      'Project logs tell you what the runtime said. Heartbeats tell you whether the service is actually reachable. Use both before deciding a rollout succeeded.',
  },
]

export default function HelpPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 lg:px-8 lg:py-8">
      <section className="rounded-[28px] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(121,188,255,0.12),rgba(104,240,167,0.08)_45%,rgba(16,25,24,0.78))] p-6 lg:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--green)]">Help + Onboarding</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text)] lg:text-5xl">
              Understand Launchpad before you trust it.
            </h1>
            <p className="mt-4 text-base leading-7 text-[var(--text-muted)]">
              Launchpad is a self-hosted control plane for VPS operations. It is strongest when the boundaries are clear:
              servers hold SSH trust, projects define deploy intent, deploys record execution, and infra files remain
              explicit instead of hidden inside shell history.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/servers" className="rounded-[20px] border border-[var(--border)] bg-[rgba(7,16,15,0.38)] p-4 transition-colors hover:bg-[var(--surface-2)]">
              <div className="flex items-center gap-3 text-[var(--text)]">
                <Server size={18} className="text-[var(--green)]" />
                <span className="font-medium">Go to servers</span>
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">Add or review the hosts Launchpad can operate on.</p>
            </Link>
            <Link href="/scan" className="rounded-[20px] border border-[var(--border)] bg-[rgba(7,16,15,0.38)] p-4 transition-colors hover:bg-[var(--surface-2)]">
              <div className="flex items-center gap-3 text-[var(--text)]">
                <BookOpen size={18} className="text-[var(--yellow)]" />
                <span className="font-medium">Open scan workspace</span>
              </div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">Discover running apps and import them with clearer labels.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {setupSteps.map((step) => (
          <div key={step.id} id={step.id} className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-lg font-semibold text-[var(--text)]">{step.title}</div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{step.copy}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center gap-3 text-[var(--text)]">
            <Layers3 size={18} className="text-[var(--blue)]" />
            <h2 className="text-2xl font-semibold">Core model</h2>
          </div>
          <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--text-muted)]">
            <p>
              <span className="font-semibold text-[var(--text)]">Servers</span> represent SSH trust and machine-level
              telemetry. If a server is wrong, everything beneath it is suspect.
            </p>
            <p>
              <span className="font-semibold text-[var(--text)]">Projects</span> represent an application or managed infra
              unit. They should describe deploy commands, runtime type, health expectations, and the important files around them.
            </p>
            <p>
              <span className="font-semibold text-[var(--text)]">Deploys</span> are execution records. They show when a
              change ran, what happened, and whether the service later checked in as healthy.
            </p>
            <p>
              <span className="font-semibold text-[var(--text)]">Infra files</span> stay explicit. Env files, proxy configs,
              compose definitions, and Dockerfiles should be visible enough that another operator can understand the system quickly.
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center gap-3 text-[var(--text)]">
            <ShieldCheck size={18} className="text-[var(--green)]" />
            <h2 className="text-2xl font-semibold">Trust model</h2>
          </div>
          <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--text-muted)]">
            <p>Passwords and passphrases are encrypted at rest.</p>
            <p>SSH private keys are not stored in Launchpad; only file paths are referenced.</p>
            <p>Env and proxy editors create backups and revision history before overwriting live files.</p>
            <p>Deploys now show previews and confirmations before destructive or high-impact actions.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex items-center gap-3 text-[var(--text)]">
          <FolderGit2 size={18} className="text-[var(--yellow)]" />
          <h2 className="text-2xl font-semibold">Project types</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectTypes.map((item) => (
            <div key={item.label} className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <div className="text-base font-semibold text-[var(--text)]">{item.label}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center gap-3 text-[var(--text)]">
            <HeartPulse size={18} className="text-[var(--green)]" />
            <h2 className="text-2xl font-semibold">Recommended configuration</h2>
          </div>
          <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--text-muted)]">
            <p>
              For each project, try to capture a working directory, env path, runtime type, and either a health endpoint
              like <span className="font-mono text-[var(--text)]">/health</span> or a TCP port check.
            </p>
            <p>
              Compose apps work best when the directory is real and stable on the server. Image-based apps work best when
              the image reference is clear and tags are meaningful.
            </p>
            <p>
              If a project also owns reverse proxy behavior, label that explicitly rather than letting it look like a normal app.
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex items-center gap-3 text-[var(--text)]">
            <Wrench size={18} className="text-[var(--blue)]" />
            <h2 className="text-2xl font-semibold">Typical workflows</h2>
          </div>
          <div className="mt-5 space-y-4">
            {dailyFlows.map((flow) => (
              <div key={flow.title} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="text-base font-semibold text-[var(--text)]">{flow.title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{flow.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-2xl font-semibold text-[var(--text)]">Demo mode</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
          Use seeded demo mode from settings when you want believable screenshots without exposing real servers. It swaps the
          main dashboards to safe sample infrastructure, sample deploy history, sample logs, and sample telemetry while keeping
          the product model intact for walkthroughs.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-2xl font-semibold text-[var(--text)]">Quick start checklist</h2>
          <div className="mt-5 space-y-3 text-sm text-[var(--text-muted)]">
            <div>1. Create the master password and log in.</div>
            <div>2. Add a server and immediately run an SSH test.</div>
            <div>3. Add or import a project with the correct type labels.</div>
            <div>4. Review the deploy commands and set a health check.</div>
            <div>5. Use env or proxy editors only when you want backups and activity history.</div>
            <div>6. Run a test deploy before trusting the production flow.</div>
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-2xl font-semibold text-[var(--text)]">Example deploy contract</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            This is the sort of information Launchpad wants for a healthy, legible project:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-[18px] border border-[var(--border)] bg-[#0b0f0f] px-4 py-4 font-mono text-xs text-[var(--text)]">
{`Project: marketing-site
Source: manual
Runtime: compose
Working dir: /var/www/marketing-site
Env path: /var/www/marketing-site/.env
Health endpoint: /health
Deploy commands:
docker compose pull
docker compose up -d`}
          </pre>
        </div>
      </section>

      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--text)]">Where to go next</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Move from orientation into action once the model above makes sense.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/servers" className="inline-flex items-center gap-2 rounded-[16px] border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]">
              Servers
              <ArrowRight size={16} />
            </Link>
            <Link href="/settings" className="inline-flex items-center gap-2 rounded-[16px] border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]">
              Settings
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
