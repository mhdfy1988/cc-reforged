import { createCcrMcpInstallManifest, summarizeCcrMcpInstallManifest, } from './installManifest.js';
import { createPlaywrightNpxMcpServerConfig, PLAYWRIGHT_MCP_SERVER_NAME, } from './playwrightPreset.js';
const PLAYWRIGHT_INSTALL_PRESET = {
    id: PLAYWRIGHT_MCP_SERVER_NAME,
    displayName: 'Playwright MCP',
    description: '浏览器自动化、截图和网页交互。',
    trusted: true,
    manifest: createCcrMcpInstallManifest({
        name: PLAYWRIGHT_MCP_SERVER_NAME,
        displayName: 'Playwright MCP',
        description: '浏览器自动化 MCP，适合网页操作、截图和本地页面验证。',
        version: 'latest',
        source: {
            kind: 'stdio-npm-package',
            packageName: '@playwright/mcp',
            packageManager: 'npx',
        },
        transport: 'stdio',
        serverConfig: createPlaywrightNpxMcpServerConfig({
            version: 'latest',
        }),
        permissions: [
            {
                kind: 'network',
                required: true,
                description: 'May access websites requested by the user.',
            },
            {
                kind: 'process',
                required: true,
                description: 'Starts a local MCP stdio process.',
            },
        ],
        dataBoundary: 'remote-service',
        homepage: 'https://www.npmjs.com/package/@playwright/mcp',
    }),
    createServerConfig: manifest => createPlaywrightNpxMcpServerConfig({
        version: manifest.version,
    }),
};
const CCR_MCP_INSTALL_PRESETS = [
    PLAYWRIGHT_INSTALL_PRESET,
];
export function listCcrMcpInstallPresets() {
    return CCR_MCP_INSTALL_PRESETS;
}
export function getCcrMcpInstallPreset(presetId) {
    return CCR_MCP_INSTALL_PRESETS.find(preset => preset.id === presetId);
}
export function searchCcrMcpInstallPresets(input = {}) {
    const query = input.query?.trim().toLowerCase() ?? '';
    const candidates = listCcrMcpInstallPresets()
        .filter(candidate => query
        ? [
            candidate.manifest.name,
            candidate.displayName,
            candidate.description,
        ].some(value => value.toLowerCase().includes(query))
        : true)
        .map(candidate => ({
        manifest: summarizeCcrMcpInstallManifest(candidate.manifest),
        manifestInput: candidate.manifest,
        displayName: candidate.displayName,
        description: candidate.description,
        trusted: candidate.trusted,
    }));
    return {
        query,
        candidates,
    };
}
//# sourceMappingURL=installPresets.js.map