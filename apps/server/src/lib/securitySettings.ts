import type { AuthConfig, AuthSecuritySettings } from '@launchpad/shared'

export const DEFAULT_SECURITY_SETTINGS: AuthSecuritySettings = {
  sessionDurationHours: 8,
  requireReauthForDangerousActions: false,
  reauthWindowMinutes: 15,
}

export function getSecuritySettings(config: AuthConfig | null): AuthSecuritySettings {
  return {
    sessionDurationHours: config?.sessionDurationHours ?? DEFAULT_SECURITY_SETTINGS.sessionDurationHours,
    requireReauthForDangerousActions:
      config?.requireReauthForDangerousActions ?? DEFAULT_SECURITY_SETTINGS.requireReauthForDangerousActions,
    reauthWindowMinutes: config?.reauthWindowMinutes ?? DEFAULT_SECURITY_SETTINGS.reauthWindowMinutes,
  }
}

export function clampSecuritySettings(input: Partial<AuthSecuritySettings>): AuthSecuritySettings {
  return {
    sessionDurationHours: Math.min(Math.max(Math.round(input.sessionDurationHours ?? DEFAULT_SECURITY_SETTINGS.sessionDurationHours), 1), 24),
    requireReauthForDangerousActions:
      input.requireReauthForDangerousActions ?? DEFAULT_SECURITY_SETTINGS.requireReauthForDangerousActions,
    reauthWindowMinutes: Math.min(Math.max(Math.round(input.reauthWindowMinutes ?? DEFAULT_SECURITY_SETTINGS.reauthWindowMinutes), 5), 60),
  }
}
