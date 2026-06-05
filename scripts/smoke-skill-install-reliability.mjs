import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [candidatesModule, plannerModule, managerModule, managementModule] =
  await Promise.all([
    import(
      pathToFileURL(
        join(repoRoot, 'dist/src/services/skills/installCandidates.js'),
      ).href
    ),
    import(
      pathToFileURL(join(repoRoot, 'dist/src/services/skills/installPlanner.js')).href
    ),
    import(
      pathToFileURL(join(repoRoot, 'dist/src/services/skills/installManager.js')).href
    ),
    import(
      pathToFileURL(
        join(repoRoot, 'dist/src/services/skills/managementService.js'),
      ).href
    ),
  ])

const { searchSkillInstallCandidates } = candidatesModule
const { createSkillInstallPlan } = plannerModule
const { applySkillInstallPlan } = managerModule
const { repairSkillManagementPackage } = managementModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-install-reliability-'))
const configHome = join(root, 'ccr-home')
const importedDir = join(configHome, 'skills', 'imported', 'reliable-demo')
const packageDir = join(configHome, 'skills', 'packages', 'reliable-demo')

try {
  await createImportedSkill(importedDir, 'v1')
  const firstCandidate = await findCandidate('reliable-demo')
  const firstPlan = createSkillInstallPlan(firstCandidate, {
    configHomeDir: configHome,
  })
  assert.equal(firstPlan.installable, true)
  const firstResult = await applySkillInstallPlan(firstPlan, {
    confirmationToken: firstPlan.confirmation.token,
    configHomeDir: configHome,
    now: new Date('2026-06-05T00:00:00.000Z'),
  })
  assert.equal(firstResult.lockRecord.checksum.skillMd, sha256(skillMd('v1')))

  await createImportedSkill(importedDir, 'v2')
  const installedCandidate = await findCandidate('reliable-demo')
  assert.equal(installedCandidate.state, 'installed')
  const blockedPlan = createSkillInstallPlan(installedCandidate, {
    configHomeDir: configHome,
  })
  assert.equal(blockedPlan.installable, false)
  assert.equal(
    blockedPlan.conflicts.some(conflict => conflict.kind === 'already-installed'),
    true,
  )

  const forcePlan = createSkillInstallPlan(installedCandidate, {
    configHomeDir: configHome,
    force: true,
  })
  assert.equal(forcePlan.installable, true)
  const forceResult = await applySkillInstallPlan(forcePlan, {
    confirmationToken: forcePlan.confirmation.token,
    configHomeDir: configHome,
    now: new Date('2026-06-05T00:01:00.000Z'),
  })
  assert.equal(forceResult.lockRecord.checksum.skillMd, sha256(skillMd('v2')))
  assert.equal(await readFile(join(packageDir, 'SKILL.md'), 'utf8'), skillMd('v2'))

  await rm(importedDir, { recursive: true, force: true })
  await assert.rejects(
    () =>
      repairSkillManagementPackage(
        { skillRef: 'reliable-demo', confirmed: true },
        { configHomeDir: configHome },
      ),
    /ENOENT|no such file|cannot find/i,
  )
  assert.equal(await readFile(join(packageDir, 'SKILL.md'), 'utf8'), skillMd('v2'))
  const installedAfterFailedRepair = JSON.parse(
    await readFile(join(configHome, 'skills', 'installed.json'), 'utf8'),
  )
  assert.equal(
    installedAfterFailedRepair.installed['user:reliable-demo'].updatedAt,
    '2026-06-05T00:01:00.000Z',
  )

  await createImportedSkill(importedDir, 'v3')
  const repaired = await repairSkillManagementPackage(
    { skillRef: 'reliable-demo', confirmed: true },
    { configHomeDir: configHome },
  )
  assert.equal(repaired.repaired, true)
  assert.equal(await readFile(join(packageDir, 'SKILL.md'), 'utf8'), skillMd('v3'))

  const nonOwnerDir = join(configHome, 'skills', 'packages', 'non-owner-demo')
  const nonOwnerImportedDir = join(
    configHome,
    'skills',
    'imported',
    'non-owner-demo',
  )
  await createImportedSkill(nonOwnerImportedDir, 'v1', 'non-owner-demo')
  await mkdir(nonOwnerDir, { recursive: true })
  await writeFile(join(nonOwnerDir, 'sentinel.txt'), 'keep\n', 'utf8')
  const nonOwnerCandidate = await findCandidate('non-owner-demo')
  const nonOwnerPlan = createSkillInstallPlan(nonOwnerCandidate, {
    configHomeDir: configHome,
    force: true,
  })
  assert.equal(nonOwnerPlan.installable, false)
  assert.equal(nonOwnerPlan.conflicts[0].kind, 'package-exists')
  await assert.rejects(() =>
    applySkillInstallPlan(nonOwnerPlan, {
      confirmationToken: nonOwnerPlan.confirmation.token,
      configHomeDir: configHome,
    }),
  )
  assert.equal(await readFile(join(nonOwnerDir, 'sentinel.txt'), 'utf8'), 'keep\n')

  await stat(join(packageDir, '.ccr-skill-package.json'))
} finally {
  await rm(root, { recursive: true, force: true })
}

async function findCandidate(name) {
  const result = await searchSkillInstallCandidates({ configHomeDir: configHome })
  const candidate = result.candidates.find(
    item => item.manifestInput?.name === name,
  )
  assert.ok(candidate, `candidate not found: ${name}`)
  return candidate
}

async function createImportedSkill(dir, version, name = 'reliable-demo') {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'SKILL.md'), skillMd(version, name), 'utf8')
  await writeFile(
    join(dir, '.ccr-skill-import.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        name,
        importedAt: '2026-06-05T00:00:00.000Z',
        source: {
          kind: 'local-skill-dir',
          path: `D:/source/${name}`,
        },
        sourcePath: `D:/source/${name}`,
        originVendor: 'agent-skills',
        converted: false,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

function skillMd(version, name = 'reliable-demo') {
  return `---\nname: ${name}\ndescription: ${name} ${version}.\n---\n\n${version} body.\n`
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

console.log('smoke-skill-install-reliability: ok')
