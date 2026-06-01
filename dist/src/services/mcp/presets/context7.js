import { createCcrMcpInstallManifest } from '../installManifest.js';
import { CONTEXT7_MCP_PACKAGE_NAME, CONTEXT7_MCP_SERVER_NAME, createContext7NpxMcpServerConfig, } from '../providers/context7/install.js';
export const CONTEXT7_INSTALL_PRESET = {
    id: CONTEXT7_MCP_SERVER_NAME,
    displayName: 'Context7 MCP',
    description: '按需检索库文档和代码示例。',
    trusted: true,
    manifest: createCcrMcpInstallManifest({
        name: CONTEXT7_MCP_SERVER_NAME,
        displayName: 'Context7 MCP',
        description: 'Context7 文档 MCP，适合按库名检索最新 API 文档和代码示例。',
        version: 'latest',
        source: {
            kind: 'stdio-npm-package',
            packageName: CONTEXT7_MCP_PACKAGE_NAME,
            packageManager: 'npx',
        },
        transport: 'stdio',
        serverConfig: createContext7NpxMcpServerConfig({
            version: 'latest',
        }),
        permissions: [
            {
                kind: 'network',
                required: true,
                description: 'Queries the Context7 documentation service for library documentation.',
            },
            {
                kind: 'process',
                required: true,
                description: 'Starts a local MCP stdio process.',
            },
        ],
        dataBoundary: 'remote-service',
        homepage: 'https://github.com/upstash/context7',
    }),
    createServerConfig: manifest => createContext7NpxMcpServerConfig({
        version: manifest.version,
    }),
};
//# sourceMappingURL=context7.js.map