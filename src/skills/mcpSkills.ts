import type { Command } from '../commands.js'

export type McpClientLike = {
  name: string
}

const cache = new Map<string, Command[]>()

export class McpSkillsUnavailableError extends Error {
  constructor() {
    super('MCP skills 入口尚未恢复。')
    this.name = 'McpSkillsUnavailableError'
  }
}

export const fetchMcpSkillsForClient = Object.assign(
  async (_client: McpClientLike): Promise<Command[]> => {
    throw new McpSkillsUnavailableError()
  },
  { cache },
)
