import type { Metadata } from 'next'
import { IBM_Plex_Mono, Manrope } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { DemoPrivacyProvider } from '@/lib/demo-privacy-context'
import { AuthGate } from '@/components/ui/AuthGate'
import { Toaster } from 'sonner'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'Launchpad',
  description: 'A trustworthy self-hosted VPS control plane for deploys, runtime operations, and observability.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${plexMono.variable}`}>
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
              border: '1px solid var(--border)',
              color: 'var(--text)',
            },
          }}
        />
      </body>
    </html>
  )
}
