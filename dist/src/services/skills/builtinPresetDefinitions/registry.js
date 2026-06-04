import { bugDebugHelperPreset } from './bugDebugHelper.js';
import { docsUpdateHelperPreset } from './docsUpdateHelper.js';
import { mcpConfigHelperPreset } from './mcpConfigHelper.js';
import { releaseCheckHelperPreset } from './releaseCheckHelper.js';
import { skillInstallHelperPreset } from './skillInstallHelper.js';
import { skillPackageHelperPreset } from './skillPackageHelper.js';
const PRESETS = [
    skillPackageHelperPreset,
    skillInstallHelperPreset,
    mcpConfigHelperPreset,
    bugDebugHelperPreset,
    releaseCheckHelperPreset,
    docsUpdateHelperPreset,
];
validateBuiltinSkillPresets(PRESETS);
export const BUILTIN_SKILL_PRESETS = PRESETS;
function validateBuiltinSkillPresets(presets) {
    const presetIds = new Set();
    const names = new Set();
    for (const preset of presets) {
        if (presetIds.has(preset.presetId)) {
            throw new Error(`Duplicate builtin skill preset id: ${preset.presetId}`);
        }
        if (names.has(preset.name)) {
            throw new Error(`Duplicate builtin skill preset name: ${preset.name}`);
        }
        presetIds.add(preset.presetId);
        names.add(preset.name);
    }
}
//# sourceMappingURL=registry.js.map