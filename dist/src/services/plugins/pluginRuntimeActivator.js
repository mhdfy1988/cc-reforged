import { createHash } from 'node:crypto';
import { atomicWriteJson, readJsonOrNull, } from './pluginPersistence.js';
export class PluginRuntimeActivator {
    async activate(session, host) {
        assertRuntimeInstance(session, host.runtimeInstanceId);
        const previous = (await readJsonOrNull(session.paths.runtimeSnapshotPath)) ?? (await session.runtime.read());
        let preparation;
        try {
            preparation = await host.prepare();
        }
        catch (error) {
            return failedResult(host.runtimeInstanceId, previous, error);
        }
        let committedResults;
        try {
            committedResults = await host.commit(preparation);
        }
        catch (error) {
            return failedResult(host.runtimeInstanceId, previous, error);
        }
        const componentResults = mergeComponentResults(preparation.componentResults, committedResults);
        const activations = preparation.plugins.map(plugin => createActivation(host.runtimeInstanceId, plugin, componentResults));
        const snapshot = {
            activations,
            loadedPlugins: preparation.loadedPlugins,
        };
        await atomicWriteJson(session.paths.runtimeSnapshotPath, snapshot);
        return {
            runtimeInstanceId: host.runtimeInstanceId,
            state: summarizeActivationState(activations),
            previousSnapshotRetained: false,
            snapshot,
            diagnostics: componentResults.flatMap(result => result.diagnostic ? [result.diagnostic] : []),
        };
    }
}
function createActivation(runtimeInstanceId, plugin, allResults) {
    const components = plugin.components.map(component => {
        const result = allResults.find(item => item.pluginId === plugin.pluginId && item.component === component);
        return {
            component,
            state: result?.state ?? 'active',
            ...(result?.diagnostic
                ? { diagnostic: result.diagnostic }
                : {}),
        };
    });
    return {
        runtimeInstanceId,
        pluginId: plugin.pluginId,
        ...(plugin.version ? { activeVersion: plugin.version } : {}),
        activationRevision: createHash('sha256')
            .update(JSON.stringify({
            runtimeInstanceId,
            pluginId: plugin.pluginId,
            version: plugin.version,
            components,
        }))
            .digest('hex')
            .slice(0, 16),
        state: summarizePluginState(components),
        components,
    };
}
function summarizePluginState(components) {
    if (components.length === 0)
        return 'active';
    const failedCount = components.filter(component => component.state === 'failed').length;
    const restartCount = components.filter(component => component.state === 'restart-required').length;
    if (failedCount === components.length)
        return 'failed';
    if (failedCount > 0 || restartCount > 0)
        return 'partial';
    return 'active';
}
function summarizeActivationState(activations) {
    if (activations.length === 0)
        return 'active';
    if (activations.every(activation => activation.state === 'failed')) {
        return 'failed';
    }
    if (activations.some(activation => activation.state !== 'active')) {
        return 'partial';
    }
    return 'active';
}
function mergeComponentResults(prepared, committed) {
    const merged = new Map(prepared.map(result => [
        `${result.pluginId}::${result.component}`,
        result,
    ]));
    for (const result of committed) {
        merged.set(`${result.pluginId}::${result.component}`, result);
    }
    return [...merged.values()];
}
function failedResult(runtimeInstanceId, previous, error) {
    return {
        runtimeInstanceId,
        state: 'failed',
        previousSnapshotRetained: true,
        snapshot: previous,
        diagnostics: [error instanceof Error ? error.message : String(error)],
    };
}
function assertRuntimeInstance(session, runtimeInstanceId) {
    if (session.context.runtimeInstanceId !== runtimeInstanceId) {
        throw Object.assign(new Error('Plugin runtime adapter does not match the request runtime instance.'), { code: 'plugin-runtime-instance-mismatch' });
    }
}
//# sourceMappingURL=pluginRuntimeActivator.js.map