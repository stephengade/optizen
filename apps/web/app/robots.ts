import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { isPublicHost, publicSiteHosts, requestHost } from '@/lib/site-hosts'
import { SITE_URL } from '@/lib/site-meta'

// Answered per request: the public landing host may be crawled, the dashboard host never.
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = requestHost(await headers())
  const crawlable = publicSiteHosts().length > 0 && isPublicHost(host)
  if (!crawlable) return { rules: { userAgent: '*', disallow: '/' } }
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
