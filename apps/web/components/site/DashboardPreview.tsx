import { ArrowRight, BookOpen, Boxes, Clock, HardDrive, Activity, Plus, Rocket, ScanSearch, Search, Server, Settings, ShieldCheck } from 'lucide-react'
import { OptizenLogo } from '@/components/ui/OptizenMark'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { Meter } from '@/components/ui/Meter'

/** A static picture of the dashboard for the landing page hero. Sample data only. */
export function DashboardPreview() {
  return (
    <div aria-hidden="true" className="pointer-events-none grid h-[640px] grid-cols-[220px_1fr] text-left select-none max-md:grid-cols-1">
      <aside className="flex flex-col border-r border-(--border) bg-(--bg-subtle) px-2.5 py-3.5 max-md:hidden">
        <OptizenLogo className="px-2 pb-4" />
        <div className="mx-1 mb-3.5 flex items-center justify-between rounded-(--radius-sm) border border-(--border) bg-(--surface) px-2.5 py-2 text-[12.5px] text-(--text-muted)">
          <span className="flex items-center gap-2"><Search size={14} />Search or jump to…</span>
          <kbd className="rounded-[5px] border border-(--border-strong) px-1.5 text-[11px] text-(--text-subtle)">⌘K</kbd>
        </div>
        <NavGroup>Workspace</NavGroup>
        <NavItem icon={Server} active count="3">Servers</NavItem>
        <NavItem icon={ScanSearch}>Scan</NavItem>
        <NavItem icon={HardDrive}>Storage</NavItem>
        <NavItem icon={Settings}>Settings</NavItem>
        <NavGroup>Resources</NavGroup>
        <NavItem icon={BookOpen}>Docs</NavItem>
        <NavItem icon={ShieldCheck}>Activity</NavItem>
      </aside>

      <div className="min-w-0 overflow-hidden">
        <div className="flex h-14 items-center justify-between border-b border-(--border) px-7 text-[13px] text-(--text-muted)">
          <span>Workspace <span className="text-(--text-subtle)">/</span> <b className="font-medium text-(--text)">Servers</b></span>
          <span className="flex gap-2">
            <span className="inline-flex h-[30px] items-center gap-1.5 rounded-(--radius-sm) border border-(--border-strong) bg-white/[0.03] px-3 text-[12.5px] text-(--text)"><ScanSearch size={14} />Scan</span>
            <span className="btn-primary inline-flex h-[30px] items-center gap-1.5 rounded-(--radius-sm) px-3 text-[12.5px] font-medium"><Plus size={14} />Add server</span>
          </span>
        </div>
        <div className="px-7 pt-8">
          <div className="text-[26px] font-semibold tracking-[-0.03em] text-(--text)">Servers</div>
          <p className="mt-1 text-sm text-(--text-muted)">Connected hosts, their health, and what runs on them.</p>

          <div className="mt-7 grid grid-cols-4 gap-3 max-md:grid-cols-2">
            <Stat icon={Server} label="Servers online" value={<>3 <span className="text-lg text-(--text-subtle)">/ 3</span></>} note="All reachable · 42 ms avg" good />
            <Stat icon={Boxes} label="Projects" value="11" note="9 healthy · 1 degraded · 1 down" />
            <Stat icon={Rocket} label="Deploys this week" value="27" spark />
            <Stat icon={Activity} label="Success rate" value="96.3%" note="+2.1% vs last week" good />
          </div>

          <div className="mt-9 mb-3.5 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-(--text)">Fleet</h3>
            <StatusPill dot={false}>Last heartbeat 12s ago</StatusPill>
          </div>
          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            <ServerTile name="prod-lagos-01" host="deploy@203.0.113.10" latency={38} cpu={23} mem={[3.1, 8]} disk={[61, 80]} projects={6} uptime="41d" load="0.42" />
            <ServerTile name="staging-eu-02" host="deploy@10.0.4.12" latency={46} cpu={8} mem={[1.2, 4]} disk={[18, 40]} projects={5} uptime="12d" load="0.11" />
          </div>
        </div>
      </div>
    </div>
  )
}

function NavGroup({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pt-3 pb-1.5 text-[11px] font-medium text-(--text-subtle)">{children}</div>
}

function NavItem({ icon: Icon, active, count, children }: { icon: typeof Server; active?: boolean; count?: string; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-(--radius-sm) px-2.5 py-[7px] text-[13.5px] ${
        active ? 'bg-(--surface-2) text-(--text) shadow-[inset_0_0_0_1px_var(--border)]' : 'text-(--text-muted)'
      }`}
    >
      <Icon size={15} className={active ? 'text-(--accent)' : undefined} />
      {children}
      {count && <span className="ml-auto font-mono text-[11px] text-(--text-subtle)">{count}</span>}
    </div>
  )
}

function Stat({ icon: Icon, label, value, note, good, spark }: { icon: typeof Server; label: string; value: React.ReactNode; note?: string; good?: boolean; spark?: boolean }) {
  return (
    <div className="rounded-(--radius-lg) border border-(--border) bg-(--surface) px-4.5 pt-4.5 pb-4">
      <div className="flex items-center gap-2 text-[12.5px] text-(--text-muted)"><Icon size={14} />{label}</div>
      <div className="mt-2.5 text-[26px] font-semibold tracking-[-0.03em] text-(--text) tabular-nums">{value}</div>
      {note && <div className={`mt-0.5 text-xs ${good ? 'text-(--green)' : 'text-(--text-subtle)'}`}>{note}</div>}
      {spark && <Sparkline />}
    </div>
  )
}

export function Sparkline({ className = 'mt-3 h-8 w-full' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 32" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#7c83ff" stopOpacity=".35" />
          <stop offset="1" stopColor="#7c83ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 26 L25 22 L50 24 L75 15 L100 18 L125 9 L150 13 L175 5 L200 8 L200 32 L0 32Z" fill="url(#spark-fill)" />
      <path d="M0 26 L25 22 L50 24 L75 15 L100 18 L125 9 L150 13 L175 5 L200 8" fill="none" stroke="#8b91ff" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function ServerTile(props: { name: string; host: string; latency: number; cpu: number; mem: [number, number]; disk: [number, number]; projects: number; uptime: string; load: string }) {
  const tone: StatusTone = 'ok'
  return (
    <div className="overflow-hidden rounded-(--radius-lg) border border-(--border) bg-(--surface)">
      <div className="flex items-start justify-between px-5 py-4.5">
        <div className="flex items-center gap-3">
          <div className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-(--border) bg-(--surface-3) text-(--text-muted)"><Server size={15} /></div>
          <div>
            <div className="text-[14.5px] font-semibold text-(--text)">{props.name}</div>
            <div className="mt-0.5 font-mono text-xs text-(--text-subtle)">{props.host}</div>
          </div>
        </div>
        <StatusPill tone={tone}>Connected · {props.latency} ms</StatusPill>
      </div>
      <div className="grid grid-cols-3 gap-4.5 px-5 pt-1 pb-4.5">
        <Meter label="CPU" value={`${props.cpu}%`} percent={props.cpu} />
        <Meter label="Memory" value={`${props.mem[0]} / ${props.mem[1]} GB`} percent={(props.mem[0] / props.mem[1]) * 100} />
        <Meter label="Disk" value={`${props.disk[0]} / ${props.disk[1]} GB`} percent={(props.disk[0] / props.disk[1]) * 100} />
      </div>
      <div className="flex items-center justify-between border-t border-(--border) bg-(--bg-subtle) px-5 py-2.5 text-[12.5px] text-(--text-muted)">
        <span className="flex gap-4.5">
          <span className="flex items-center gap-1.5"><Boxes size={14} />{props.projects} projects</span>
          <span className="flex items-center gap-1.5"><Clock size={14} />up {props.uptime}</span>
          <span className="font-mono">load {props.load}</span>
        </span>
        <span className="flex items-center gap-1.5 text-(--text)">Open <ArrowRight size={14} /></span>
      </div>
    </div>
  )
}
