import { SITE_VARIANTS } from '@/lib/site-hosts'

// Pre-render the landing page and docs once per variant; anything else 404s.
export const dynamicParams = false

export function generateStaticParams() {
  return SITE_VARIANTS.map((variant) => ({ variant }))
}

export default function SiteVariantLayout({ children }: { children: React.ReactNode }) {
  return children
}
