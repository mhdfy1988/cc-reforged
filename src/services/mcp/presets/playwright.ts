import { createCcrMcpInstallManifest } from '../installManifest.js'
import {
  createPlaywrightNpxMcpServerConfig,
  PLAYWRIGHT_MCP_SERVER_NAME,
} from '../providers/playwright/install.js'
import type { CcrMcpInstallPreset } from './types.js'

export const PLAYWRIGHT_INSTALL_PRESET: CcrMcpInstallPreset = {
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
  createServerConfig: manifest =>
    createPlaywrightNpxMcpServerConfig({
      version: manifest.version,
    }),
}
