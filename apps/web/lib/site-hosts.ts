/**
 * Public-site split. When PUBLIC_SITE_HOST is set (comma-separated hostnames, e.g.
 * "optizen.dev,www.optizen.dev"), requests on those hosts only get the landing page and docs;
 * the dashboard, auth pages and API answer only on other hosts. Unset = one site serves everything.
 * Read at request time, so the same image works for both setups.
 */
export function publicSiteHosts(): string[] {
  return (process.env.PUBLIC_SITE_HOST ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

export function isPublicHost(host: string | null | undefined): boolean {
  if (!host) return false
  const name = host.split(',')[0].trim().toLowerCase().replace(/:\d+$/, '')
  return publicSiteHosts().includes(name)
}

/** Paths the public host serves. Everything else 404s there. */
export function isPublicPath(pathname: string): boolean {
  return pathname === '/' || /^\/(about|contribute|help)(\/|$)/.test(pathname)
}

/**
 * Landing/docs pages as React sees them. While pre-building, usePathname() returns the internal
 * /site/<variant>/... path, so those count as public too (in the browser it is the visible URL).
 */
export function isMarketingPath(pathname: string): boolean {
  return isPublicPath(pathname) || pathname.startsWith('/site/')
}

/** The host the visitor asked for. Caddy sets X-Forwarded-Host (and drops client-sent values). */
export function requestHost(headers: { get(name: string): string | null }): string | null {
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  return host ? host.split(',')[0].trim() : null
}

/**
 * The landing page and docs are pre-built twice (app/site/[variant]); proxy.ts rewrites each
 * request to the right copy. "public": the marketing host (no sign-in, CTAs go to the install
 * guide). "full": the dashboard host, or a single-domain install.
 */
export const SITE_VARIANTS = ['full', 'public'] as const
export type SiteVariant = (typeof SITE_VARIANTS)[number]
export const SITE_PREFIX = '/site'
