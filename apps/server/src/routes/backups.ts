/**
 * Backups of the Optizen data file.
 *
 * GET    /backups                     — folder, settings and list
 * POST   /backups                     — back up now
 * PUT    /backups/settings            — automatic backup settings
 * POST   /backups/upload              — add a backup file from the browser (validated, not restored)
 * GET    /backups/:name/download      — download one (dangerous: contains encrypted secrets)
 * DELETE /backups/:name               — delete one (dangerous)
 * POST   /backups/:name/restore       — replace all data with a backup (needs the current password)
 */
import { Elysia, t } from 'elysia'
import type { BackupOverview } from '@launchpad/shared'
import { recordActivity } from '../lib/activity'
import {
  BACKUP_DIR,
  BackupError,
  createBackup,
  deleteBackup,
  getBackupSettings,
  listBackups,
  parseBackup,
  pruneBackups,
  readBackup,
  saveBackupSettings,
  saveUploadedBackup,
} from '../lib/backups'
import { clearKey } from '../lib/crypto'
import { requireDangerousActionAuth } from '../lib/dangerousAction'
import { getDb, replaceDb } from '../lib/db'
import { verifyPassword } from '../lib/password'
import { checkRateLimit, clientKey, recordFailedAttempt, resetRateLimit } from '../lib/rateLimit'
import { SESSION_COOKIE } from '../lib/session'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

type RequestIp = { requestIP(request: Request): { address: string } | null } | null

function fail(set: { status?: number | string }, error: unknown, fallback: string) {
  if (error instanceof BackupError) {
    set.status = error.status
    return { message: error.message }
  }
  console.error(fallback, error)
  set.status = 500
  return { message: fallback }
}

export const backupRoutes = new Elysia({ prefix: '/backups' })
  .get('/', async (context: any) => {
    await context.requireAuth()
    const overview: BackupOverview = {
      directory: BACKUP_DIR,
      settings: await getBackupSettings(),
      backups: await listBackups(),
    }
    return overview
  })

  .post('/', async (context: any) => {
    const { requireAuth, set } = context
    await requireAuth()
    try {
      const backup = await createBackup('manual')
      await recordActivity({
        serverId: 'system',
        type: 'backup_created',
        status: 'success',
        title: 'Backup created',
        detail: backup.name,
      })
      return backup
    } catch (error) {
      return fail(set, error, 'Could not write the backup file. Check that the backup folder is writable.')
    }
  })

  .put(
    '/settings',
    async (context: any) => {
      const { requireAuth, body } = context
      await requireAuth()
      const settings = await saveBackupSettings(body)
      await pruneBackups(settings.retainDaily)
      return settings
    },
    { body: t.Object({ autoEnabled: t.Boolean(), retainDaily: t.Number() }) }
  )

  .post(
    '/upload',
    async (context: any) => {
      const { requireAuth, body, set } = context
      await requireAuth()
      if (Buffer.byteLength(body.content) > MAX_UPLOAD_BYTES) {
        set.status = 413
        return { message: 'Backup file is larger than 50 MB.' }
      }
      try {
        const backup = await saveUploadedBackup(body.content)
        await recordActivity({
          serverId: 'system',
          type: 'backup_created',
          status: 'info',
          title: 'Backup uploaded',
          detail: body.fileName ? `${body.fileName} → ${backup.name}` : backup.name,
        })
        return backup
      } catch (error) {
        return fail(set, error, 'Could not store the uploaded backup.')
      }
    },
    { body: t.Object({ content: t.String(), fileName: t.Optional(t.String()) }) }
  )

  .get('/:name/download', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    const denied = await requireDangerousActionAuth(context)
    if (denied) return denied
    try {
      const content = await readBackup(params.name)
      await recordActivity({
        serverId: 'system',
        type: 'backup_downloaded',
        status: 'warning',
        title: 'Backup downloaded',
        detail: params.name,
      })
      return new Response(content, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${params.name}"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (error) {
      return fail(set, error, 'Could not read the backup.')
    }
  })

  .delete('/:name', async (context: any) => {
    const { requireAuth, params, set } = context
    await requireAuth()
    const denied = await requireDangerousActionAuth(context)
    if (denied) return denied
    try {
      await deleteBackup(params.name)
      await recordActivity({
        serverId: 'system',
        type: 'backup_deleted',
        status: 'warning',
        title: 'Backup deleted',
        detail: params.name,
      })
      set.status = 204
      return null
    } catch (error) {
      return fail(set, error, 'Could not delete the backup.')
    }
  })

  .post(
    '/:name/restore',
    async (context: any) => {
      const { requireAuth, params, body, set, request, server, cookie } = context
      await requireAuth()

      // Restoring replaces everything, so always ask for the password, whatever the re-auth setting.
      const ip = `restore:${clientKey(request, (server as RequestIp)?.requestIP(request)?.address)}`
      const limit = checkRateLimit(ip)
      if (!limit.allowed) {
        set.status = 429
        return { message: 'Too many wrong passwords. Try again in 15 minutes.' }
      }
      const db = await getDb()
      const auth = db.data.auth
      const salts = auth ? (JSON.parse(auth.salt) as { hash?: string }) : {}
      if (!auth || !(await verifyPassword(body.password, auth.passwordHash, salts.hash))) {
        recordFailedAttempt(ip)
        set.status = 401
        return { message: 'Password did not match.' }
      }
      resetRateLimit(ip)

      try {
        const data = parseBackup(await readBackup(params.name))
        // A safety copy of the current state, so a wrong restore can be undone.
        const safety = await createBackup('pre-restore')
        await replaceDb({ ...data, sessions: {}, rateLimit: { attempts: 0 } })
        await pruneBackups((await getBackupSettings()).retainDaily)
        await recordActivity({
          serverId: 'system',
          type: 'backup_restored',
          status: 'warning',
          title: 'Backup restored',
          detail: `${params.name} (previous data saved as ${safety.name})`,
        })
      } catch (error) {
        return fail(set, error, 'Restore failed. Your data was not changed.')
      }

      // Everyone signs in again, with the master password stored in the restored backup.
      clearKey()
      cookie[SESSION_COOKIE].value = ''
      cookie[SESSION_COOKIE].maxAge = 0
      return { success: true }
    },
    { body: t.Object({ password: t.String() }) }
  )
