export type ActivityStatus = 'info' | 'success' | 'warning' | 'error'

export type ActivityType =
  | 'deploy_started'
  | 'deploy_succeeded'
  | 'deploy_failed'
  | 'rollback_started'
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'project_imported'
  | 'env_updated'
  | 'proxy_config_updated'
  | 'proxy_reloaded'
  | 'nginx_site_toggled'
  | 'health_check_passed'
  | 'health_check_failed'
  | 'server_storage_cleaned'
  | 'server_memory_freed'
  | 'session_elevated'
  | 'security_settings_updated'
  | 'secret_revealed'
  | 'backup_created'
  | 'backup_deleted'
  | 'backup_restored'
  | 'backup_downloaded'
  | 'database_added'
  | 'database_removed'
  | 'database_write'

export interface ActivityEvent {
  id: string
  serverId: string
  projectId?: string
  type: ActivityType
  status: ActivityStatus
  title: string
  detail?: string
  createdAt: string
}
