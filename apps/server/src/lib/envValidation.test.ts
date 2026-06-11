import { describe, expect, it } from 'bun:test'
import { validateEnvContent } from './envValidation'

describe('validateEnvContent', () => {
  it('accepts comments, blank lines, exports, and key-value pairs', () => {
    expect(() =>
      validateEnvContent([
        '# comment',
        '',
        'APP_ENV=production',
        'export PORT=3000',
        'JWT_SECRET=abc123',
      ].join('\n'))
    ).not.toThrow()
  })

  it('rejects lines without equals signs', () => {
    expect(() =>
      validateEnvContent([
        'APP_ENV=production',
        'BROKEN_LINE',
      ].join('\n'))
    ).toThrow('Env validation failed on line 2: expected KEY=value format.')
  })
})
