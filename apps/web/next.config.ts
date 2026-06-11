import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // API requests to Elysia server
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/:path*`,
      },
    ]
  },
}

export default nextConfig
