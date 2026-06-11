export interface AuthConfig {
  passwordHash: string
  salt: string
  isSetup: boolean
  totpEnabled: boolean
  totpSecret?: string
  sessionDurationHours?: number
  requireReauthForDangerousActions?: boolean
  reauthWindowMinutes?: number
}

export interface AuthSession {
  id: string
  userId: string
  createdAt: string
  expiresAt: string
  elevatedUntil?: string
}

export interface LoginInput {
  password: string
}

export interface AuthResponse {
  success: boolean
  error?: string
}

export interface RateLimitState {
  attempts: number
  lockedUntil?: string
}

export interface AuthSecuritySettings {
  sessionDurationHours: number
  requireReauthForDangerousActions: boolean
  reauthWindowMinutes: number
}
