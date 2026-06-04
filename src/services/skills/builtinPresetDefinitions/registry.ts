import { bugDebugHelperPreset } from './bugDebugHelper.js'
import { docsUpdateHelperPreset } from './docsUpdateHelper.js'
import { mcpConfigHelperPreset } from './mcpConfigHelper.js'
import { releaseCheckHelperPreset } from './releaseCheckHelper.js'
import { skillInstallHelperPreset } from './skillInstallHelper.js'
import { skillPackageHelperPreset } from './skillPackageHelper.js'
import type { BuiltinSkillPreset } from './types.js'

const PRESETS: BuiltinSkillPreset[] = [
  skillPackageHelperPreset,
  skillInstallHelperPreset,
  mcpConfigHelperPreset,
  bugDebugHelperPreset,
  releaseCheckHelperPreset,
  docsUpdateHelperPreset,
]

validateBuiltinSkillPresets(PRESETS)

export const BUILTIN_SKILL_PRESETS: BuiltinSkillPreset[] = PRESETS

function validateBuiltinSkillPresets(presets: BuiltinSkillPreset[]): void {
  const presetIds = new Set<string>()
  const names = new Set<string>()

  for (const preset of presets) {
    if (presetIds.has(preset.presetId)) {
      throw new Error(`Duplicate builtin skill preset id: ${preset.presetId}`)
    }
    if (names.has(preset.name)) {
      throw new Error(`Duplicate builtin skill preset name: ${preset.name}`)
    }
    presetIds.add(preset.presetId)
    names.add(preset.name)
  }
}
