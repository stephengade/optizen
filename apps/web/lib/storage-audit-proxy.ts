import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001'
const SESSION_COOKIE = 'lp_session'

function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (!configured) {
    return DEFAULT_API_BASE_URL
  }

  try {
    const url = new URL(configured)
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1'
    }

    return url.toString().replace(/\/$/, '')
  } catch {
    return DEFAULT_API_BASE_URL
  }
}

function getSessionCookieHeader(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value
  return session ? `${SESSION_COOKIE}=${session}` : undefined
}

export async function proxyStorageAuditRequest(
  request: NextRequest,
  id: string,
  options?: { includeTarget?: boolean }
) {
  const target = `${getApiBaseUrl()}/servers/${id}/storage-audit`
  const sessionCookie = getSessionCookieHeader(request)

  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: sessionCookie ? { cookie: sessionCookie } : undefined,
      cache: 'no-store',
    })

    const contentType = response.headers.get('content-type') ?? ''
    const rawBody = await response.text()

    if (!response.ok) {
      let parsed: { message?: string; code?: string } | null = null
      if (contentType.includes('application/json') && rawBody) {
        try {
          parsed = JSON.parse(rawBody) as { message?: string; code?: string }
        } catch {
          parsed = null
        }
      }

      return NextResponse.json(
        {
          message: parsed?.message ?? `Upstream ${response.status}: ${rawBody || response.statusText}`,
          code: parsed?.code,
          upstreamStatus: response.status,
          upstreamBody: rawBody || undefined,
          upstreamContentType: contentType || undefined,
          ...(options?.includeTarget ? { target } : {}),
        },
        { status: response.status }
      )
    }

    if (contentType.includes('application/json')) {
      return new NextResponse(rawBody, {
        status: response.status,
        headers: {
          'content-type': contentType,
        },
      })
    }

    return NextResponse.json({
      message: 'Storage audit upstream returned a non-JSON success response.',
      upstreamStatus: response.status,
      upstreamBody: rawBody || undefined,
      upstreamContentType: contentType || undefined,
      ...(options?.includeTarget ? { target } : {}),
    })
  } catch (error) {
    const cause =
      error instanceof Error && 'cause' in error
        ? String((error as Error & { cause?: unknown }).cause ?? '')
        : undefined

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to reach storage audit upstream',
        debug: error instanceof Error ? String(error.stack ?? error.message) : String(error),
        cause,
        target,
      },
      { status: 500 }
    )
  }
}
