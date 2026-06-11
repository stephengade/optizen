export interface AuthConfig {
  passwordHash: string
  salt: string
  isSetup: boolean
 
  totpEnabled: boolean
  totpSecret?: string         
}

export interface AuthSession {
  userId: string
  createdAt: string
  expiresAt: string
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
