'use client'

import { useEffect, useState } from 'react'
import type { Server } from '@launchpad/shared'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type ServerFormValues = {
  name: string
  host: string
  port: string
  user: string
  sshKeyPath: string
  sshPassphrase: string
}

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

  useEffect(() => {
    setValues(getInitialValue(initialValue))
  }, [initialValue])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)

    try {
      await onSubmit({
        name: values.name,
        host: values.host,
        port: Number(values.port || 22),
        user: values.user,
        sshKeyPath: values.sshKeyPath,
        sshPassphrase: values.sshPassphrase || undefined,
      })
      if (!initialValue?.id) {
        setValues(getInitialValue())
      } else {
        setValues((current) => ({ ...current, sshPassphrase: '' }))
      }
    } finally {
      setLoading(false)
    }
  }

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
        <Input
          label="Passphrase"
          sensitive
          value={values.sshPassphrase}
          onChange={(event) => setValues((current) => ({ ...current, sshPassphrase: event.target.value }))}
          placeholder={initialValue?.id ? 'Leave blank to keep or clear' : 'Optional'}
          type="password"
          hint={initialValue?.id ? 'Entering a new value replaces the stored passphrase. Leaving it blank clears it.' : 'Only needed for encrypted private keys.'}
        />

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={loading}>
            {submitLabel}
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
