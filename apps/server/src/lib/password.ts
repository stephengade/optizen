/**
 * Master password hashing.
 *
 * New hashes use scrypt (memory-hard, slow to brute-force offline):
 *   scrypt$<N>$<r>$<p>$<salt hex>$<hash hex>
 * Older installs stored a single SHA-256 of password + salt (hex, no prefix). Those still verify,
 * and the caller re-hashes with scrypt after the next successful sign-in.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'crypto'

const N = 1 << 15
const R = 8
const P = 1
const KEY_LENGTH = 64
// scrypt needs ~128 * N * r bytes (32 MiB here); Node's default cap is exactly 32 MiB, so raise it.
const MAX_MEM = 64 * 1024 * 1024

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key)))
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEM })
  return ['scrypt', N, R, P, salt.toString('hex'), hash.toString('hex')].join('$')
}

export function isLegacyHash(stored: string): boolean {
  return !stored.startsWith('scrypt$')
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * @param legacySalt the old `hash` salt from auth.salt, only used for pre-scrypt hashes.
 */
export async function verifyPassword(password: string, stored: string, legacySalt?: string): Promise<boolean> {
  if (isLegacyHash(stored)) {
    const actual = createHash('sha256').update(password + (legacySalt ?? '')).digest()
    return safeEqual(Buffer.from(stored, 'hex'), actual)
  }

  const [, n, r, p, saltHex, hashHex] = stored.split('$')
  const expected = Buffer.from(hashHex ?? '', 'hex')
  if (!saltHex || expected.length === 0) return false
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAX_MEM,
  })
  return safeEqual(expected, actual)
}
