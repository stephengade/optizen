import { headers } from 'next/headers'
import { isPublicHost, requestHost } from './site-hosts'

/** True when this request is on the public marketing host (see PUBLIC_SITE_HOST). */
export async function isPublicSite(): Promise<boolean> {
  const h = await headers()
  return isPublicHost(requestHost(h))
}
