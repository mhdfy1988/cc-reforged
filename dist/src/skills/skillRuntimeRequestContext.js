export function getSkillRuntimeRequestContext(toolUseContext) {
    const configHomeDir = toolUseContext.options?.configHomeDir;
    return {
        cwd: toolUseContext.options.cwd,
        ...(configHomeDir ? { configHomeDir } : {}),
        mcpCommands: toolUseContext.getAppState().mcp.commands,
    };
}
//# sourceMappingURL=skillRuntimeRequestContext.js.map