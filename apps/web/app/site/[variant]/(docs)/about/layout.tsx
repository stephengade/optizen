import { pageMetadata } from '@/lib/site-meta'

// The page itself is a client component, so its metadata lives here.
export const metadata = pageMetadata('/about')

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
