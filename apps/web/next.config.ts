import type { NextConfig } from 'next'
import { join } from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: trace files from the repo root so the standalone build includes workspace packages.
  outputFileTracingRoot: join(__dirname, '../..'),
  // API requests to Elysia server.
  // NOTE: rewrites are resolved at BUILD time, so NEXT_PUBLIC_API_URL must be set when building
  // (the Dockerfile takes it as a build arg).
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
