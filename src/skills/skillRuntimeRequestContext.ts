import type { ToolUseContext } from '../Tool.js'
import type { Command } from '../types/command.js'

export type SkillRuntimeRequestContext = {
  cwd: string
  configHomeDir?: string
  mcpCommands: readonly Command[]
}

export function getSkillRuntimeRequestContext(
  toolUseContext: ToolUseContext,
): SkillRuntimeRequestContext {
  const configHomeDir = toolUseContext.options?.configHomeDir
  return {
    cwd: toolUseContext.options.cwd,
    ...(configHomeDir ? { configHomeDir } : {}),
    mcpCommands: toolUseContext.getAppState().mcp.commands,
  }
}
