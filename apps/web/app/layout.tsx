import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { AuthGate } from '@/components/ui/AuthGate'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Launchpad',
  description: 'Your self-hosted VPS deploy dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          <AuthGate>
            {children}
          </AuthGate>
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
