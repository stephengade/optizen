import type { Metadata } from 'next'
import { SITE_VARIANTS } from '@/lib/site-hosts'

// Pre-render the landing page and docs once per variant; anything else 404s.
export const dynamicParams = false

export function generateStaticParams() {
  return SITE_VARIANTS.map((variant) => ({ variant }))
}

// Only the public site is indexed. The "full" copy is served on dashboard hosts and on
// single-domain self-hosted installs, which should stay out of search results.
export async function generateMetadata({ params }: { params: Promise<{ variant: string }> }): Promise<Metadata> {
  const { variant } = await params
  return { robots: variant === 'public' ? { index: true, follow: true } : { index: false, follow: false } }
}

export default function SiteVariantLayout({ children }: { children: React.ReactNode }) {
  return children
}
