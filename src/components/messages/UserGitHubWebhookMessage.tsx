import React from 'react'
import { Box, Text } from '../../ink.js'

type Props = {
  addMargin: boolean
  param: {
    text?: string
    from?: string
    [key: string]: unknown
  }
}

export function UserGitHubWebhookMessage({ addMargin, param }: Props): React.ReactNode {
  return (
    <Box marginLeft={addMargin ? 2 : 0}>
      <Text dimColor>{param.text ?? param.from ?? 'GitHub webhook activity'}</Text>
    </Box>
  )
}
