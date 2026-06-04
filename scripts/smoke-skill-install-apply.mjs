import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [candidatesModule, plannerModule, managerModule] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installCandidates.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installPlanner.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installManager.js')).href),
])

const { searchSkillInstallCandidates } = candidatesModule
const { createSkillInstallPlan } = plannerModule
const { applySkillInstallPlan } = managerModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-install-apply-'))
const configHome = join(root, 'ccr-home')

try {
  const importedDir = join(configHome, 'skills', 'imported', 'apply-demo')
  await mkdir(join(importedDir, 'scripts'), { recursive: true })
  const skillMd = `---\nname: apply-demo\ndescription: Apply install demo.\nuser-invocable: false\n---\n\nApply body.\n`
  await writeFile(join(importedDir, 'SKILL.md'), skillMd, 'utf8')
  await writeFile(join(importedDir, 'scripts', 'run.js'), 'console.log("ok")\n', 'utf8')
  await writeFile(
    join(importedDir, '.ccr-skill-import.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        name: 'apply-demo',
        importedAt: '2026-06-02T00:00:00.000Z',
        source: {
          kind: 'local-skill-dir',
          path: 'D:/source/apply-demo',
        },
        sourcePath: 'D:/source/apply-demo',
        originVendor: 'agent-skills',
        converted: false,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  const candidateResult = await searchSkillInstallCandidates({ configHomeDir: configHome })
  const candidate = candidateResult.candidates[0]
  assert.equal(candidate.state, 'available')
  const plan = createSkillInstallPlan(candidate, { configHomeDir: configHome })
  assert.equal(plan.installable, true)

  await assert.rejects(() =>
    applySkillInstallPlan(plan, {
      confirmationToken: 'wrong-token',
      configHomeDir: configHome,
    }),
  )

  const result = await applySkillInstallPlan(plan, {
    confirmationToken: plan.confirmation.token,
    configHomeDir: configHome,
    now: new Date('2026-06-02T00:00:00.000Z'),
  })

  assert.equal(result.name, 'apply-demo')
  assert.equal(result.scope, 'user')
  assert.equal(result.package.name, 'apply-demo')
  assert.equal(result.package.invocation.userInvocable, false)
  assert.deepEqual(result.package.resources.scripts, ['scripts/run.js'])
  assert.equal(result.installedRecord.lockKey, 'user:apply-demo')
  assert.equal(result.lockRecord.checksum.skillMd, sha256(skillMd))
  assert.equal(plan.securityReport.summary.highestSeverity, 'medium')
  assert.equal(
    result.warnings.some(value => value.includes('medium')),
    true,
  )

  const ownerMarker = JSON.parse(
    await readFile(join(result.packageDir, '.ccr-skill-package.json'), 'utf8'),
  )
  assert.equal(ownerMarker.owner, 'ccr-skill-installer')
  assert.equal(ownerMarker.packageId, 'user:apply-demo')

  const installed = JSON.parse(
    await readFile(join(configHome, 'skills', 'installed.json'), 'utf8'),
  )
  assert.equal(installed.installed['user:apply-demo'].name, 'apply-demo')
  assert.equal(installed.installed['user:apply-demo'].userInvocable, false)

  const lock = JSON.parse(await readFile(join(configHome, 'skills', 'lock.json'), 'utf8'))
  assert.equal(lock.locks['user:apply-demo'].checksum.skillMd, sha256(skillMd))

  const afterInstall = await searchSkillInstallCandidates({ configHomeDir: configHome })
  const installedCandidate = afterInstall.candidates.find(
    item => item.manifestInput.name === 'apply-demo',
  )
  assert.equal(installedCandidate.state, 'installed')
} finally {
  await rm(root, { recursive: true, force: true })
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

console.log('smoke-skill-install-apply: ok')
