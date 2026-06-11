/**
 * Launchpad Crypto Layer
 * AES-256-GCM encryption + PBKDF2 key derivation
 * Fully wired in Phase 2 (Auth)
 */
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32       // 256 bits
const IV_LENGTH = 16        // 128 bits
const SALT_LENGTH = 32      // 256 bits
const AUTH_TAG_LENGTH = 16  // 128 bits
const PBKDF2_ITERATIONS = 310_000
const PBKDF2_DIGEST = 'sha256'

// Derived key is held in memory only — never persisted
let _derivedKey: Buffer | null = null

export function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST)
}

export function setKey(key: Buffer): void {
  _derivedKey = key
}

export function clearKey(): void {
  _derivedKey = null
}

export function hasKey(): boolean {
  return _derivedKey !== null
}

export function generateSalt(): Buffer {
  return randomBytes(SALT_LENGTH)
}

export function encrypt(plaintext: string): string {
  if (!_derivedKey) throw new Error('Encryption key not set — authenticate first')

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, _derivedKey, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  // Layout: iv (16) | authTag (16) | ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  if (!_derivedKey) throw new Error('Encryption key not set — authenticate first')

  const data = Buffer.from(ciphertext, 'base64')
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, _derivedKey, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8')
}
