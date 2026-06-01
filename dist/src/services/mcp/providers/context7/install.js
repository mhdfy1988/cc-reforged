import { getPlatform } from '../../../../utils/platform.js';
export const CONTEXT7_MCP_SERVER_NAME = 'context7';
export const CONTEXT7_MCP_PACKAGE_NAME = '@upstash/context7-mcp';
function normalizeContext7Version(version) {
    const normalized = version?.trim();
    return normalized || 'latest';
}
export function getContext7PackageRef(version) {
    return `${CONTEXT7_MCP_PACKAGE_NAME}@${normalizeContext7Version(version)}`;
}
export function createContext7NpxMcpServerConfig(options = {}) {
    const args = ['-y', getContext7PackageRef(options.version)];
    if (getPlatform() === 'windows') {
        return {
            type: 'stdio',
            command: 'npx.cmd',
            args,
        };
    }
    return {
        type: 'stdio',
        command: 'npx',
        args,
    };
}
//# sourceMappingURL=install.js.map