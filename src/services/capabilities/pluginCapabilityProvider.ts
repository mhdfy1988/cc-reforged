import type { ExtensionCapability } from './capabilityTypes.js'
import type {
  ExtensionCapabilityProvider,
  ExtensionCapabilityProviderContext,
} from './capabilityCatalog.js'
import type { LoadedPlugin, PluginError } from '../../types/plugin.js'
import { resolveLoadedPluginId } from './pluginIdentityResolver.js'
import type { CapabilityRuntimeEnvironment } from './capabilityRuntimeEnvironment.js'
import { createExtensionCapabilityId } from './capabilityIdentity.js'

export type PluginCapabilityProviderInput = {
  plugins?: readonly ExtensionCapability[]
  loadedPlugins?: readonly LoadedPlugin[]
  pluginLoadErrors?: readonly PluginError[]
}

export type PluginCapabilityProviderContext =
  ExtensionCapabilityProviderContext &
    PluginCapabilityProviderInput & {
      capabilityEnvironment?: CapabilityRuntimeEnvironment
    }

export function createPluginCapabilityProvider(
  input: PluginCapabilityProviderInput = {},
): ExtensionCapabilityProvider {
  return {
    id: 'plugins',
    async listCapabilities(context) {
      const runtimePlugins = (context as PluginCapabilityProviderContext).plugins
      const explicitCapabilities = runtimePlugins ?? input.plugins
      const loadedPlugins = resolveLoadedPlugins(
        context as PluginCapabilityProviderContext,
        input,
      )
      return [
        ...(explicitCapabilities ?? []),
        ...listPluginBundleCapabilities(loadedPlugins.plugins),
        ...pluginLoadErrorsToCapabilities(loadedPlugins.errors),
      ]
    },
  }
}

export function listPluginBundleCapabilities(
  plugins: readonly LoadedPlugin[] = [],
): ExtensionCapability[] {
  return plugins.map(pluginToCapability)
}

function pluginToCapability(plugin: LoadedPlugin): ExtensionCapability {
  const enabled = plugin.enabled !== false
  const pluginId = resolveLoadedPluginId(plugin)
  const componentCounts = getPluginComponentCounts(plugin)
  const sourceKind = plugin.isBuiltin ? 'builtin' : 'plugin'
  return {
    schemaVersion: 1,
    id: createExtensionCapabilityId({
      kind: 'plugin',
      sourceKind,
      name: pluginId,
      sourceRef: plugin.source,
      pluginId,
    }),
    name: plugin.name,
    displayName: plugin.manifest.name || plugin.name,
    description: plugin.manifest.description ?? '',
    kind: 'plugin',
    source: {
      kind: sourceKind,
      label: plugin.isBuiltin ? 'builtin plugin' : 'plugin',
      ref: plugin.source,
      pluginId,
    },
    state: {
      installed: true,
      enabled,
      available: enabled,
      runtimeVisible: false,
      status: enabled ? 'enabled' : 'disabled',
    },
    invocation: {
      modelInvocable: false,
      userInvocable: false,
      toolInvocable: false,
    },
    relations: {
      installedRef: plugin.path,
    },
    diagnostics: enabled
      ? []
      : [
          {
            kind: 'availability',
            severity: 'info',
            code: 'plugin-disabled',
            message: `Plugin ${pluginId} is disabled.`,
          },
        ],
    metadata: {
      repository: plugin.repository,
      source: plugin.source,
      version: plugin.manifest.version,
      isBuiltin: plugin.isBuiltin === true,
      sha: plugin.sha,
      components: componentCounts,
    },
  }
}

function resolveLoadedPlugins(
  context: PluginCapabilityProviderContext,
  input: PluginCapabilityProviderInput,
): { plugins: readonly LoadedPlugin[]; errors: readonly PluginError[] } {
  return {
    plugins:
      context.capabilityEnvironment?.plugins.plugins ??
      context.loadedPlugins ??
      input.loadedPlugins ??
      [],
    errors:
      context.capabilityEnvironment?.plugins.errors ??
      context.pluginLoadErrors ??
      input.pluginLoadErrors ??
      [],
  }
}

function pluginLoadErrorsToCapabilities(
  errors: readonly PluginError[],
): ExtensionCapability[] {
  if (errors.length === 0) return []
  return [
    {
      schemaVersion: 1,
      id: 'plugin:catalog-errors',
      name: 'plugin:catalog-errors',
      displayName: 'Plugin catalog errors',
      description: 'Plugin 加载存在错误。',
      kind: 'plugin',
      source: {
        kind: 'plugin',
        label: 'plugin loader',
      },
      state: {
        installed: false,
        enabled: false,
        available: false,
        runtimeVisible: false,
        status: 'failed',
      },
      invocation: {
        modelInvocable: false,
        userInvocable: false,
        toolInvocable: false,
      },
      relations: {},
      diagnostics: errors.map(error => ({
        kind: 'plugin',
        severity: 'error',
        message: summarizePluginError(error),
      })),
    },
  ]
}

function summarizePluginError(error: PluginError): string {
  if ('error' in error && typeof error.error === 'string') {
    return error.error
  }
  if ('message' in error && typeof error.message === 'string') {
    return error.message
  }
  if ('reason' in error && typeof error.reason === 'string') {
    return error.reason
  }
  return `${error.type} from ${'source' in error ? error.source : 'plugin loader'}`
}

function getPluginComponentCounts(
  plugin: LoadedPlugin,
): Record<string, number> {
  return {
    commands: countPaths(plugin.commandsPath, plugin.commandsPaths),
    agents: countPaths(plugin.agentsPath, plugin.agentsPaths),
    skills: countPaths(plugin.skillsPath, plugin.skillsPaths),
    hooks: countObjectKeys(plugin.hooksConfig),
    mcpServers: countObjectKeys(plugin.mcpServers),
    lspServers: countObjectKeys(plugin.lspServers),
    outputStyles: countPaths(
      plugin.outputStylesPath,
      plugin.outputStylesPaths,
    ),
  }
}

function countPaths(
  primary: string | undefined,
  additional: readonly string[] | undefined,
): number {
  const paths = new Set<string>()
  if (primary) paths.add(primary)
  for (const path of additional ?? []) {
    paths.add(path)
  }
  return paths.size
}

function countObjectKeys(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 0
  }
  return Object.keys(value).length
}
