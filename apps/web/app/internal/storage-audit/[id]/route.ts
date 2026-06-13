import { NextRequest } from 'next/server'
import { proxyStorageAuditRequest } from '@/lib/storage-audit-proxy'

export const maxDuration = 300

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  return proxyStorageAuditRequest(request, id, { includeTarget: true })
}
