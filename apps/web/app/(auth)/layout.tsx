export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm px-4">
        {/* Logo mark */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L19 6.5V15.5L11 20L3 15.5V6.5L11 2Z" stroke="var(--green)" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M11 7V11M11 11V15M11 11H7M11 11H15" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-widest text-[var(--text-muted)] uppercase">
            Launchpaddy
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
