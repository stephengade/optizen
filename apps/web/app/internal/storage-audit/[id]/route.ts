import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

function getApiBaseUrl() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  return base.replace('http://localhost:', 'http://127.0.0.1:').replace('https://localhost:', 'https://127.0.0.1:')
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const target = `${getApiBaseUrl()}/servers/${id}/storage-audit`

  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
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
          target,
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
      target,
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
