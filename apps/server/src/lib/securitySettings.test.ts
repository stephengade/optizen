import { describe, expect, it } from 'bun:test'
import { clampSecuritySettings, DEFAULT_SECURITY_SETTINGS, getSecuritySettings } from './securitySettings'

describe('security settings helpers', () => {
  it('fills missing values from defaults', () => {
    expect(getSecuritySettings(null)).toEqual(DEFAULT_SECURITY_SETTINGS)
  })

  it('clamps the session and reauth windows into supported bounds', () => {
    expect(
      clampSecuritySettings({
        sessionDurationHours: 100,
        requireReauthForDangerousActions: true,
        reauthWindowMinutes: 1,
      })
    ).toEqual({
      sessionDurationHours: 24,
      requireReauthForDangerousActions: true,
      reauthWindowMinutes: 5,
    })
  })

  it('rounds numeric values before saving', () => {
    expect(
      clampSecuritySettings({
        sessionDurationHours: 6.6,
        requireReauthForDangerousActions: false,
        reauthWindowMinutes: 14.4,
      })
    ).toEqual({
      sessionDurationHours: 7,
      requireReauthForDangerousActions: false,
      reauthWindowMinutes: 14,
    })
  })
})
