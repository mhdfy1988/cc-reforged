import type { AgentDefinition } from '../tools/AgentTool/loadAgentsDir.js'

export type CoordinatorAgent = AgentDefinition

export function getCoordinatorAgents(): CoordinatorAgent[] {
  throw new Error('coordinator workerAgent 入口尚未恢复。')
}
