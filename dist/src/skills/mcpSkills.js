const cache = new Map();
export class McpSkillsUnavailableError extends Error {
    constructor() {
        super('MCP skills 入口尚未恢复。');
        this.name = 'McpSkillsUnavailableError';
    }
}
export const fetchMcpSkillsForClient = Object.assign(async (_client) => {
    throw new McpSkillsUnavailableError();
}, { cache });
//# sourceMappingURL=mcpSkills.js.map