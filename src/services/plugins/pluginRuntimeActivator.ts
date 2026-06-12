import { createHash } from 'node:crypto'
import type { LoadedPlugin } from '../../types/plugin.js'
import type {
  PluginComponentActivation,
  PluginRuntimeActivation,
  PluginRuntimeSnapshot,
} from './pluginDomainTypes.js'
import type { PluginDomainSession } from './pluginDomainSession.js'
import {
  atomicWriteJson,
  readJsonOrNull,
} from './pluginPersistence.js'

export type PluginRuntimeComponentKind =
  | 'command'
  | 'agent'
  | 'skill'
  | 'hook'
  | 'mcp'
  | 'lsp'
  | 'channel'
  | 'output-style'

export type PluginRuntimeComponentResult = {
  pluginId: string
  component: PluginRuntimeComponentKind
  state: PluginComponentActivation['state']
  diagnostic?: string
}

export type PluginRuntimePreparedPlugin = {
  pluginId: string
  version?: string
  components: PluginRuntimeComponentKind[]
}

export type PluginRuntimePreparation<TPayload = unknown> = {
  plugins: PluginRuntimePreparedPlugin[]
  loadedPlugins: LoadedPlugin[]
  componentResults: PluginRuntimeComponentResult[]
  payload: TPayload
}

export type PluginRuntimeHostAdapter<TPayload = unknown> = {
  runtimeInstanceId: string
  prepare(): Promise<PluginRuntimePreparation<TPayload>>
  commit(
    preparation: PluginRuntimePreparation<TPayload>,
  ): Promise<PluginRuntimeComponentResult[]>
}

export type PluginRuntimeActivationResult = {
  runtimeInstanceId: string
  state: 'active' | 'partial' | 'failed'
  previousSnapshotRetained: boolean
  snapshot: PluginRuntimeSnapshot
  diagnostics: string[]
}

export class PluginRuntimeActivator {
  async activate<TPayload>(
    session: PluginDomainSession,
    host: PluginRuntimeHostAdapter<TPayload>,
  ): Promise<PluginRuntimeActivationResult> {
    assertRuntimeInstance(session, host.runtimeInstanceId)
    const previous =
      (await readJsonOrNull<PluginRuntimeSnapshot>(
        session.paths.runtimeSnapshotPath,
      )) ?? (await session.runtime.read())
    let preparation: PluginRuntimePreparation<TPayload>
    try {
      preparation = await host.prepare()
    } catch (error) {
      return failedResult(host.runtimeInstanceId, previous, error)
    }

    let committedResults: PluginRuntimeComponentResult[]
    try {
      committedResults = await host.commit(preparation)
    } catch (error) {
      return failedResult(host.runtimeInstanceId, previous, error)
    }

    const componentResults = mergeComponentResults(
      preparation.componentResults,
      committedResults,
    )
    const activations = preparation.plugins.map(plugin =>
      createActivation(host.runtimeInstanceId, plugin, componentResults),
    )
    const snapshot: PluginRuntimeSnapshot = {
      activations,
      loadedPlugins: preparation.loadedPlugins,
    }
    await atomicWriteJson(session.paths.runtimeSnapshotPath, snapshot)
    return {
      runtimeInstanceId: host.runtimeInstanceId,
      state: summarizeActivationState(activations),
      previousSnapshotRetained: false,
      snapshot,
      diagnostics: componentResults.flatMap(result =>
        result.diagnostic ? [result.diagnostic] : [],
      ),
    }
  }
}

function createActivation(
  runtimeInstanceId: string,
  plugin: PluginRuntimePreparedPlugin,
  allResults: readonly PluginRuntimeComponentResult[],
): PluginRuntimeActivation {
  const components = plugin.components.map(component => {
    const result = allResults.find(
      item => item.pluginId === plugin.pluginId && item.component === component,
    )
    return {
      component,
      state: result?.state ?? 'active',
      ...(result?.diagnostic
        ? { diagnostic: result.diagnostic }
        : {}),
    }
  })
  return {
    runtimeInstanceId,
    pluginId: plugin.pluginId,
    ...(plugin.version ? { activeVersion: plugin.version } : {}),
    activationRevision: createHash('sha256')
      .update(
        JSON.stringify({
          runtimeInstanceId,
          pluginId: plugin.pluginId,
          version: plugin.version,
          components,
        }),
      )
      .digest('hex')
      .slice(0, 16),
    state: summarizePluginState(components),
    components,
  }
}

function summarizePluginState(
  components: readonly PluginComponentActivation[],
): PluginRuntimeActivation['state'] {
  if (components.length === 0) return 'active'
  const failedCount = components.filter(
    component => component.state === 'failed',
  ).length
  const restartCount = components.filter(
    component => component.state === 'restart-required',
  ).length
  if (failedCount === components.length) return 'failed'
  if (failedCount > 0 || restartCount > 0) return 'partial'
  return 'active'
}

function summarizeActivationState(
  activations: readonly PluginRuntimeActivation[],
): PluginRuntimeActivationResult['state'] {
  if (activations.length === 0) return 'active'
  if (activations.every(activation => activation.state === 'failed')) {
    return 'failed'
  }
  if (activations.some(activation => activation.state !== 'active')) {
    return 'partial'
  }
  return 'active'
}

function mergeComponentResults(
  prepared: readonly PluginRuntimeComponentResult[],
  committed: readonly PluginRuntimeComponentResult[],
): PluginRuntimeComponentResult[] {
  const merged = new Map(
    prepared.map(result => [
      `${result.pluginId}::${result.component}`,
      result,
    ]),
  )
  for (const result of committed) {
    merged.set(`${result.pluginId}::${result.component}`, result)
  }
  return [...merged.values()]
}

function failedResult(
  runtimeInstanceId: string,
  previous: PluginRuntimeSnapshot,
  error: unknown,
): PluginRuntimeActivationResult {
  return {
    runtimeInstanceId,
    state: 'failed',
    previousSnapshotRetained: true,
    snapshot: previous,
    diagnostics: [error instanceof Error ? error.message : String(error)],
  }
}

function assertRuntimeInstance(
  session: PluginDomainSession,
  runtimeInstanceId: string,
): void {
  if (session.context.runtimeInstanceId !== runtimeInstanceId) {
    throw Object.assign(
      new Error(
        'Plugin runtime adapter does not match the request runtime instance.',
      ),
      { code: 'plugin-runtime-instance-mismatch' },
    )
  }
}
