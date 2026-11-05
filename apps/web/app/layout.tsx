import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { AuthProvider } from '@/lib/auth-context'
import { DemoPrivacyProvider } from '@/lib/demo-privacy-context'
import { AuthGate } from '@/components/ui/AuthGate'
import { Toaster } from 'sonner'
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

export const metadata: Metadata = {
  title: 'Optizen',
  description: 'Self-hosted VPS operations. Servers, deploys, and infra files — clear and under control.',
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
