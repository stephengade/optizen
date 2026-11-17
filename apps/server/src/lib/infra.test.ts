import { describe, expect, test } from 'bun:test'
import type { DatabaseConnection } from '@launchpad/shared'
import { backupNameFor, buildDumpScript, dumpInvocation, isDatabaseBackupName, parseBackupListing } from './databaseBackups'
import { asRoot, cleanStderr, routeFrom } from './elevate'
import { composeTarget } from './composeTarget'
import { toHostPath, toInnerPath } from './proxyTarget'

const pg: DatabaseConnection = {
  id: '3f2a9c1e-0000-4000-8000-000000000001',
  serverId: 's1',
  name: 'Ploba Postgres!',
  engine: 'postgres',
  access: 'docker',
  container: 'ploba_postgres',
  user: 'ploba',
  database: 'ploba',
  createdAt: '',
  updatedAt: '',
}

describe('database backups', () => {
  test('names are slugged, timestamped and match the strict pattern', () => {
    const name = backupNameFor(pg, new Date('2026-11-17T15:04:05.123Z'))
    expect(name).toBe('ploba-postgres-20261117T150405Z.sql.gz')
    expect(isDatabaseBackupName(name)).toBe(true)
    expect(isDatabaseBackupName('../etc/passwd')).toBe(false)
    expect(isDatabaseBackupName('x-20261117T150405Z.sql.gz; rm -rf /')).toBe(false)
  })

  test('postgres dump runs pg_dump inside the container with the password from stdin', () => {
    const script = buildDumpScript(pg, 'ploba-20261117T150405Z.sql.gz')
    expect(script.startsWith('IFS= read -r OPTZ_PW')).toBe(true)
    expect(script).toContain('export PGPASSWORD="$OPTZ_PW"')
    expect(script).toContain("exec -e PGPASSWORD 'ploba_postgres'")
    expect(script).toContain('pg_dump')
    expect(script).toContain('gzip -c')
    expect(script).not.toContain('OPTZ_PW=')
  })

  test('mysql dumps every database when none is set', () => {
    const { candidates, args } = dumpInvocation({ ...pg, engine: 'mysql', database: undefined })
    expect(candidates).toEqual(['mariadb-dump', 'mysqldump'])
    expect(args).toContain('--all-databases')
  })

  test('listing ignores files that do not look like backups', () => {
    const list = parseBackupListing(
      '@@dir=/home/u/optizen-backups/databases/x\nploba-20261117T150405Z.sql.gz\t2048\t1763391845.5\nnotes.txt\t10\t1\n'
    )
    expect(list.directory).toBe('/home/u/optizen-backups/databases/x')
    expect(list.backups).toHaveLength(1)
    expect(list.backups[0].sizeBytes).toBe(2048)
  })
})

describe('proxy mounts', () => {
  const mounts = [
    { source: '/www/gateway-proxy/Caddyfile', destination: '/etc/caddy/Caddyfile', rw: true },
    { source: '/srv/sites', destination: '/etc/nginx/conf.d', rw: false },
  ]

  test('maps container paths to host paths and back', () => {
    expect(toHostPath(mounts, '/etc/caddy/Caddyfile')).toBe('/www/gateway-proxy/Caddyfile')
    expect(toHostPath(mounts, '/etc/nginx/conf.d/app.conf')).toBe('/srv/sites/app.conf')
    expect(toHostPath(mounts, '/etc/nginx/nginx.conf')).toBeUndefined()
    expect(toInnerPath(mounts, '/srv/sites/app.conf')).toEqual({ path: '/etc/nginx/conf.d/app.conf', rw: false })
  })
})

describe('elevation', () => {
  test('tries root, sudo, then a privileged container, and reports the route', () => {
    const script = asRoot("echo 3 > /proc/sys/vm/drop_caches")
    expect(script.indexOf('id -u')).toBeLessThan(script.indexOf('sudo -n'))
    expect(script.indexOf('sudo -n')).toBeLessThan(script.indexOf('--privileged'))
    expect(script).toContain('nsenter -t 1')
    expect(routeFrom('__OPTZ_ROUTE=docker\n')).toBe('docker')
    expect(cleanStderr("__OPTZ_ROUTE=docker\nUnable to find image 'alpine:3.20' locally\nreal error")).toBe('real error')
  })
})

describe('compose logs target', () => {
  test('reads the compose file and service from deploy commands', () => {
    expect(
      composeTarget(['docker compose -f docker-compose.production.yml pull web', 'docker compose -f docker-compose.production.yml up -d web'])
    ).toEqual({ files: ['docker-compose.production.yml'], service: 'web' })
    expect(composeTarget(['docker compose pull', 'docker compose up -d'])).toEqual({ files: [], service: undefined })
    expect(
      composeTarget(['docker compose -p ploba -f docker-compose.production.yml --env-file .deploy_state up -d --no-deps worker'])
    ).toEqual({ files: ['docker-compose.production.yml'], service: 'worker' })
  })
})
