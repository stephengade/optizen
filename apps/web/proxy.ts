import { NextResponse, type NextRequest } from 'next/server'
import { isPublicHost, isPublicPath, publicSiteHosts, requestHost } from './lib/site-hosts'

// Build the target from the visitor's Host (Caddy keeps it): behind the proxy, request.url carries the
// container's own address, not the public domain.
function redirectTo(request: NextRequest, path: string) {
  const host = requestHost(request.headers) ?? request.nextUrl.host
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')
  return NextResponse.redirect(`${proto.split(',')[0].trim()}://${host}${path}`, 307)
}

export function proxy(request: NextRequest) {
  if (publicSiteHosts().length === 0) return NextResponse.next()

  const { pathname } = request.nextUrl

  if (isPublicHost(requestHost(request.headers))) {
    if (isPublicPath(pathname)) return NextResponse.next()
    // Visitors who look for a sign-in on the public site want to run their own copy.
    if (pathname === '/login' || pathname === '/setup') {
      return redirectTo(request, '/help/install')
    }
    // Dashboard pages, /api and internal routes do not exist on the public host.
    return new NextResponse('Not found', { status: 404 })
  }

  // Dashboard host: skip the marketing page.
  if (pathname === '/') return redirectTo(request, '/servers')
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)'],
}
