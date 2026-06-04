import assert from 'node:assert/strict'
import { rm, readFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [
  candidatesModule,
  plannerModule,
  managerModule,
  inspectorModule,
  managementModule,
] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installCandidates.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installPlanner.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installManager.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installInspector.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/managementService.js')).href),
])

const { searchSkillInstallCandidates } = candidatesModule
const { createSkillInstallPlan } = plannerModule
const { applySkillInstallPlan } = managerModule
const { inspectInstalledSkill } = inspectorModule
const { repairSkillManagementPackage } = managementModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-install-builtin-'))
const configHome = join(root, 'ccr-home')

try {
  const candidateResult = await searchSkillInstallCandidates({
    query: 'skill-package',
    configHomeDir: configHome,
  })
  assert.equal(candidateResult.errors.length, 0)
  assert.equal(candidateResult.candidates.length, 1)
  const candidate = candidateResult.candidates[0]
  assert.equal(candidate.sourceType, 'builtin-preset')
  assert.equal(candidate.state, 'available')
  assert.equal(candidate.manifestInput.source.kind, 'builtin-preset')
  assert.equal(candidate.manifestInput.source.presetId, 'skill-package-helper')
  assert.equal(candidate.trusted, true)
  assert.equal(candidate.packagePreview.origin.vendor, 'ccr')

  const plan = createSkillInstallPlan(candidate, { configHomeDir: configHome })
  assert.equal(plan.installable, true)
  assert.equal(plan.manifest.kind, 'builtin-preset')
  assert.equal(plan.securityReport.summary.highestSeverity, 'info')

  const result = await applySkillInstallPlan(plan, {
    confirmationToken: plan.confirmation.token,
    configHomeDir: configHome,
    now: new Date('2026-06-03T00:00:00.000Z'),
  })
  assert.equal(result.name, 'skill-package-helper')
  assert.equal(result.lockRecord.sourceKind, 'builtin-preset')
  assert.equal(result.lockRecord.originVendor, 'ccr')
  assert.deepEqual(result.package.resources.references, [
    'references/checklist.md',
  ])

  const ownerMarker = JSON.parse(
    await readFile(join(result.packageDir, '.ccr-skill-package.json'), 'utf8'),
  )
  assert.equal(ownerMarker.source.kind, 'builtin-preset')
  assert.equal(ownerMarker.source.presetId, 'skill-package-helper')

  const inspection = await inspectInstalledSkill('skill-package-helper', {
    configHomeDir: configHome,
  })
  assert.equal(inspection.status, 'installed')
  assert.equal(
    inspection.package.origin.importedFrom,
    'builtin-preset:skill-package-helper',
  )

  const afterInstall = await searchSkillInstallCandidates({
    query: 'skill-package',
    configHomeDir: configHome,
  })
  assert.equal(afterInstall.candidates[0].state, 'installed')

  await rm(join(result.packageDir, 'SKILL.md'), { force: true })
  const broken = await inspectInstalledSkill('skill-package-helper', {
    configHomeDir: configHome,
  })
  assert.equal(broken.status, 'missing-skill-md')

  const repair = await repairSkillManagementPackage(
    {
      skillRef: 'skill-package-helper',
      confirmed: true,
    },
    { configHomeDir: configHome },
  )
  assert.equal(repair.repaired, true)
  const repaired = await inspectInstalledSkill('skill-package-helper', {
    configHomeDir: configHome,
  })
  assert.equal(repaired.status, 'installed')
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-skill-install-builtin-preset: ok')
