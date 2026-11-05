import { describe, expect, test } from 'bun:test'
import { createHash } from 'crypto'
import { hashPassword, isLegacyHash, verifyPassword } from './password'
import { checkRateLimit, clientKey, recordFailedAttempt, resetRateLimit } from './rateLimit'
import { clearSetupCode, issueSetupCode, verifySetupCode } from './setupCode'
import { securityProblems } from './startupChecks'

describe('password hashing', () => {
  test('scrypt hashes verify and reject wrong passwords', async () => {
    const stored = await hashPassword('correct horse battery')
    expect(stored.startsWith('scrypt$')).toBe(true)
    expect(isLegacyHash(stored)).toBe(false)
    expect(await verifyPassword('correct horse battery', stored)).toBe(true)
    expect(await verifyPassword('correct horse batterY', stored)).toBe(false)
  })

  test('same password gets a different salt each time', async () => {
    expect(await hashPassword('same password here')).not.toBe(await hashPassword('same password here'))
  })

  test('legacy SHA-256 hashes still verify', async () => {
    const salt = 'abc123'
    const legacy = createHash('sha256').update('old password 1' + salt).digest('hex')
    expect(isLegacyHash(legacy)).toBe(true)
    expect(await verifyPassword('old password 1', legacy, salt)).toBe(true)
    expect(await verifyPassword('old password 2', legacy, salt)).toBe(false)
  })

  test('malformed stored hashes fail closed', async () => {
    expect(await verifyPassword('x', 'scrypt$1$2$3')).toBe(false)
  })
})

describe('per-IP rate limit', () => {
  test('locks one IP after 5 failures without affecting another', () => {
    const a = `test-a-${Math.random()}`
    const b = `test-b-${Math.random()}`
    for (let i = 0; i < 4; i++) expect(recordFailedAttempt(a).allowed).toBe(true)
    expect(recordFailedAttempt(a).allowed).toBe(false)
    expect(checkRateLimit(a).allowed).toBe(false)
    expect(checkRateLimit(b)).toEqual({ allowed: true, attemptsRemaining: 5 })
    resetRateLimit(a)
    expect(checkRateLimit(a).allowed).toBe(true)
  })

  test('client key prefers the first forwarded address', () => {
    const request = new Request('http://x', { headers: { 'x-forwarded-for': '203.0.113.7, 172.18.0.4' } })
    expect(clientKey(request, '172.18.0.5')).toBe('203.0.113.7')
    expect(clientKey(new Request('http://x'), '10.0.0.2')).toBe('10.0.0.2')
  })
})

describe('setup code', () => {
  test('accepts the issued code in any case and with or without dashes', () => {
    const code = issueSetupCode()
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(verifySetupCode(code.toLowerCase())).toBe(true)
    expect(verifySetupCode(code.replace(/-/g, ''))).toBe(true)
    expect(verifySetupCode('AAAA-AAAA-AAAA')).toBe(false)
    expect(verifySetupCode('')).toBe(false)
  })

  test('nothing verifies once cleared', () => {
    const code = issueSetupCode()
    clearSetupCode()
    expect(verifySetupCode(code)).toBe(false)
  })
})

describe('startup checks', () => {
  const good = { NODE_ENV: 'production', SESSION_SECRET: 'a'.repeat(64), WEB_URL: 'https://ops.example.com' }

  test('passes a sane production config and ignores development', () => {
    expect(securityProblems(good)).toEqual([])
    expect(securityProblems({ NODE_ENV: 'development' })).toEqual([])
  })

  test('flags missing or weak secrets and plain-http URLs', () => {
    expect(securityProblems({ ...good, SESSION_SECRET: '' })).toHaveLength(1)
    expect(securityProblems({ ...good, SESSION_SECRET: 'changeme' })).toHaveLength(1)
    expect(securityProblems({ ...good, WEB_URL: 'http://ops.example.com' })).toHaveLength(1)
  })
})
