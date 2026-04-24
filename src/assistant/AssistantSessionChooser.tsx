import type { ReactNode } from 'react'
import type { AssistantSession } from './sessionDiscovery.js'
import { Dialog } from '../components/design-system/Dialog.js'
import { Box, Text } from '../ink.js'

export type AssistantSessionChooserProps = {
  sessions: AssistantSession[]
  onSelect: (sessionId: string) => void
  onCancel: () => void
  children?: ReactNode
}

export function AssistantSessionChooser(props: AssistantSessionChooserProps) {
  return (
    <Dialog
      title="Assistant 会话选择器暂不可用"
      subtitle="当前恢复版只提供显式占位，不会静默返回空白。"
      onCancel={props.onCancel}
    >
      <Box flexDirection="column" gap={1}>
        <Text>当前检测到 {props.sessions.length} 个候选会话，但选择入口尚未恢复。</Text>
        {props.children}
      </Box>
    </Dialog>
  )
}
