import { getMcpSkillCommands, getSkillToolCommands } from '../commands.js'
import type { ToolUseContext } from '../Tool.js'
import type { Command } from '../types/command.js'
import {
  createSkillRuntimeCatalog,
  type SkillRuntimeCatalog,
} from './skillRuntimeCatalog.js'
import {
  getSkillRuntimeRequestContext,
  type SkillRuntimeRequestContext,
} from './skillRuntimeRequestContext.js'

export type ModelInvocableSkillRuntimeCatalog = {
  requestContext: SkillRuntimeRequestContext
  localCommands: readonly Command[]
  mcpCommands: readonly Command[]
  catalog: SkillRuntimeCatalog
}

export function createModelInvocableSkillRuntimeCatalog(input: {
  localCommands: readonly Command[]
  mcpCommands?: readonly Command[]
}): SkillRuntimeCatalog {
  return createSkillRuntimeCatalog([
    ...input.localCommands,
    ...(input.mcpCommands ?? []),
  ])
}

export async function loadModelInvocableSkillRuntimeCatalog(
  toolUseContext: ToolUseContext,
): Promise<ModelInvocableSkillRuntimeCatalog> {
  const requestContext = getSkillRuntimeRequestContext(toolUseContext)
  const localCommands = await getSkillToolCommands(requestContext.cwd, {
    configHomeDir: requestContext.configHomeDir,
  })
  const mcpCommands = getMcpSkillCommands(requestContext.mcpCommands)
  return {
    requestContext,
    localCommands,
    mcpCommands,
    catalog: createModelInvocableSkillRuntimeCatalog({
      localCommands,
      mcpCommands,
    }),
  }
}
