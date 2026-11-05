/**
 * One-time setup code.
 *
 * Until the master password exists, anyone who can open the dashboard could set it and take over
 * the instance. To prevent that, a fresh install prints a random code to the server log, and
 * POST /auth/setup only works with it. Reading the log needs shell access to the machine, which
 * only the owner has. The code lives in memory and changes on every restart.
 */
import { randomInt, timingSafeEqual } from 'crypto'

// No 0/O, 1/I/L: easy to read from a terminal and type back.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

let code: string | null = null

function generate(): string {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)])
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((group) => group.join('')).join('-')
}

function normalize(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function issueSetupCode(): string {
  code = generate()
  return code
}

export function verifySetupCode(input: string): boolean {
  if (!code) return false
  const expected = Buffer.from(normalize(code))
  const actual = Buffer.from(normalize(input))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function clearSetupCode(): void {
  code = null
}

export function printSetupCode(): void {
  const value = issueSetupCode()
  const line = '='.repeat(60)
  console.log(
    [
      '',
      line,
      '  Optizen is not set up yet.',
      `  Setup code: ${value}`,
      '  Open the dashboard and enter this code with your new master',
      '  password. The code changes every time the server restarts.',
      line,
      '',
    ].join('\n')
  )
}
