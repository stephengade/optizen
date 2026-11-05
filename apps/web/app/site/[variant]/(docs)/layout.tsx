import { SiteFooter, SiteHeader } from '@/components/site/SiteChrome'
import { PageTransition } from '@/components/ui/PageTransition'

export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ variant: string }>
}) {
  const publicSite = (await params).variant === 'public'

  return (
    <div className="relative min-h-screen overflow-x-clip bg-(--bg)">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(600px_260px_at_50%_0%,rgba(124,131,255,0.12),transparent_70%)]" />
      <SiteHeader publicSite={publicSite} />
      <div className="relative pt-6 pb-20"><PageTransition>{children}</PageTransition></div>
      <SiteFooter />
    </div>
  )
}
