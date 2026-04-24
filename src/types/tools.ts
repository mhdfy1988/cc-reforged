import type {
  AssistantMessage,
  NormalizedUserMessage,
} from './message.js'

export type ToolProgressData = {
  type: string
  [key: string]: unknown
}

export type REPLToolProgress = ToolProgressData

export type ShellProgress<TType extends string = string> = ToolProgressData & {
  type: TType
  output?: string
  fullOutput?: string
  elapsedTimeSeconds?: number
  totalLines?: number
  totalBytes?: number
  timeoutMs?: number
  taskId?: string
  [key: string]: unknown
}

export type AgentToolProgress = ShellProgress<'agent_progress'> & {
  message?: unknown
}

export type BashProgress = ShellProgress<'bash_progress'>

export type MCPProgress = {
  [key: string]: unknown
}

export type PowerShellProgress = ShellProgress<'powershell_progress'>

export type SkillToolProgress = ToolProgressData & {
  type: 'skill_progress'
  message: AssistantMessage | NormalizedUserMessage
  prompt: string
  agentId: string
}

export type TaskOutputProgress = {
  [key: string]: unknown
}

export type WebSearchProgress = {
  [key: string]: unknown
}

export type SdkWorkflowProgress = {
  [key: string]: unknown
}
