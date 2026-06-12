import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { DemoPrivacyProvider } from '@/lib/demo-privacy-context'
import { AuthGate } from '@/components/ui/AuthGate'
import { Toaster } from 'sonner'
import './globals.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
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
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: '0',
              fontSize: '13px',
            },
          }}
        />
      </body>
    </html>
  )
}
