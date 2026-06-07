import { createSkillRuntimeCapabilityCatalog } from '../../skills/skillRuntimeCatalog.js';
export async function createSkillManagementCapabilityCatalog(input) {
    const { getSkillRuntimeCatalogForCwd } = await import('../../commands.js');
    const runtime = await getSkillRuntimeCatalogForCwd(input.cwd, {
        configHomeDir: input.configHomeDir,
    });
    return createSkillRuntimeCapabilityCatalog({
        commands: runtime.sourceCommands,
        installed: input.installed,
    });
}
//# sourceMappingURL=capabilityProvider.js.map