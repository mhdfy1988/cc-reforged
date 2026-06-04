import assert from 'node:assert/strict'
import { rm, readFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [
  presetsModule,
  candidatesModule,
  plannerModule,
  managerModule,
  inspectorModule,
  managementModule,
] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/builtinPresets.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installCandidates.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installPlanner.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installManager.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installInspector.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/managementService.js')).href),
])

const { listBuiltinSkillPresets } = presetsModule
const { searchSkillInstallCandidates } = candidatesModule
const { createSkillInstallPlan } = plannerModule
const { applySkillInstallPlan } = managerModule
const { inspectInstalledSkill } = inspectorModule
const { repairSkillManagementPackage } = managementModule

const presets = listBuiltinSkillPresets()
assert.ok(presets.length >= 2, 'expected at least two builtin skill presets')
assert.equal(new Set(presets.map(preset => preset.presetId)).size, presets.length)
assert.equal(new Set(presets.map(preset => preset.name)).size, presets.length)

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-install-builtins-'))
const configHome = join(root, 'ccr-home')

try {
  for (const preset of presets) {
    const candidateResult = await searchSkillInstallCandidates({
      query: preset.name,
      configHomeDir: configHome,
    })
    assert.equal(candidateResult.errors.length, 0)
    const candidate = candidateResult.candidates.find(
      item => item.manifestInput.source.kind === 'builtin-preset' &&
        item.manifestInput.source.presetId === preset.presetId,
    )
    assert.ok(candidate, `missing builtin candidate: ${preset.presetId}`)
    assert.equal(candidate.sourceType, 'builtin-preset')
    assert.equal(candidate.state, 'available')
    assert.equal(candidate.trusted, true)
    assert.equal(candidate.packagePreview.origin.vendor, 'ccr')
    assert.equal(candidate.securityReport.summary.highestSeverity, 'info')

    const expectedReferences = Object.keys(preset.files)
      .filter(file => file.startsWith('references/'))
      .sort()
    assert.deepEqual(candidate.packagePreview.resources.references.sort(), expectedReferences)

    const plan = createSkillInstallPlan(candidate, { configHomeDir: configHome })
    assert.equal(plan.installable, true)
    assert.equal(plan.manifest.kind, 'builtin-preset')
    assert.equal(plan.securityReport.summary.highestSeverity, 'info')

    const result = await applySkillInstallPlan(plan, {
      confirmationToken: plan.confirmation.token,
      configHomeDir: configHome,
      now: new Date('2026-06-03T00:00:00.000Z'),
    })
    assert.equal(result.name, preset.name)
    assert.equal(result.lockRecord.sourceKind, 'builtin-preset')
    assert.equal(result.lockRecord.originVendor, 'ccr')
    assert.deepEqual(result.package.resources.references.sort(), expectedReferences)

    const ownerMarker = JSON.parse(
      await readFile(join(result.packageDir, '.ccr-skill-package.json'), 'utf8'),
    )
    assert.equal(ownerMarker.source.kind, 'builtin-preset')
    assert.equal(ownerMarker.source.presetId, preset.presetId)

    const inspection = await inspectInstalledSkill(preset.name, {
      configHomeDir: configHome,
    })
    assert.equal(inspection.status, 'installed')
    assert.equal(inspection.package.origin.importedFrom, `builtin-preset:${preset.presetId}`)

    const afterInstall = await searchSkillInstallCandidates({
      query: preset.name,
      configHomeDir: configHome,
    })
    const installedCandidate = afterInstall.candidates.find(
      item => item.manifestInput.source.kind === 'builtin-preset' &&
        item.manifestInput.source.presetId === preset.presetId,
    )
    assert.equal(installedCandidate?.state, 'installed')

    await rm(join(result.packageDir, 'SKILL.md'), { force: true })
    const broken = await inspectInstalledSkill(preset.name, {
      configHomeDir: configHome,
    })
    assert.equal(broken.status, 'missing-skill-md')

    const repair = await repairSkillManagementPackage(
      {
        skillRef: preset.name,
        confirmed: true,
      },
      { configHomeDir: configHome },
    )
    assert.equal(repair.repaired, true)
    const repaired = await inspectInstalledSkill(preset.name, {
      configHomeDir: configHome,
    })
    assert.equal(repaired.status, 'installed')
  }
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-skill-install-builtin-presets: ok')
