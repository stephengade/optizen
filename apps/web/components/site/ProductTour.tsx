'use client'

import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Container,
  Database,
  FileCode2,
  Globe,
  HardDrive,
  KeyRound,
  Package,
  Plus,
  Rocket,
  ScanSearch,
  Server,
  Settings,
  ShieldCheck,
  Table2,
} from 'lucide-react'
import { OptizenMark } from '@/components/ui/OptizenMark'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { Meter } from '@/components/ui/Meter'
import { EngineMark } from '@/components/databases/engine'

/**
 * A guided, auto-playing tour of the dashboard for the landing page. Each tab is a faithful
 * picture of one screen, drawn with the app's own components and sample data. The progress bar
 * is a CSS animation: when it ends the next tab opens, hovering pauses it, and with reduced motion
 * it never runs, so nothing advances on its own.
 */

type Nav = 'Servers' | 'Databases' | 'Activity'

const TABS: { id: string; label: string; icon: typeof Server; caption: string; nav: Nav; crumb: string[]; screen: () => React.ReactNode }[] = [
  { id: 'servers', label: 'Servers', icon: Server, caption: 'Every host, its vitals and heartbeat.', nav: 'Servers', crumb: ['Servers'], screen: ServersScreen },
  { id: 'projects', label: 'Projects', icon: Boxes, caption: 'What runs where, and is it healthy.', nav: 'Servers', crumb: ['Servers', 'prod-lagos-01'], screen: ProjectsScreen },
  { id: 'deploys', label: 'Deploys', icon: Rocket, caption: 'Review, run, watch, roll back.', nav: 'Servers', crumb: ['api-service', 'Deploy #128'], screen: DeployScreen },
  { id: 'databases', label: 'Databases', icon: Database, caption: 'Browse tables and run SQL.', nav: 'Databases', crumb: ['Databases', 'shop-db'], screen: DatabaseScreen },
  { id: 'files', label: 'Env & proxy', icon: FileCode2, caption: 'Edit with a diff and a backup.', nav: 'Servers', crumb: ['api-service', '.env'], screen: EnvScreen },
  { id: 'activity', label: 'Activity', icon: ShieldCheck, caption: 'Every change, on the record.', nav: 'Activity', crumb: ['Activity'], screen: ActivityScreen },
]

export function ProductTour() {
  const [active, setActive] = useState(0)
  const tab = TABS[active]
  const Screen = tab.screen

  return (
    <div className="group/tour">
      <div role="tablist" aria-label="Product tour" className="-mx-6 flex snap-x gap-2 overflow-x-auto px-6 pb-1 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0">
        {TABS.map((item, index) => {
          const Icon = item.icon
          const selected = index === active
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="tour-panel"
              onClick={() => setActive(index)}
              className={`relative min-w-40 snap-start overflow-hidden rounded-(--radius) border px-3.5 pt-3 pb-3.5 text-left transition-colors lg:min-w-0 ${
                selected ? 'border-(--border-strong) bg-(--surface-2)' : 'border-(--border) bg-white/[0.015] hover:bg-white/[0.035]'
              }`}
            >
              <span className={`flex items-center gap-2 text-[13.5px] font-medium ${selected ? 'text-(--text)' : 'text-(--text-muted)'}`}>
                <Icon size={15} className={selected ? 'text-(--accent)' : undefined} />
                {item.label}
              </span>
              <span className="mt-1 block text-[12px] leading-snug text-(--text-subtle)">{item.caption}</span>
              {selected && (
                <span
                  key={item.id}
                  onAnimationEnd={() => setActive((index + 1) % TABS.length)}
                  className="tour-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-linear-to-r from-(--accent) to-(--accent-2)"
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="relative mt-5">
        <div className="pointer-events-none absolute -inset-x-10 -top-10 -bottom-20 -z-10 bg-[radial-gradient(closest-side,rgba(124,131,255,0.14),transparent)]" />
        <div className="rounded-[18px] border border-(--border-strong) bg-linear-to-b from-white/[0.06] to-white/[0.01] p-2 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)]">
          <div id="tour-panel" role="tabpanel" aria-label={`${tab.label} screen`} className="overflow-hidden rounded-xl border border-(--border) bg-(--bg)">
            <div aria-hidden="true" className="pointer-events-none grid h-[560px] grid-cols-[200px_1fr] text-left select-none max-md:grid-cols-1">
              <Sidebar active={tab.nav} />
              <div className="flex min-w-0 flex-col">
                <div className="flex h-12 shrink-0 items-center border-b border-(--border) px-6 text-[13px] text-(--text-muted)">
                  {tab.crumb.map((part, index) => (
                    <span key={part} className="flex items-center">
                      {index > 0 && <span className="px-1.5 text-(--text-subtle)">/</span>}
                      <span className={index === tab.crumb.length - 1 ? 'font-medium text-(--text)' : undefined}>{part}</span>
                    </span>
                  ))}
                </div>
                <div key={tab.id} className="fade-in min-h-0 flex-1 overflow-hidden px-6 py-5">
                  <Screen />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-3 text-[12.5px] text-(--text-subtle)">
          <button type="button" aria-label="Previous screen" onClick={() => setActive((active + TABS.length - 1) % TABS.length)} className="grid h-7 w-7 place-items-center rounded-full border border-(--border) hover:bg-white/[0.04] hover:text-(--text)">
            <ChevronLeft size={14} />
          </button>
          <span className="tabular-nums">{active + 1} / {TABS.length}</span>
          <button type="button" aria-label="Next screen" onClick={() => setActive((active + 1) % TABS.length)} className="grid h-7 w-7 place-items-center rounded-full border border-(--border) hover:bg-white/[0.04] hover:text-(--text)">
            <ChevronRight size={14} />
          </button>
          <span className="hidden sm:inline">Sample data. Hover to pause.</span>
        </div>
      </div>
    </div>
  )
}

// ─── Chrome ──────────────────────────────────────────────────────────────────

function Sidebar({ active }: { active: Nav }) {
  const items: { icon: typeof Server; label: string; nav?: Nav }[] = [
    { icon: Server, label: 'Servers', nav: 'Servers' },
    { icon: Database, label: 'Databases', nav: 'Databases' },
    { icon: ScanSearch, label: 'Scan' },
    { icon: HardDrive, label: 'Storage' },
    { icon: Settings, label: 'Settings' },
  ]
  return (
    <aside className="flex flex-col border-r border-(--border) bg-(--bg-subtle) px-2.5 py-3.5 max-md:hidden">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <OptizenMark size={22} />
        <span className="text-[14px] font-semibold tracking-tight text-(--text)">Optizen</span>
      </div>
      {items.map(({ icon: Icon, label, nav }) => {
        const on = nav === active
        return (
          <div key={label} className={`flex items-center gap-2.5 rounded-(--radius-sm) px-2.5 py-[7px] text-[13px] ${on ? 'bg-(--surface-2) text-(--text) shadow-[inset_0_0_0_1px_var(--border)]' : 'text-(--text-muted)'}`}>
            <Icon size={15} className={on ? 'text-(--accent)' : undefined} />
            {label}
          </div>
        )
      })}
      <div className="mt-auto flex items-center gap-2.5 rounded-(--radius-sm) px-2.5 py-[7px] text-[13px] text-(--text-muted)">
        <Activity size={15} className={active === 'Activity' ? 'text-(--accent)' : undefined} />
        <span className={active === 'Activity' ? 'text-(--text)' : undefined}>Activity</span>
      </div>
    </aside>
  )
}

function Title({ children, sub, action }: { children: React.ReactNode; sub: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[21px] font-semibold tracking-[-0.03em] text-(--text)">{children}</div>
        <p className="mt-0.5 text-[13px] text-(--text-muted)">{sub}</p>
      </div>
      {action}
    </div>
  )
}

function Button({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <span className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-(--radius-sm) px-3 text-[12.5px] font-medium ${primary ? 'btn-primary' : 'border border-(--border-strong) bg-white/[0.03] text-(--text)'}`}>
      {children}
    </span>
  )
}

const panel = 'rounded-(--radius-lg) border border-(--border) bg-(--surface)'

// ─── Screens ─────────────────────────────────────────────────────────────────

function ServersScreen() {
  const servers = [
    { name: 'prod-lagos-01', host: 'deploy@203.0.113.10', ms: 38, cpu: 23, mem: 39, disk: 76, projects: 6, tone: 'ok' as StatusTone },
    { name: 'staging-eu-02', host: 'deploy@10.0.4.12', ms: 46, cpu: 8, mem: 30, disk: 45, projects: 5, tone: 'ok' as StatusTone },
    { name: 'workers-us-03', host: 'ops@198.51.100.7', ms: 112, cpu: 71, mem: 82, disk: 54, projects: 3, tone: 'warn' as StatusTone },
  ]
  return (
    <>
      <Title sub="Connected hosts, their health, and what runs on them." action={<Button primary><Plus size={14} />Add server</Button>}>Servers</Title>
      <div className="mt-5 grid gap-3">
        {servers.map((s) => (
          <div key={s.name} className={`${panel} grid grid-cols-[1.3fr_1fr_1fr_1fr_auto] items-center gap-5 px-4.5 py-3 max-lg:grid-cols-[1fr_auto]`}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-(--border) bg-(--surface-3) text-(--text-muted)"><Server size={14} /></div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-(--text)">{s.name}</div>
                <div className="truncate font-mono text-[11.5px] text-(--text-subtle)">{s.host}</div>
              </div>
            </div>
            <div className="max-lg:hidden"><Meter label="CPU" value={`${s.cpu}%`} percent={s.cpu} /></div>
            <div className="max-lg:hidden"><Meter label="Memory" value={`${s.mem}%`} percent={s.mem} /></div>
            <div className="max-lg:hidden"><Meter label="Disk" value={`${s.disk}%`} percent={s.disk} /></div>
            <StatusPill tone={s.tone}>{s.tone === 'ok' ? 'Connected' : 'Slow'}<span className="max-sm:hidden"> · {s.ms} ms</span></StatusPill>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 max-sm:grid-cols-2">
        {[
          ['Projects', '14', '12 healthy · 1 degraded · 1 down'],
          ['Deploys this week', '27', '26 succeeded'],
          ['Last heartbeat', '12s ago', 'every 60 seconds'],
        ].map(([label, value, note], index) => (
          <div key={label} className={`${panel} px-4 py-3.5 ${index === 2 ? 'max-sm:hidden' : ''}`}>
            <div className="text-[12px] text-(--text-muted)">{label}</div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-(--text) tabular-nums">{value}</div>
            <div className="text-[11.5px] text-(--text-subtle)">{note}</div>
          </div>
        ))}
      </div>
    </>
  )
}

function ProjectsScreen() {
  const projects = [
    { name: 'api-service', runtime: 'Compose', icon: Container, health: 'Healthy', tone: 'ok' as StatusTone, deploy: '2h ago · #128' },
    { name: 'web-frontend', runtime: 'Image', icon: Package, health: 'Healthy', tone: 'ok' as StatusTone, deploy: '1d ago · v3.8.1' },
    { name: 'billing-worker', runtime: 'Compose', icon: Container, health: 'Degraded', tone: 'warn' as StatusTone, deploy: '3d ago · #41' },
    { name: 'edge-proxy', runtime: 'Caddy', icon: Globe, health: 'Healthy', tone: 'ok' as StatusTone, deploy: 'config saved 5d ago' },
    { name: 'nightly-backup', runtime: 'Script', icon: KeyRound, health: 'Exited 0', tone: 'neutral' as StatusTone, deploy: 'ran 6h ago' },
  ]
  return (
    <>
      <Title sub="deploy@203.0.113.10 · Ubuntu 24.04 · up 41 days" action={<Button><ScanSearch size={14} />Scan for workloads</Button>}>prod-lagos-01</Title>
      <div className={`${panel} mt-5 overflow-hidden`}>
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1.2fr_auto] gap-4 border-b border-(--border) bg-(--bg-subtle) px-4.5 py-2.5 text-[11.5px] font-medium text-(--text-subtle) max-lg:grid-cols-[1fr_auto]">
          <span>Project</span><span className="max-lg:hidden">Runtime</span><span className="max-lg:hidden">Health</span><span className="max-lg:hidden">Last deploy</span><span />
        </div>
        {projects.map((p) => (
          <div key={p.name} className="grid grid-cols-[1.4fr_1fr_1fr_1.2fr_auto] items-center gap-4 border-b border-(--border) px-4.5 py-3 last:border-b-0 max-lg:grid-cols-[1fr_auto]">
            <span className="flex items-center gap-2.5 text-[13.5px] font-medium text-(--text)"><p.icon size={15} className="text-(--text-muted)" />{p.name}</span>
            <span className="text-[12.5px] text-(--text-muted) max-lg:hidden">{p.runtime}</span>
            <span className="max-lg:hidden"><StatusPill tone={p.tone}>{p.health}</StatusPill></span>
            <span className="text-[12.5px] text-(--text-muted) max-lg:hidden">{p.deploy}</span>
            <span className="flex items-center gap-1 text-[12.5px] text-(--text)">Open <ArrowRight size={13} /></span>
          </div>
        ))}
      </div>
    </>
  )
}

function DeployScreen() {
  const log = [
    ['20:41:02', '$ git pull --ff-only', 'cmd'],
    ['20:41:03', 'Updating 4f2a9c1..b81e07d  Fast-forward', ''],
    ['20:41:03', '$ docker compose pull', 'cmd'],
    ['20:41:06', 'api Pulled ✓   worker Pulled ✓', 'ok'],
    ['20:41:06', '$ docker compose up -d --remove-orphans', 'cmd'],
    ['20:41:10', 'Container api-service-api-1  Started', 'ok'],
    ['20:41:12', '… waiting for GET /health', 'warn'],
    ['20:41:13', '✓ healthy  200 in 84 ms', 'ok'],
  ]
  return (
    <>
      <Title sub="api-service · Docker Compose · prod-lagos-01 · started by owner" action={<StatusPill tone="ok">Succeeded · 11s</StatusPill>}>Deploy #128</Title>
      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px]">
        <div className="rounded-(--radius-lg) border border-(--border) bg-(--code-bg) px-4.5 py-3.5 font-mono text-[12px] leading-[1.95]">
          {log.map(([time, line, kind], index) => (
            <div key={index} className="fade-in whitespace-nowrap" style={{ animationDelay: `${index * 140}ms` }}>
              <span className="mr-3 text-(--text-subtle)">{time}</span>
              <span className={kind === 'cmd' ? 'text-[#a5b4fc]' : kind === 'ok' ? 'text-(--green)' : kind === 'warn' ? 'text-(--yellow)' : 'text-(--text-muted)'}>{line}</span>
            </div>
          ))}
        </div>
        <div className="grid content-start gap-3 max-lg:hidden">
          <div className={`${panel} p-3.5 text-[12.5px]`}>
            <div className="text-(--text-subtle)">Commit</div>
            <div className="mt-1 font-mono text-(--text)">b81e07d</div>
            <div className="mt-0.5 text-(--text-muted)">fix: retry webhook on 502</div>
          </div>
          <div className={`${panel} p-3.5 text-[12.5px]`}>
            <div className="text-(--text-subtle)">Previous</div>
            <div className="mt-1 text-(--text)">#127 · 2 days ago</div>
            <div className="mt-2.5"><Button>Roll back to #127</Button></div>
          </div>
        </div>
      </div>
    </>
  )
}

function DatabaseScreen() {
  const rows = [
    ['1191', 'ada@lovelace.dev', 'paid', '129.00', '2026-11-04 18:22'],
    ['1190', 'ken@unix.dev', 'paid', '49.00', '2026-11-04 17:05'],
    ['1189', 'grace@hopper.io', 'refunded', '240.50', '2026-11-04 15:41'],
    ['1188', 'linus@kernel.org', 'paid', '19.99', '2026-11-04 12:10'],
    ['1187', 'barbara@liskov.net', 'failed', '89.00', '2026-11-04 09:58'],
    ['1186', 'alan@turing.uk', 'paid', '310.00', '2026-11-03 22:47'],
    ['1185', 'margaret@apollo.space', 'paid', '75.25', '2026-11-03 20:13'],
    ['1184', 'dennis@ritchie.c', 'paid', '12.00', '2026-11-03 18:31'],
    ['1183', 'radia@perlman.net', 'refunded', '58.40', '2026-11-03 16:02'],
    ['1182', 'tim@w3.org', 'paid', '199.00', '2026-11-03 11:47'],
  ]
  const status: Record<string, string> = { paid: 'text-(--green)', refunded: 'text-(--blue)', failed: 'text-(--red)' }
  return (
    <div className="-mx-6 -my-5 grid h-[calc(100%+40px)] grid-cols-[170px_1fr] max-sm:grid-cols-1">
      <aside className="border-r border-(--border) p-3 max-sm:hidden">
        <div className="flex items-center gap-2 pb-3">
          <EngineMark engine="postgres" size={24} />
          <div>
            <div className="text-[12.5px] font-medium text-(--text)">shop-db</div>
            <div className="text-[11px] text-(--green)">PostgreSQL 17.2</div>
          </div>
        </div>
        {['customers', 'invoices', 'orders', 'plans', 'sessions', 'webhooks'].map((name) => (
          <div key={name} className={`flex items-center gap-2 rounded-(--radius-sm) px-2 py-[5px] text-[12.5px] ${name === 'orders' ? 'bg-(--surface-2) text-(--text)' : 'text-(--text-muted)'}`}>
            <Table2 size={13} className={name === 'orders' ? 'text-(--accent)' : 'text-(--text-subtle)'} />
            {name}
          </div>
        ))}
      </aside>
      <div className="min-w-0 p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-(--radius-sm) bg-(--surface-2) px-2.5 py-1 text-[12.5px] text-(--text) shadow-[inset_0_0_0_1px_var(--border)]">Data</span>
          <span className="px-2.5 py-1 text-[12.5px] text-(--text-muted)">SQL</span>
          <span className="ml-auto text-[12px] text-(--text-subtle)">public.orders · 23,418 rows</span>
        </div>
        <div className={`${panel} mt-3 overflow-hidden`}>
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead>
              <tr className="border-b border-(--border) bg-(--bg-subtle) text-left text-(--text-muted)">
                {['id ↓', 'email', 'status', 'total', 'created_at'].map((c) => (
                  <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0]} className="border-b border-(--border) last:border-b-0">
                  <td className="px-3 py-[7px] text-[#f5b74f]">{row[0]}</td>
                  <td className="truncate px-3 py-[7px] text-(--text)">{row[1]}</td>
                  <td className={`px-3 py-[7px] ${status[row[2]]}`}>{row[2]}</td>
                  <td className="px-3 py-[7px] text-[#f5b74f]">{row[3]}</td>
                  <td className="px-3 py-[7px] whitespace-nowrap text-(--text-muted)">{row[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-[12px] text-(--text-subtle)">
          <span>Rows 1–50 of 23,418</span>
          <span className="flex gap-1.5"><Button><ChevronLeft size={13} /></Button><Button><ChevronRight size={13} /></Button></span>
        </div>
      </div>
    </div>
  )
}

function EnvScreen() {
  const lines: [string, string, ('add' | 'rm')?][] = [
    ['1', 'NODE_ENV=production'],
    ['2', 'PORT=3000'],
    ['3', '- LOG_LEVEL=debug', 'rm'],
    ['3', '+ LOG_LEVEL=info', 'add'],
    ['4', 'DATABASE_URL=••••••••••••••••••••'],
    ['5', 'REDIS_URL=••••••••••••••'],
    ['6', '+ RATE_LIMIT=120', 'add'],
  ]
  return (
    <>
      <Title sub="/srv/api-service/.env on prod-lagos-01" action={<span className="flex gap-2"><Button>Discard</Button><Button primary>Save & back up</Button></span>}>Environment</Title>
      <div className="mt-5 rounded-(--radius-lg) border border-(--border) bg-(--code-bg) py-3 font-mono text-[12.5px] leading-[1.95] text-(--text-muted)">
        {lines.map(([n, text, kind], index) => (
          <div key={index} className={`px-4.5 whitespace-nowrap ${kind === 'add' ? 'bg-[rgba(74,222,128,0.08)] text-[#86efac]' : kind === 'rm' ? 'bg-[rgba(242,109,109,0.08)] text-[#fca5a5]' : ''}`}>
            <span className="inline-block w-7 text-(--text-subtle)">{n}</span>
            {text}
          </div>
        ))}
      </div>
      <div className={`${panel} mt-3 divide-y divide-(--border) text-[12.5px]`}>
        <div className="flex justify-between px-4 py-2.5"><span className="text-(--text)">2 changes · syntax OK</span><span className="text-(--text-muted)">a backup is kept on the server before saving</span></div>
        <div className="flex justify-between px-4 py-2.5 text-(--text-muted)"><span>Revision 14 · restored</span><span>2 days ago</span></div>
      </div>
    </>
  )
}

function ActivityScreen() {
  const events: { tone: StatusTone; title: string; detail: string; time: string }[] = [
    { tone: 'ok', title: 'Deployed api-service #128', detail: 'prod-lagos-01 · healthy in 84 ms', time: '2h ago' },
    { tone: 'warn', title: 'Ran a write query on shop-db', detail: "update orders set status = 'refunded' where id = 1042", time: '3h ago' },
    { tone: 'info', title: 'Saved /srv/api-service/.env', detail: '2 changes · backup kept on server', time: '5h ago' },
    { tone: 'neutral', title: 'Revealed REDIS_URL', detail: 'after password re-check', time: '5h ago' },
    { tone: 'accent', title: 'Reloaded Caddy', detail: 'edge-proxy · config valid', time: '1d ago' },
    { tone: 'neutral', title: 'Signed in', detail: 'from 102.89.x.x', time: '1d ago' },
  ]
  return (
    <>
      <Title sub="Every deploy, edit, reveal and sign-in, with who and when.">Activity</Title>
      <div className="relative mt-5 grid gap-4 pl-5 before:absolute before:top-1.5 before:bottom-1.5 before:left-[5px] before:w-px before:bg-(--border-strong)">
        {events.map((event) => (
          <div key={event.title} className="relative flex items-start justify-between gap-4">
            <span className={`absolute top-1.5 -left-5 h-[11px] w-[11px] rounded-full border-2 border-(--bg) ${
              event.tone === 'ok' ? 'bg-(--green)' : event.tone === 'warn' ? 'bg-(--yellow)' : event.tone === 'info' ? 'bg-(--blue)' : event.tone === 'accent' ? 'bg-(--accent)' : 'bg-(--text-subtle)'
            }`} />
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium text-(--text)">{event.title}</div>
              <div className="truncate font-mono text-[11.5px] text-(--text-subtle)">{event.detail}</div>
            </div>
            <span className="shrink-0 text-[12px] text-(--text-subtle)">{event.time}</span>
          </div>
        ))}
      </div>
    </>
  )
}
