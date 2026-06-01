import type { CcrMcpInstallManifest } from '../installManifest.js'
import type { McpServerConfig } from '../types.js'

export type CcrMcpInstallPreset = {
  id: string
  displayName: string
  description: string
  trusted: boolean
  manifest: CcrMcpInstallManifest
  createServerConfig: (manifest: CcrMcpInstallManifest) => McpServerConfig
}
