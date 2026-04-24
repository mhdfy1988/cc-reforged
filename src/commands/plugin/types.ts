export type ViewState =
  | 'menu'
  | 'plugin-list'
  | 'plugin-details'
  | 'configuring'
  | 'confirm-project-uninstall'
  | {
      type: 'help'
    }
  | {
      type: 'validate'
      path: string
    }
  | {
      type: 'marketplace-list'
    }
  | {
      type: 'marketplace-menu'
    }
  | {
      type: 'browse-marketplace'
      targetMarketplace?: string
      targetPlugin?: string
      action?: 'add' | 'remove' | 'update'
    }
  | {
      type: 'discover-plugins'
      targetPlugin?: string
    }
  | {
      type: 'manage-plugins'
      targetPlugin?: string
      targetMarketplace?: string
      action?: 'enable' | 'disable' | 'uninstall' | 'update'
    }
  | {
      type: 'manage-marketplaces'
      targetMarketplace?: string
      action?: 'remove' | 'update'
    }
  | {
      type: 'add-marketplace'
      initialValue?: string
    }
  | {
      type: 'plugin-options'
      plugin?: unknown
      pluginId?: string
    }
  | {
      type: 'configuring-options'
      schema: Record<string, unknown>
    }
  | {
      type: 'flagged-detail'
      plugin: {
        id: string
        name: string
        marketplace: string
        reason: string
        text: string
        flaggedAt: string
      }
    }
  | {
      type: 'failed-plugin-details'
      plugin: {
        id: string
        name: string
        marketplace: string
        errors: unknown[]
        scope: string
      }
    }
  | {
      type: 'mcp-detail'
      client: unknown
    }
  | {
      type: 'mcp-tools'
      client: unknown
    }
  | {
      type: 'mcp-tool-detail'
      client: unknown
      tool: unknown
    }

export type PluginSettingsProps = {
  viewState?: ViewState
  setViewState?: (state: ViewState) => void
  [key: string]: unknown
}
