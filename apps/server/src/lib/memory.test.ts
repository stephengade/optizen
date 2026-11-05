import { describe, expect, test } from 'bun:test'
import { isProtectedCommand, parseDockerSize, parseMemoryReport } from './memory'

const CID = 'a'.repeat(64)

const sample = [
  '@@meminfo',
  'MemTotal:        2000000 kB',
  'MemFree:          100000 kB',
  'MemAvailable:     500000 kB',
  'Buffers:           50000 kB',
  'Cached:           400000 kB',
  'SReclaimable:      50000 kB',
  'Shmem:             20000 kB',
  'SwapTotal:       1000000 kB',
  'SwapFree:         600000 kB',
  '@@elevate',
  'sudo',
  '@@ps',
  `812\twww-data\t900000\t45.0\t12.5\tnode\t${CID}\tnode /app/server.js --port 3000`,
  '1\troot\t12000\t0.6\t0.0\tsystemd\t\t/sbin/init',
  '640\troot\t8000\t0.4\t0.0\tsshd\t\tsshd: /usr/sbin/sshd -D [listener]',
  '@@groups',
  '900000\t1\tnode',
  '120000\t8\tphp-fpm8.2',
  '@@docker',
  'available',
  'aaaaaaaaaaaa\tapi\t878.9MiB / 1.907GiB\t45.01%\t12.30%',
  '@@dockerps',
  `${CID}\tapi\tghcr.io/acme/api:latest`,
  '@@oom',
  '[Tue Nov  4 10:00:00 2026] Out of memory: Killed process 4242 (java)',
  '@@end',
].join('\n')

describe('parseMemoryReport', () => {
  const report = parseMemoryReport(sample, 'srv-1')

  test('computes used memory from MemAvailable, not MemFree', () => {
    expect(report.breakdown.totalBytes).toBe(2000000 * 1024)
    expect(report.breakdown.usedBytes).toBe(1500000 * 1024)
    expect(report.breakdown.cacheBytes).toBe(500000 * 1024)
    expect(report.breakdown.swapUsedBytes).toBe(400000 * 1024)
  })

  test('parses processes with container names and protection flags', () => {
    const [node, init, sshd] = report.topProcesses
    expect(node.pid).toBe(812)
    expect(node.command).toBe('node')
    expect(node.args).toBe('node /app/server.js --port 3000')
    expect(node.containerName).toBe('api')
    expect(node.protected).toBe(false)
    expect(init.protected).toBe(true)
    expect(sshd.protected).toBe(true)
  })

  test('parses groups, containers, elevation and OOM lines', () => {
    expect(report.groups[1]).toEqual({ command: 'php-fpm8.2', processCount: 8, rssBytes: 120000 * 1024 })
    expect(report.dockerAvailable).toBe(true)
    expect(report.containers[0].name).toBe('api')
    expect(report.containers[0].image).toBe('ghcr.io/acme/api:latest')
    expect(report.containers[0].usageBytes).toBe(Math.round(878.9 * 1024 ** 2))
    expect(report.canElevate).toBe(true)
    expect(report.recentOomKills).toHaveLength(1)
  })
})

test('parseDockerSize handles binary and decimal units', () => {
  expect(parseDockerSize('1.5GiB')).toBe(Math.round(1.5 * 1024 ** 3))
  expect(parseDockerSize('200MB')).toBe(200_000_000)
  expect(parseDockerSize('0B')).toBe(0)
  expect(parseDockerSize('n/a')).toBeUndefined()
})

test('isProtectedCommand', () => {
  expect(isProtectedCommand('systemd-journald')).toBe(true)
  expect(isProtectedCommand('dockerd')).toBe(true)
  expect(isProtectedCommand('containerd-shim-runc-v2')).toBe(true)
  expect(isProtectedCommand('node')).toBe(false)
})
