import type { Tools } from '../../../Tool.js'

export type AgentWizardLocation =
  | 'userSettings'
  | 'projectSettings'
  | 'local'
  | 'workspace'
  | string

export type AgentWizardFinalAgent = {
  agentType: string
  whenToUse: string
  getSystemPrompt: () => string
  tools?: Tools | string[] | null
  model?: string | null
  color?: string | null
  memory?: string | null
}

export type AgentWizardData = {
  agentType?: string
  whenToUse?: string
  systemPrompt?: string
  generationPrompt?: string
  selectedTools?: Tools | string[] | null
  selectedModel?: string | null
  selectedColor?: string | null
  selectedMemory?: string | null
  location?: AgentWizardLocation
  finalAgent?: AgentWizardFinalAgent | null
  generatedAgent?: Record<string, unknown> | null
  wasGenerated?: boolean
}
