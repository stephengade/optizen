import type { MetadataRoute } from 'next'
import { SITE_PAGES, SITE_URL } from '@/lib/site-meta'

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.entries(SITE_PAGES).map(([path, page]) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: page.priority,
  }))
}
