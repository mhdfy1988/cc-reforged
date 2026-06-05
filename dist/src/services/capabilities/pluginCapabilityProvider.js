export function createPluginCapabilityProvider(input = {}) {
    return {
        id: 'plugins',
        listCapabilities(context) {
            const runtimePlugins = context.plugins;
            return [...(runtimePlugins ?? input.plugins ?? [])];
        },
    };
}
//# sourceMappingURL=pluginCapabilityProvider.js.map