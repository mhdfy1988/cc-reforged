import type { ReactNode } from 'react'
import { Dialog } from '../../components/design-system/Dialog.js'
import { Box, Text } from '../../ink.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { join } from 'path'

export async function computeDefaultInstallDir(): Promise<string> {
  return join(getClaudeConfigHomeDir(), 'assistant')
}

export type NewInstallWizardProps = {
  defaultDir: string
  onInstalled: (dir: string) => void
  onCancel: () => void
  onError: (message: string) => void
  children?: ReactNode
}

export function NewInstallWizard(props: NewInstallWizardProps) {
  return (
    <Dialog
      title="Assistant 安装向导暂不可用"
      subtitle="当前恢复版只提供显式占位，不会静默完成安装。"
      onCancel={props.onCancel}
    >
      <Box flexDirection="column" gap={1}>
        <Text>默认安装目录：{props.defaultDir}</Text>
        <Text dimColor>该入口尚未恢复为完整安装流程。</Text>
        {props.children}
      </Box>
    </Dialog>
  )
}
