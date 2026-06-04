import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const managementModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/skills/managementService.js')).href
)

const {
  applySkillManagementImportPlan,
  applySkillManagementInstallPlan,
  createSkillManagementImportPlan,
  createSkillManagementInstallPlan,
  listSkillManagementState,
  repairSkillManagementPackage,
  saveSkillManagementInstallManifest,
  searchSkillManagementInstallCandidates,
  setSkillManagementEnabled,
  setSkillManagementInvocation,
  uninstallSkillManagementPackage,
} = managementModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-management-service-'))
const configHome = join(root, 'ccr-home')
const sourceSkill = join(root, 'source-skill')

try {
  await mkdir(join(sourceSkill, 'references'), { recursive: true })
  await writeFile(
    join(sourceSkill, 'SKILL.md'),
    `---\nname: service-demo\ndescription: Service management demo.\nuser-invocable: true\n---\n\nUse this skill for service smoke.\n`,
    'utf8',
  )
  await writeFile(join(sourceSkill, 'references', 'note.md'), 'reference\n', 'utf8')

  const importPlan = await createSkillManagementImportPlan(
    {
      source: {
        kind: 'local-skill-dir',
        path: sourceSkill,
      },
    },
    { configHomeDir: configHome },
  )
  assert.equal(importPlan.importable, true)
  const importResult = await applySkillManagementImportPlan(
    {
      source: importPlan.source,
      confirmed: true,
      confirmationToken: importPlan.confirmation.token,
    },
    { configHomeDir: configHome },
  )
  assert.equal(importResult.result.name, 'service-demo')

  const search = await searchSkillManagementInstallCandidates(
    { query: 'service-demo' },
    { configHomeDir: configHome },
  )
  const candidate = search.candidates.find(
    item => item.manifestInput?.name === 'service-demo',
  )
  assert.ok(candidate)
  assert.equal(candidate.securityDigest.highestSeverity, 'info')

  const installPlan = await createSkillManagementInstallPlan(
    {
      manifest: candidate.manifestInput,
    },
    { configHomeDir: configHome },
  )
  assert.equal(installPlan.installable, true)
  const installResult = await applySkillManagementInstallPlan(
    {
      manifest: candidate.manifestInput,
      confirmed: true,
      confirmationToken: installPlan.confirmation.token,
    },
    { configHomeDir: configHome },
  )
  assert.equal(installResult.result.name, 'service-demo')

  await setSkillManagementEnabled(
    { skillRef: 'service-demo', enabled: false },
    { configHomeDir: configHome },
  )
  await setSkillManagementInvocation(
    { skillRef: 'service-demo', modelInvocable: false, userInvocable: false },
    { configHomeDir: configHome },
  )
  const disabledList = await listSkillManagementState({ configHomeDir: configHome })
  const disabled = disabledList.installed.find(item => item.name === 'service-demo')
  assert.equal(disabled.installedRecord.enabled, false)
  assert.equal(disabled.installedRecord.modelInvocable, false)
  assert.equal(disabled.installedRecord.userInvocable, false)

  const saved = await saveSkillManagementInstallManifest(
    {
      manifest: candidate.manifestInput,
      overwrite: true,
    },
    { configHomeDir: configHome },
  )
  assert.equal(saved.saved, true)
  assert.equal(saved.name, 'service-demo')

  await rm(join(configHome, 'skills', 'packages', 'service-demo'), {
    recursive: true,
    force: true,
  })
  const repaired = await repairSkillManagementPackage(
    { skillRef: 'service-demo', confirmed: true },
    { configHomeDir: configHome },
  )
  assert.equal(repaired.repaired, true)

  const uninstalled = await uninstallSkillManagementPackage(
    { skillRef: 'service-demo', confirmed: true },
    { configHomeDir: configHome },
  )
  assert.equal(uninstalled.uninstalled, true)
  await assert.rejects(() =>
    readFile(join(configHome, 'skills', 'packages', 'service-demo', 'SKILL.md'), 'utf8'),
  )
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-skill-management-service: ok')
