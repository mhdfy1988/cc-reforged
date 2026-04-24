import type { ReactNode } from 'react'
import { getMemoryScopeDisplay, type AgentMemoryScope } from '../../tools/AgentTool/agentMemory.js'

export type SnapshotUpdateDialogProps = {
  agentType: string
  scope: unknown
  snapshotTimestamp: string
  onComplete: (choice: 'merge' | 'keep' | 'replace') => void
  onCancel: () => void
  children?: ReactNode
}

export function SnapshotUpdateDialog(_props: SnapshotUpdateDialogProps) {
  return null
}

export function buildMergePrompt(
  agentType: string,
  scope: AgentMemoryScope,
): string {
  const scopeDisplay = getMemoryScopeDisplay(scope)
  return [
    `请先检查 ${agentType} 的持久记忆是否需要与较新的快照合并。`,
    `记忆范围：${scopeDisplay}`,
    '如果快照内容有价值，请在继续当前任务前先完成合并，再继续回答用户请求。',
  ].join('\n')
}
