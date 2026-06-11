import { redirect } from 'next/navigation'

// Root redirects to dashboard (auth guard applied in dashboard layout)
export default function Home() {
  redirect('/servers')
}
