'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ActivityEvent, AuthSecuritySettings, GlobalWebhook, NotificationEvent, SmtpConfig } from '@launchpad/shared'
import { toast } from 'sonner'
import { ActivityTimeline } from '@/components/dashboard/ActivityTimeline'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { ReauthModal } from '@/components/ui/ReauthModal'
import { api, ApiError, isReauthRequiredError } from '@/lib/api'
import { useDemoPrivacy } from '@/lib/demo-privacy-context'

interface NotificationSettingsResponse {
  email: SmtpConfig | null
  globalWebhooks: GlobalWebhook[]
}

function createEmptySmtp(): SmtpConfig {
  return { host: '', port: 587, secure: false, user: '', password: '', from: '', to: [] }
}

function createWebhook(): GlobalWebhook {
  return {
    id: `local-${Date.now()}-${Math.random()}`,
    name: '', url: '', secret: '', enabled: true,
    events: ['deploy.success', 'deploy.failed'],
  }
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border border-(--border) bg-(--surface)">
      <div className="px-5 py-4 border-b border-(--border)">
        <h2 className="text-sm font-semibold text-(--text)">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-(--text-muted)">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export default function SettingsPage() {
  const { enabled: demoPrivacy, setEnabled: setDemoPrivacy, demoMode, setDemoMode } = useDemoPrivacy()
  const [smtp, setSmtp] = useState<SmtpConfig>(createEmptySmtp())
  const [smtpEnabled, setSmtpEnabled] = useState(false)
  const [toValue, setToValue] = useState('')
  const [webhooks, setWebhooks] = useState<GlobalWebhook[]>([])
  const [security, setSecurity] = useState<AuthSecuritySettings>({
    sessionDurationHours: 8,
    requireReauthForDangerousActions: false,
    reauthWindowMinutes: 15,
  })
  const [audit, setAudit] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [reauthOpen, setReauthOpen] = useState(false)

  async function loadSettings() {
    try {
      const [data, securityData, auditData] = await Promise.all([
        api.get<NotificationSettingsResponse>('/notifications/settings'),
        api.get<AuthSecuritySettings>('/auth/settings'),
        api.get<ActivityEvent[]>('/auth/audit'),
      ])
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
      setSecurity(securityData)
      setAudit(auditData)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadSettings() }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all([
        api.put('/notifications/settings', {
          email: smtpEnabled
            ? { ...smtp, to: toValue.split(',').map((v) => v.trim()).filter(Boolean) }
            : null,
          globalWebhooks: webhooks,
        }),
        api.put('/auth/settings', security),
      ])
      toast.success('Settings saved')
      void loadSettings()
    } catch (err) {
      if (isReauthRequiredError(err)) {
        setReauthOpen(true)
        toast.error('Verify your session to update security settings.')
        return
      }
      toast.error(err instanceof ApiError ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleTestEmail() {
    setTesting(true)
    try {
      await api.post('/notifications/test-email', {
        smtp: { ...smtp, to: toValue.split(',').map((v) => v.trim()).filter(Boolean) },
      })
      toast.success('Test email sent')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send test email')
    } finally {
      setTesting(false)
    }
  }

  function toggleEvent(index: number, event: NotificationEvent) {
    setWebhooks((cur) =>
      cur.map((wh, i) => {
        if (i !== index) return wh
        const exists = wh.events.includes(event)
        return { ...wh, events: exists ? wh.events.filter((e) => e !== event) : [...wh.events, event] }
      })
    )
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <LoadingState label="Loading settings" detail="Fetching session, notification, and display preferences." compact />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-(--text)">Settings</h1>
        <p className="mt-1 text-sm text-(--text-muted)">Session security, backups, notifications, and display preferences.</p>
      </div>

      <div className="space-y-px">
        {/* Display */}
        <Section title="Display" description="Control what is visible in the UI.">
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-sm text-(--text)">Demo privacy</div>
                <div className="text-xs text-(--text-muted) mt-0.5">Mask sensitive values — useful when screen-sharing.</div>
              </div>
              <input
                type="checkbox"
                checked={demoPrivacy}
                onChange={(e) => setDemoPrivacy(e.target.checked)}
                className="h-4 w-4 accent-(--accent)"
              />
            </label>
            <div className="border-t border-(--border) pt-4">
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm text-(--text)">Seeded demo mode</div>
                  <div className="text-xs text-(--text-muted) mt-0.5">Show sample servers and data instead of live infrastructure.</div>
                </div>
                <input
                  type="checkbox"
                  checked={demoMode}
                  onChange={(e) => setDemoMode(e.target.checked)}
                  className="h-4 w-4 accent-(--accent)"
                />
              </label>
            </div>
          </div>
        </Section>

        {/* Backups */}
        <Section title="Backups" description="Daily copies of all Optizen data, plus download and restore.">
          <Link
            href="/settings/backups"
            className="inline-flex items-center gap-2 border border-(--border) px-3 py-1.5 text-xs font-medium text-(--text) transition-colors hover:border-(--border-strong)"
          >
            Manage backups
          </Link>
        </Section>

        {/* Session security */}
        <Section title="Session security" description="Control session length and re-authentication requirements.">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Session duration (hours)"
                value={String(security.sessionDurationHours)}
                onChange={(e) => setSecurity((c) => ({ ...c, sessionDurationHours: Number(e.target.value || 0) }))}
                inputMode="numeric"
              />
              <Input
                label="Re-auth window (minutes)"
                value={String(security.reauthWindowMinutes)}
                onChange={(e) => setSecurity((c) => ({ ...c, reauthWindowMinutes: Number(e.target.value || 0) }))}
                inputMode="numeric"
              />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={security.requireReauthForDangerousActions}
                onChange={(e) => setSecurity((c) => ({ ...c, requireReauthForDangerousActions: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-(--accent)"
              />
              <div>
                <div className="text-sm text-(--text)">Require re-auth for dangerous actions</div>
                <div className="text-xs text-(--text-muted) mt-0.5">Deploys, rollbacks, deletes, env writes, and proxy reloads will require a fresh password check.</div>
              </div>
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setReauthOpen(true)}>Verify session now</Button>
            </div>
          </div>
        </Section>

        {/* SMTP */}
        <Section title="SMTP" description="Email notifications for deploy success and failure.">
          <div className="space-y-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={smtpEnabled}
                onChange={(e) => setSmtpEnabled(e.target.checked)}
                className="h-4 w-4 accent-(--accent)"
              />
              <span className="text-sm text-(--text)">Enable SMTP</span>
            </label>

            {smtpEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <Input label="Host" sensitive value={smtp.host} onChange={(e) => setSmtp((c) => ({ ...c, host: e.target.value }))} />
                <Input label="Port" value={String(smtp.port)} onChange={(e) => setSmtp((c) => ({ ...c, port: Number(e.target.value || 0) }))} />
                <Input label="User" sensitive value={smtp.user} onChange={(e) => setSmtp((c) => ({ ...c, user: e.target.value }))} />
                <Input label="Password" sensitive type="password" value={smtp.password} onChange={(e) => setSmtp((c) => ({ ...c, password: e.target.value }))} />
                <Input label="From" sensitive value={smtp.from} onChange={(e) => setSmtp((c) => ({ ...c, from: e.target.value }))} />
                <Input label="To" sensitive value={toValue} onChange={(e) => setToValue(e.target.value)} hint="Comma-separated" />
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtp.secure}
                      onChange={(e) => setSmtp((c) => ({ ...c, secure: e.target.checked }))}
                      className="h-4 w-4 accent-(--accent)"
                    />
                    <span className="text-sm text-(--text)">Use secure transport (TLS)</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => void handleSave()} loading={saving}>Save settings</Button>
              {smtpEnabled && (
                <Button variant="ghost" onClick={() => void handleTestEmail()} loading={testing}>
                  Send test email
                </Button>
              )}
            </div>
          </div>
        </Section>

        {/* Webhooks */}
        <Section title="Global webhooks" description="Fire on all deploys across all projects.">
          <div className="space-y-4">
            {webhooks.length > 0 ? (
              webhooks.map((webhook, index) => (
                <div key={webhook.id} className="border border-(--border) bg-(--surface-2) p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Name"
                      value={webhook.name}
                      onChange={(e) => setWebhooks((cur) => cur.map((w, i) => i === index ? { ...w, name: e.target.value } : w))}
                    />
                    <Input
                      label="URL"
                      sensitive
                      value={webhook.url}
                      onChange={(e) => setWebhooks((cur) => cur.map((w, i) => i === index ? { ...w, url: e.target.value } : w))}
                    />
                    <Input
                      label="Secret"
                      sensitive
                      type="password"
                      value={webhook.secret ?? ''}
                      onChange={(e) => setWebhooks((cur) => cur.map((w, i) => i === index ? { ...w, secret: e.target.value } : w))}
                    />
                    <label className="flex items-center gap-3 cursor-pointer border border-(--border) bg-(--surface) px-3 py-2 text-sm text-(--text)">
                      <input
                        type="checkbox"
                        checked={webhook.enabled}
                        onChange={(e) => setWebhooks((cur) => cur.map((w, i) => i === index ? { ...w, enabled: e.target.checked } : w))}
                        className="h-4 w-4 accent-(--accent)"
                      />
                      Enabled
                    </label>
                  </div>
                  <div className="flex items-center gap-4">
                    {(['deploy.success', 'deploy.failed', 'server.disk_warning'] as NotificationEvent[]).map((event) => (
                      <label key={event} className="flex items-center gap-2 text-xs text-(--text-muted) cursor-pointer">
                        <input
                          type="checkbox"
                          checked={webhook.events.includes(event)}
                          onChange={() => toggleEvent(index, event)}
                          className="h-3.5 w-3.5 accent-(--accent)"
                        />
                        {event}
                      </label>
                    ))}
                    <Button
                      variant="danger"
                      size="sm"
                      className="ml-auto"
                      onClick={() => setWebhooks((cur) => cur.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-(--text-muted)">No webhooks configured.</p>
            )}
            <Button variant="ghost" size="sm" onClick={() => setWebhooks((cur) => [...cur, createWebhook()])}>
              Add webhook
            </Button>
            {webhooks.length > 0 && (
              <Button onClick={() => void handleSave()} loading={saving} className="ml-2">Save settings</Button>
            )}
          </div>
        </Section>
      </div>

      {/* Audit trail */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-(--text) mb-4">Security audit trail</h2>
        <ActivityTimeline
          events={audit}
          emptyLabel="No audit events yet. Session elevations, security setting changes, and sensitive reveals will appear here."
        />
      </div>

      <ReauthModal
        open={reauthOpen}
        onClose={() => setReauthOpen(false)}
        onSuccess={() => void loadSettings()}
      />
    </div>
  )
}
