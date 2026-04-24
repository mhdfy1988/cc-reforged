import React from 'react'

type Props = {
  workflow: unknown
  onDone: () => void
  onKill?: () => void
  onSkipAgent?: (agentId: string) => void
  onRetryAgent?: (agentId: string) => void
  onBack: () => void
}

export function WorkflowDetailDialog(_props: Props): React.ReactNode {
  return null
}
