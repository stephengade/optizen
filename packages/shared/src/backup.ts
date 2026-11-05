export type BackupKind = 'manual' | 'auto' | 'pre-restore' | 'uploaded'

export interface BackupInfo {
  name: string
  kind: BackupKind
  createdAt: string
  sizeBytes: number
}

export interface BackupSettings {
  /** Take a backup automatically once a day. */
  autoEnabled: boolean
  /** How many automatic backups to keep; older ones are deleted. */
  retainDaily: number
}

export interface BackupOverview {
  directory: string
  settings: BackupSettings
  backups: BackupInfo[]
}
