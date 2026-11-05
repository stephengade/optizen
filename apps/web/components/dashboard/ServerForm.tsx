'use client'

import { useEffect, useState } from 'react'
import type { Server } from '@launchpad/shared'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api, ApiError } from '@/lib/api'
import { useDemoPrivacy } from '@/lib/demo-privacy-context'

type ServerFormValues = {
  name: string
  host: string
  port: string
  user: string
  sshKeyPath: string
  sshPassphrase: string
  clearSshPassphrase: boolean
  diskAlertThresholdPercent: string
}

type TestResult = { connected: boolean; latencyMs?: number; error?: string }

interface ServerFormProps {
  title: string
  description: string
  submitLabel: string
  initialValue?: Partial<Server>
  inModal?: boolean
  onSubmit: (payload: {
    name: string
    host: string
    port: number
    user: string
    sshKeyPath: string
    sshPassphrase?: string
    clearSshPassphrase?: boolean
    diskAlertThresholdPercent?: number
  }) => Promise<void>
  onDelete?: () => Promise<void>
}

function getInitialValue(initialValue?: Partial<Server>): ServerFormValues {
  return {
    name: initialValue?.name ?? '',
    host: initialValue?.host ?? '',
    port: initialValue?.port ? String(initialValue.port) : '22',
    user: initialValue?.user ?? 'root',
    sshKeyPath: initialValue?.sshKeyPath ?? '',
    sshPassphrase: '',
    clearSshPassphrase: false,
    diskAlertThresholdPercent: initialValue?.diskAlertThresholdPercent ? String(initialValue.diskAlertThresholdPercent) : '50',
  }
}

export function ServerForm({
  title,
  description,
  submitLabel,
  initialValue,
  inModal = false,
  onSubmit,
  onDelete,
}: ServerFormProps) {
  const [values, setValues] = useState<ServerFormValues>(getInitialValue(initialValue))
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [showPassphrase, setShowPassphrase] = useState(false)
  const { demoMode } = useDemoPrivacy()
  const isEdit = Boolean(initialValue?.id)
  const hasStoredPassphrase = Boolean(initialValue?.hasSshPassphrase ?? initialValue?.sshPassphrase)
  const thresholdValue = Number(values.diskAlertThresholdPercent)
  const thresholdError =
    values.diskAlertThresholdPercent.trim().length > 0
    && (!Number.isFinite(thresholdValue) || thresholdValue < 1 || thresholdValue > 100)
      ? 'Enter a percentage between 1 and 100.'
      : undefined

  useEffect(() => {
    setValues(getInitialValue(initialValue))
  }, [initialValue])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (thresholdError) {
      return
    }
    setLoading(true)

    try {
      await onSubmit({
        name: values.name,
        host: values.host,
        port: Number(values.port || 22),
        user: values.user,
        sshKeyPath: values.sshKeyPath,
        sshPassphrase: values.sshPassphrase || undefined,
        clearSshPassphrase: isEdit && !values.sshPassphrase && values.clearSshPassphrase ? true : undefined,
        diskAlertThresholdPercent: Number(values.diskAlertThresholdPercent || 50),
      })
      if (!initialValue?.id) {
        setValues(getInitialValue())
      } else {
        setValues((current) => ({ ...current, sshPassphrase: '', clearSshPassphrase: false }))
      }
      setTestResult(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleTestConnection() {
    if (demoMode) {
      toast.success('Demo mode is active. Connection tests are disabled.')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.post<TestResult>('/servers/test-connection', {
        host: values.host,
        port: Number(values.port || 22),
        user: values.user,
        sshKeyPath: values.sshKeyPath,
        sshPassphrase: values.sshPassphrase || undefined,
        serverId: initialValue?.id,
        clearSshPassphrase: values.clearSshPassphrase || undefined,
      })
      setTestResult(result)
    } catch (error) {
      setTestResult({ connected: false, error: error instanceof ApiError ? error.message : 'Connection test failed' })
    } finally {
      setTesting(false)
    }
  }

  const canTest = Boolean(values.host.trim() && values.user.trim() && values.sshKeyPath.trim())

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className={inModal ? '' : 'border border-(--border) bg-(--surface) p-6'}>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-(--text)">{title}</h2>
        <p className="mt-1 text-sm text-(--text-muted)">{description}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Server name"
          value={values.name}
          onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
          placeholder="Production EU"
          required
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Host"
            sensitive
            value={values.host}
            onChange={(event) => setValues((current) => ({ ...current, host: event.target.value }))}
            placeholder="203.0.113.10"
            required
          />
          <Input
            label="Port"
            value={values.port}
            onChange={(event) => setValues((current) => ({ ...current, port: event.target.value }))}
            placeholder="22"
            inputMode="numeric"
            required
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="SSH user"
            sensitive
            value={values.user}
            onChange={(event) => setValues((current) => ({ ...current, user: event.target.value }))}
            placeholder="deploy"
            required
          />
          <Input
            label="SSH key path"
            sensitive
            value={values.sshKeyPath}
            onChange={(event) => setValues((current) => ({ ...current, sshKeyPath: event.target.value }))}
            placeholder="C:\\Users\\you\\.ssh\\id_ed25519"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Key passphrase"
                sensitive
                value={values.sshPassphrase}
                onChange={(event) => setValues((current) => ({ ...current, sshPassphrase: event.target.value, clearSshPassphrase: false }))}
                placeholder={isEdit && hasStoredPassphrase ? 'Stored — leave blank to keep it' : 'Only if the key is encrypted'}
                type={showPassphrase ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={values.clearSshPassphrase}
              />
            </div>
            <Button type="button" variant="ghost" size="sm" className="mb-0.5" onClick={() => setShowPassphrase((v) => !v)}>
              {showPassphrase ? 'Hide' : 'Show'}
            </Button>
          </div>
          <p className="text-xs text-(--text-muted)">
            {isEdit && hasStoredPassphrase
              ? 'A passphrase is stored (encrypted). Type a new one to replace it, or leave blank to keep it.'
              : 'Required if your private key was created with a passphrase. Stored encrypted; spaces are kept as typed.'}
          </p>
          {isEdit && hasStoredPassphrase ? (
            <label className="mt-1 flex items-center gap-2 text-xs text-(--text-muted)">
              <input
                type="checkbox"
                checked={values.clearSshPassphrase}
                onChange={(event) => setValues((current) => ({ ...current, clearSshPassphrase: event.target.checked, sshPassphrase: '' }))}
              />
              Remove the stored passphrase (the key is not encrypted)
            </label>
          ) : null}
        </div>
        <Input
          label="Disk alert threshold (%)"
          value={values.diskAlertThresholdPercent}
          onChange={(event) => setValues((current) => ({ ...current, diskAlertThresholdPercent: event.target.value }))}
          placeholder="50"
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          error={thresholdError}
          hint="Optizen sends a disk warning when root disk usage reaches this percentage. Defaults to 50%."
        />

        {testResult ? (
          <div
            className={`border px-3 py-2 text-xs ${testResult.connected ? 'border-(--accent) text-(--accent)' : 'border-(--red) text-(--red)'}`}
            role="status"
          >
            {testResult.connected
              ? `Connected${testResult.latencyMs !== undefined ? ` in ${testResult.latencyMs} ms` : ''}. These settings work.`
              : testResult.error ?? 'Connection failed'}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={loading}>
            {submitLabel}
          </Button>
          <Button type="button" variant="ghost" loading={testing} disabled={!canTest} onClick={() => void handleTestConnection()}>
            Test connection
          </Button>
          {onDelete ? (
            <Button type="button" variant="danger" loading={deleting} onClick={handleDelete}>
              Delete server
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
