import type { Metadata } from 'next'

/**
 * Names, descriptions and absolute URLs for search engines and link previews.
 *
 * The site's address is read at build time: NEXT_PUBLIC_SITE_URL if set, else the public
 * landing domain (PUBLIC_DOMAIN), else the dashboard domain (DOMAIN), else the project's own site.
 * docker-compose passes PUBLIC_DOMAIN and DOMAIN from .env into the build.
 */
function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  const domain = (process.env.PUBLIC_DOMAIN || process.env.DOMAIN || '').split(',')[0].trim()
  return domain ? `https://${domain}` : 'https://optizen.stephengade.com'
}

export const SITE_URL = siteUrl()
export const SITE_NAME = 'Optizen'
export const SITE_TITLE = 'Optizen — the open-source control plane for self-hosted servers'
export const SITE_DESCRIPTION =
  'Free, open-source and self-hosted. Manage your VPS servers, Docker deploys, Postgres and MySQL databases, env files and Caddy or Nginx config from one calm dashboard, over plain SSH.'
export const OG_IMAGE = { url: '/og.png', width: 1200, height: 630, alt: 'Optizen: the control plane for your self-hosted servers' }

export const SITE_KEYWORDS = [
  'self-hosted',
  'VPS management',
  'server dashboard',
  'Docker Compose deploy',
  'open source PaaS',
  'database GUI',
  'PostgreSQL',
  'MySQL',
  'SQLite',
  'Caddy',
  'Nginx',
  'SSH',
  'DevOps',
  'control panel',
]

/** Public pages: title and description for each, also the sitemap. */
export const SITE_PAGES: Record<string, { title?: string; description: string; priority: number }> = {
  '/': { description: SITE_DESCRIPTION, priority: 1 },
  '/help': { title: 'Docs', description: 'Install Optizen on your own server, connect hosts over SSH and run your first deploy.', priority: 0.8 },
  '/help/install': { title: 'Install on your server', description: 'Run Optizen on any Linux VPS with Docker Compose: get the code, add a .env and SSH keys, and start it behind HTTPS.', priority: 0.9 },
  '/help/setup': { title: 'Quick start', description: 'Six steps from zero to a working deploy: master password, first server, SSH test, projects and your first deploy.', priority: 0.7 },
  '/help/get-started': { title: 'Get started', description: 'From fork to a running local Optizen workspace: clone, install Bun and dependencies, and start the dev servers.', priority: 0.6 },
  '/help/projects': { title: 'Project types', description: 'Docker Compose, Docker images, Caddy, Nginx and custom scripts: how Optizen deploys and checks each one.', priority: 0.7 },
  '/help/workflows': { title: 'Workflows', description: 'Running deploys, editing env files and proxy config, and rolling back safely.', priority: 0.7 },
  '/help/server-metrics': { title: 'Server metrics', description: 'What CPU, memory, disk, inodes, load and uptime mean in Optizen, and how they are measured.', priority: 0.6 },
  '/help/server-health': { title: 'Server health', description: 'Habits that keep your servers and deploys predictable: trends, headroom and alerts.', priority: 0.5 },
  '/help/security': { title: 'Trust & security', description: 'How Optizen protects your servers: master password, encrypted secrets, re-authentication and the audit trail.', priority: 0.7 },
  '/about': { title: 'About', description: 'Why Optizen exists: a modern, open-source control plane for people who run their own servers.', priority: 0.5 },
  '/contribute': { title: 'Contributing', description: 'Run the Optizen codebase locally, test your changes and send pull requests safely.', priority: 0.5 },
}

/** Page metadata for a public path in SITE_PAGES. Keeps the shared preview image on every page. */
export function pageMetadata(path: keyof typeof SITE_PAGES): Metadata {
  const page = SITE_PAGES[path]
  const title = page.title ? `${page.title} · ${SITE_NAME}` : SITE_TITLE
  return {
    title: page.title ? page.title : { absolute: SITE_TITLE },
    description: page.description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      url: path,
      title,
      description: page.description,
      images: [OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title, description: page.description, images: [OG_IMAGE.url] },
  }
}
