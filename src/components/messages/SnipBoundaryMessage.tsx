import React from 'react'
import { CompactBoundaryMessage } from './CompactBoundaryMessage.js'

export type SnipBoundaryMessageProps = {
  message?: unknown
}

export function SnipBoundaryMessage(_props: SnipBoundaryMessageProps): React.ReactNode {
  return <CompactBoundaryMessage />
}
