'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { GlobalWebhook, NotificationEvent, SmtpConfig } from '@launchpad/shared'
import { ArrowRight, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api, ApiError } from '@/lib/api'
import { useDemoPrivacy } from '@/lib/demo-privacy-context'

interface NotificationSettingsResponse {
  email: SmtpConfig | null
  globalWebhooks: GlobalWebhook[]
}

function createEmptySmtp(): SmtpConfig {
  return {
    host: '',
    port: 587,
    secure: false,
    user: '',
    password: '',
    from: '',
    to: [],
  }
}

function createWebhook(): GlobalWebhook {
  return {
    id: `local-${Date.now()}-${Math.random()}`,
    name: '',
    url: '',
    secret: '',
    enabled: true,
    events: ['deploy.success', 'deploy.failed'],
  }
}

export default function SettingsPage() {
  const { enabled: demoPrivacy, setEnabled: setDemoPrivacy } = useDemoPrivacy()
  const [smtp, setSmtp] = useState<SmtpConfig>(createEmptySmtp())
  const [smtpEnabled, setSmtpEnabled] = useState(false)
  const [toValue, setToValue] = useState('')
  const [webhooks, setWebhooks] = useState<GlobalWebhook[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  async function loadSettings() {
    try {
      const data = await api.get<NotificationSettingsResponse>('/notifications/settings')
      if (data.email) {
        setSmtpEnabled(true)
        setSmtp(data.email)
        setToValue(data.email.to.join(', '))
      } else {
        setSmtpEnabled(false)
        setSmtp(createEmptySmtp())
        setToValue('')
      }
      setWebhooks(data.globalWebhooks)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load settings'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await api.put('/notifications/settings', {
        email: smtpEnabled
          ? {
              ...smtp,
              to: toValue.split(',').map((value) => value.trim()).filter(Boolean),
            }
          : null,
        globalWebhooks: webhooks,
      })
      toast.success('Notification settings saved')
      void loadSettings()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to save settings'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTestEmail() {
    setTesting(true)
    try {
      await api.post('/notifications/test-email', {
        smtp: {
          ...smtp,
          to: toValue.split(',').map((value) => value.trim()).filter(Boolean),
        },
      })
      toast.success('Test email sent')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to send test email'
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  function toggleEvent(index: number, event: NotificationEvent) {
    setWebhooks((current) =>
      current.map((webhook, currentIndex) => {
        if (currentIndex !== index) return webhook
        const exists = webhook.events.includes(event)
        return {
          ...webhook,
          events: exists ? webhook.events.filter((item) => item !== event) : [...webhook.events, event],
        }
      })
    )
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 lg:px-8">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          Loading settings...
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-8">
      <section>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--green)]">Phase 9</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--text)]">Settings</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Configure SMTP delivery and global outbound webhooks for deploy notifications.
        </p>
      </section>

      <section className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 text-[var(--text)]">
              <BookOpen size={18} className="text-[var(--yellow)]" />
              <h2 className="text-lg font-semibold">Need setup guidance?</h2>
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              The help page explains Launchpad&apos;s trust model, project types, first-server checklist, and recommended operator workflow.
            </p>
          </div>
          <Link
            href="/help"
            className="inline-flex items-center gap-2 rounded-[16px] border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            Open help
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Demo privacy</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Hide sensitive values across Launchpad when screen-sharing or recording demos.
            </p>
          </div>
          <label className="flex items-center gap-3 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={demoPrivacy}
              onChange={(event) => setDemoPrivacy(event.target.checked)}
              className="h-4 w-4 accent-[var(--green)]"
            />
            Hide sensitive data
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">SMTP</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Used for deploy success and failure emails.</p>
          </div>
          <label className="flex items-center gap-3 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={smtpEnabled}
              onChange={(event) => setSmtpEnabled(event.target.checked)}
              className="h-4 w-4 accent-[var(--green)]"
            />
            Enable SMTP
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input label="Host" sensitive value={smtp.host} onChange={(event) => setSmtp((c) => ({ ...c, host: event.target.value }))} />
          <Input label="Port" value={String(smtp.port)} onChange={(event) => setSmtp((c) => ({ ...c, port: Number(event.target.value || 0) }))} />
          <Input label="User" sensitive value={smtp.user} onChange={(event) => setSmtp((c) => ({ ...c, user: event.target.value }))} />
          <Input label="Password" sensitive type="password" value={smtp.password} onChange={(event) => setSmtp((c) => ({ ...c, password: event.target.value }))} />
          <Input label="From" sensitive value={smtp.from} onChange={(event) => setSmtp((c) => ({ ...c, from: event.target.value }))} />
          <Input label="To" sensitive value={toValue} onChange={(event) => setToValue(event.target.value)} hint="Comma-separated recipient emails" />
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-3 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={smtp.secure}
              onChange={(event) => setSmtp((c) => ({ ...c, secure: event.target.checked }))}
              className="h-4 w-4 accent-[var(--green)]"
            />
            Use secure transport
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => void handleSave()} loading={saving}>
            Save settings
          </Button>
          <Button variant="ghost" onClick={() => void handleTestEmail()} loading={testing} disabled={!smtpEnabled}>
            Send test email
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Global webhooks</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">These fire for all deploys across all projects.</p>
          </div>
          <Button variant="ghost" onClick={() => setWebhooks((current) => [...current, createWebhook()])}>
            Add webhook
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          {webhooks.length > 0 ? (
            webhooks.map((webhook, index) => (
              <div key={webhook.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Name"
                    value={webhook.name}
                    onChange={(event) =>
                      setWebhooks((current) =>
                        current.map((item, currentIndex) => currentIndex === index ? { ...item, name: event.target.value } : item)
                      )
                    }
                  />
                  <Input
                    label="URL"
                    sensitive
                    value={webhook.url}
                    onChange={(event) =>
                      setWebhooks((current) =>
                        current.map((item, currentIndex) => currentIndex === index ? { ...item, url: event.target.value } : item)
                      )
                    }
                  />
                  <Input
                    label="Secret"
                    sensitive
                    type="password"
                    value={webhook.secret ?? ''}
                    onChange={(event) =>
                      setWebhooks((current) =>
                        current.map((item, currentIndex) => currentIndex === index ? { ...item, secret: event.target.value } : item)
                      )
                    }
                  />
                  <label className="flex items-center gap-3 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
                    <input
                      type="checkbox"
                      checked={webhook.enabled}
                      onChange={(event) =>
                        setWebhooks((current) =>
                          current.map((item, currentIndex) => currentIndex === index ? { ...item, enabled: event.target.checked } : item)
                        )
                      }
                      className="h-4 w-4 accent-[var(--green)]"
                    />
                    Enabled
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {(['deploy.success', 'deploy.failed'] as NotificationEvent[]).map((event) => (
                    <label key={event} className="flex items-center gap-2 text-sm text-[var(--text)]">
                      <input
                        type="checkbox"
                        checked={webhook.events.includes(event)}
                        onChange={() => toggleEvent(index, event)}
                        className="h-4 w-4 accent-[var(--green)]"
                      />
                      {event}
                    </label>
                  ))}
                </div>

                <div className="mt-4">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setWebhooks((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                  >
                    Remove webhook
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-muted)]">
              No global webhooks configured yet.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
