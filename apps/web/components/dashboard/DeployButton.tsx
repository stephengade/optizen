'use client'

import type { DeployStatus } from '@launchpad/shared'
import { Rocket } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface DeployButtonProps {
  status: DeployStatus
  onDeploy: () => void
  disabled?: boolean
}

export function DeployButton({ status, onDeploy, disabled }: DeployButtonProps) {
  return (
    <Button onClick={onDeploy} disabled={disabled || status === 'deploying'} loading={status === 'deploying'}>
      <Rocket size={14} />
      {status === 'deploying' ? 'Deploying...' : 'Deploy now'}
    </Button>
  )
}
