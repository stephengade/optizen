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

/** The host the visitor asked for. Caddy sets X-Forwarded-Host (and drops client-sent values). */
export function requestHost(headers: { get(name: string): string | null }): string | null {
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  return host ? host.split(',')[0].trim() : null
}
