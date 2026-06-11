export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-8 lg:px-8">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--green)]">Phase 9</p>
      <h1 className="text-3xl font-semibold text-[var(--text)]">Settings</h1>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
        SMTP and outbound webhook settings are planned in Phase 9. For now, Phase 3 focuses on encrypted servers and project configuration.
      </div>
    </div>
  )
}
