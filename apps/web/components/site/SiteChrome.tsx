import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { GithubIcon } from './GithubIcon'
import { GITHUB_REPO_URL } from '@/lib/links'
import { OptizenLogo } from '@/components/ui/OptizenMark'

/**
 * Header for the landing page and docs. The public host never links to sign-in: it offers the
 * GitHub download in that spot instead.
 */
export function SiteHeader({ publicSite, wide = true }: { publicSite: boolean; wide?: boolean }) {
  return (
    <header className="glass sticky top-0 z-40 border-b border-(--border)">
      <div className={`mx-auto flex h-15 items-center justify-between px-6 ${wide ? 'max-w-290' : 'max-w-6xl'}`}>
        <Link href="/" aria-label="Optizen home">
          <OptizenLogo />
        </Link>
        <nav className="flex items-center gap-6 text-[13.5px] text-(--text-muted)">
          <Link href="/#features" className="hidden transition-colors hover:text-(--text) md:inline">Features</Link>
          <Link href="/help" className="hidden transition-colors hover:text-(--text) sm:inline">Docs</Link>
          <Link href="/contribute" className="hidden transition-colors hover:text-(--text) md:inline">Contribute</Link>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 transition-colors hover:text-(--text) sm:inline-flex"
          >
            <GithubIcon size={15} />
            Star
          </a>
          {publicSite ? (
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex h-[30px] items-center gap-1.5 rounded-(--radius-sm) px-3 text-[12.5px] font-medium"
            >
              Get it on GitHub
              <ArrowUpRight size={13} />
            </a>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-[30px] items-center rounded-(--radius-sm) border border-(--border-strong) bg-white/[0.03] px-3 text-[12.5px] font-medium text-(--text) transition-colors hover:bg-white/[0.06]"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

const FOOTER_LINKS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Install', href: '/help/install' },
      { label: 'Quick start', href: '/help/setup' },
      { label: 'Security', href: '/help/security' },
    ],
  },
  {
    title: 'Docs',
    links: [
      { label: 'Projects', href: '/help/projects' },
      { label: 'Workflows', href: '/help/workflows' },
      { label: 'Server health', href: '/help/server-health' },
      { label: 'Metrics', href: '/help/server-metrics' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'GitHub', href: GITHUB_REPO_URL, external: true },
      { label: 'Contribute', href: '/contribute' },
      { label: 'About', href: '/about' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-(--border) pt-14 pb-10">
      <div className="mx-auto max-w-290 px-6">
        <div className="grid gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <OptizenLogo />
            <p className="mt-3.5 max-w-70 text-[13.5px] leading-relaxed text-(--text-muted)">
              The open-source control plane for self-hosted servers.
            </p>
          </div>
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h5 className="mb-3.5 text-[12.5px] font-medium text-(--text)">{group.title}</h5>
              {group.links.map((link) =>
                link.external ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block py-1 text-[13.5px] text-(--text-muted) transition-colors hover:text-(--text)"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="block py-1 text-[13.5px] text-(--text-muted) transition-colors hover:text-(--text)"
                  >
                    {link.label}
                  </Link>
                )
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-between gap-2 border-t border-(--border) pt-6 text-[13px] text-(--text-subtle) sm:flex-row">
          <span>© {new Date().getFullYear()} Optizen · AGPL-3.0</span>
          <span>Made for people who run their own servers.</span>
        </div>
      </div>
    </footer>
  )
}
