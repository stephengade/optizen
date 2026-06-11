import { describe, expect, it } from 'bun:test'
import { inferProjectRuntime, inferProxyTypeFromProject, inferProjectSource } from './projectInference'

describe('project inference helpers', () => {
  it('classifies proxy projects from proxy hints', () => {
    expect(
      inferProjectRuntime({
        name: 'edge-nginx',
        workingDir: '/srv/edge',
      })
    ).toBe('proxy')
    expect(
      inferProxyTypeFromProject({
        deployCommands: ['docker compose up -d caddy'],
      })
    ).toBe('caddy')
  })

  it('classifies compose and image-based projects incrementally', () => {
    expect(
      inferProjectRuntime({
        workingDir: '/srv/shop',
        deployCommands: ['docker compose -f compose.yaml up -d'],
      })
    ).toBe('compose')
    expect(
      inferProjectRuntime({
        repoImage: 'ghcr.io/acme/api',
        deployCommands: ['docker pull ghcr.io/acme/api:latest'],
      })
    ).toBe('image')
  })

  it('distinguishes imported from manual projects', () => {
    expect(inferProjectSource({ imported: true })).toBe('imported')
    expect(inferProjectSource({ imported: false })).toBe('manual')
  })
})
