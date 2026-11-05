import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { AuthProvider } from '@/lib/auth-context'
import { DemoPrivacyProvider } from '@/lib/demo-privacy-context'
import { AuthGate } from '@/components/ui/AuthGate'
import { Toaster } from 'sonner'
import { OG_IMAGE, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site-meta'
import './globals.css'

// Fonts are vendored (Geist, SIL OFL) so builds don't depend on reaching Google Fonts.
const geist = localFont({
  src: './fonts/Geist-Variable.woff2',
  variable: '--font-sans',
  weight: '100 900',
  display: 'swap',
})

const geistMono = localFont({
  src: './fonts/GeistMono-Variable.woff2',
  variable: '--font-mono',
  weight: '100 900',
  display: 'swap',
})

// Defaults for every page. The dashboard and sign-in pages are private, so nothing is indexed
// unless a page says otherwise (the public landing page and docs do, see app/site/[variant]).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: 'Stephen Gbolagade', url: 'https://github.com/stephengade' }],
  creator: 'Stephen Gbolagade',
  robots: { index: false, follow: false },
  openGraph: { type: 'website', siteName: SITE_NAME, title: SITE_TITLE, description: SITE_DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION, images: [OG_IMAGE.url] },
  appleWebApp: { title: SITE_NAME, statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#08090b',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <AuthProvider>
          <DemoPrivacyProvider>
            <AuthGate>
              {children}
            </AuthGate>
          </DemoPrivacyProvider>
        </AuthProvider>
        <Toaster
          theme="dark"
          toastOptions={{
            style: {
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow)',
              fontSize: '13px',
            },
          }}
        />
      </body>
    </html>
  )
}
