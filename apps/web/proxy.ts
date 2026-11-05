import { NextResponse, type NextRequest } from 'next/server'
import {
  SITE_PREFIX,
  isPublicHost,
  isPublicPath,
  publicSiteHosts,
  requestHost,
  type SiteVariant,
} from './lib/site-hosts'

// Build the target from the visitor's Host (Caddy keeps it): behind the proxy, request.url carries the
// container's own address, not the public domain.
function redirectTo(request: NextRequest, path: string) {
  const host = requestHost(request.headers) ?? request.nextUrl.host
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')
  return NextResponse.redirect(`${proto.split(',')[0].trim()}://${host}${path}`, 307)
}

/** Serve the pre-built landing/docs copy for this host (see app/site/[variant]). */
function rewriteToVariant(request: NextRequest, variant: SiteVariant) {
  const { pathname } = request.nextUrl
  const url = request.nextUrl.clone()
  url.pathname = `${SITE_PREFIX}/${variant}${pathname === '/' ? '' : pathname}`
  return NextResponse.rewrite(url)
}

function notFound() {
  return new NextResponse('Not found', { status: 404 })
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // The variant copies are only reachable through the rewrite, never by their own URL.
  if (pathname === SITE_PREFIX || pathname.startsWith(`${SITE_PREFIX}/`)) return notFound()

  const split = publicSiteHosts().length > 0

  if (split && isPublicHost(requestHost(request.headers))) {
    if (isPublicPath(pathname)) return rewriteToVariant(request, 'public')
    // Visitors who look for a sign-in on the public site want to run their own copy.
    if (pathname === '/login' || pathname === '/setup') return redirectTo(request, '/help/install')
    // Dashboard pages, /api and internal routes do not exist on the public host.
    return notFound()
  }

  // Dashboard host in a split deploy: skip the marketing page.
  if (split && pathname === '/') return redirectTo(request, '/servers')
  if (isPublicPath(pathname)) return rewriteToVariant(request, 'full')
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)'],
}
