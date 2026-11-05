import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// db.ts and backups.ts read these at import time, so set them before importing.
const dir = mkdtempSync(join(tmpdir(), 'optizen-backups-'))
process.env.DB_PATH = join(dir, 'launchpad.db.json')
process.env.BACKUP_DIR = join(dir, 'backups')

const auth = {
  passwordHash: 'scrypt$32768$8$1$00$00',
  salt: JSON.stringify({ crypto: 'ab'.repeat(32) }),
  isSetup: true,
  totpEnabled: false,
}

writeFileSync(
  process.env.DB_PATH,
  JSON.stringify({
    auth,
    sessions: { live: { id: 'live', userId: 'u', createdAt: '', expiresAt: '' } },
    rateLimit: { attempts: 3 },
    servers: [{ id: 's1', name: 'one' }],
    projects: [],
  })
)

const backups = await import('./backups')
const { getDb, replaceDb } = await import('./db')

beforeAll(async () => {
  await getDb()
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('backups', () => {
  test('a backup holds the data without sessions or login throttling', async () => {
    const info = await backups.createBackup('manual')
    expect(backups.isBackupName(info.name)).toBe(true)
    const data = JSON.parse(await backups.readBackup(info.name))
    expect(data.servers).toEqual([{ id: 's1', name: 'one' }])
    expect(data.sessions).toEqual({})
    expect(data.rateLimit).toEqual({ attempts: 0 })
    expect((await getDb()).data.sessions.live).toBeDefined()
  })

  test('names outside the pattern are refused (no path traversal)', async () => {
    expect(backups.isBackupName('../launchpad.db.json')).toBe(false)
    await expect(backups.readBackup('../launchpad.db.json')).rejects.toThrow('Unknown backup')
    await expect(backups.deleteBackup('optizen-x.json')).rejects.toThrow('Unknown backup')
  })

  test('listing is newest first and ignores unrelated files', async () => {
    writeFileSync(join(process.env.BACKUP_DIR!, 'notes.txt'), 'hi')
    await backups.createBackup('manual')
    const list = await backups.listBackups()
    expect(list.length).toBe(2)
    expect(list[0].createdAt >= list[1].createdAt).toBe(true)
  })

  test('upload validation rejects non-backups and unclaimed data', () => {
    expect(() => backups.parseBackup('nope')).toThrow('not valid JSON')
    expect(() => backups.parseBackup('[]')).toThrow('not an Optizen backup')
    expect(() => backups.parseBackup(JSON.stringify({ servers: [], projects: [], auth: null }))).toThrow('no master password')
    expect(() => backups.parseBackup(JSON.stringify({ servers: {}, projects: [], auth }))).toThrow('is not a list')
    expect(backups.parseBackup(JSON.stringify({ servers: [], projects: [], auth })).auth?.isSetup).toBe(true)
  })

  test('scheduled backup runs once a day and prunes old automatic ones', async () => {
    await backups.saveBackupSettings({ autoEnabled: true, retainDaily: 2 })
    expect(await backups.runScheduledBackup()).not.toBeNull()
    expect(await backups.runScheduledBackup()).toBeNull()
    // Pretend a day passed, twice more.
    const day = 24 * 60 * 60 * 1000
    expect(await backups.runScheduledBackup(Date.now() + day + 1000)).not.toBeNull()
    expect(await backups.runScheduledBackup(Date.now() + 2 * day + 2000)).not.toBeNull()
    const autos = (await backups.listBackups()).filter((b) => b.kind === 'auto')
    expect(autos.length).toBe(2)
    expect(readdirSync(process.env.BACKUP_DIR!).some((name) => name.endsWith('.tmp'))).toBe(false)
  })

  test('disabled automatic backups do nothing', async () => {
    await backups.saveBackupSettings({ autoEnabled: false, retainDaily: 2 })
    expect(await backups.runScheduledBackup(Date.now() + 10 * 24 * 60 * 60 * 1000)).toBeNull()
  })

  test('settings are clamped', () => {
    expect(backups.clampBackupSettings({ autoEnabled: true, retainDaily: 0 }).retainDaily).toBe(1)
    expect(backups.clampBackupSettings({ autoEnabled: true, retainDaily: 9999 }).retainDaily).toBe(365)
  })

  test('restoring replaces the data and fills in missing keys', async () => {
    const uploaded = await backups.saveUploadedBackup(JSON.stringify({ auth, servers: [{ id: 's2' }], projects: [] }))
    const data = backups.parseBackup(await backups.readBackup(uploaded.name))
    await replaceDb({ ...data, sessions: {} })
    const db = await getDb()
    expect(db.data.servers).toEqual([{ id: 's2' }] as never)
    expect(db.data.sessions).toEqual({})
    expect(Array.isArray(db.data.activity)).toBe(true)
  })
})
