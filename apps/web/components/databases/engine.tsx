import type { DatabaseConnection, DatabaseEngine } from '@launchpad/shared'
import { cn } from '@/lib/utils'

export const ENGINES: Record<DatabaseEngine, { label: string; short: string; color: string; defaultPort?: number }> = {
  postgres: { label: 'PostgreSQL', short: 'PG', color: '#6d9eeb', defaultPort: 5432 },
  mysql: { label: 'MySQL / MariaDB', short: 'MY', color: '#f5b74f', defaultPort: 3306 },
  sqlite: { label: 'SQLite', short: 'SQ', color: '#4ade80' },
}

/** Small square mark in the engine's colour. */
export function EngineMark({ engine, size = 32, className }: { engine: DatabaseEngine; size?: number; className?: string }) {
  const meta = ENGINES[engine]
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-(--radius-sm) border font-mono font-semibold', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        color: meta.color,
        borderColor: `${meta.color}40`,
        background: `${meta.color}14`,
      }}
      aria-hidden
    >
      {meta.short}
    </span>
  )
}

/** "docker · pg-main" or "127.0.0.1:5432" or the sqlite path. */
export function describeTarget(connection: Pick<DatabaseConnection, 'engine' | 'access' | 'container' | 'host' | 'port' | 'database'>) {
  const where =
    connection.access === 'docker'
      ? `container ${connection.container}`
      : connection.engine === 'sqlite'
        ? 'file on the server'
        : connection.host
          ? `${connection.host}${connection.port ? `:${connection.port}` : ''}`
          : 'local socket'
  return connection.engine === 'sqlite' && connection.database ? `${connection.database}` : where
}
