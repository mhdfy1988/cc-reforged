import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [candidatesModule, plannerModule] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installCandidates.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installPlanner.js')).href),
])

const { searchSkillInstallCandidates } = candidatesModule
const { createSkillInstallPlan } = plannerModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-install-plan-'))
const configHome = join(root, 'ccr-home')

try {
  const importedRoot = join(configHome, 'skills', 'imported')
  const manifestsDir = join(configHome, 'skills', 'manifests')
  await mkdir(importedRoot, { recursive: true })
  await mkdir(manifestsDir, { recursive: true })

  const alphaDir = await createImportedSkill(importedRoot, 'alpha')
  const betaDir = await createImportedSkill(importedRoot, 'beta')
  await writeFile(
    join(manifestsDir, 'beta-duplicate.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        name: 'beta',
        description: 'Duplicate beta manifest.',
        source: {
          kind: 'imported-skill',
          path: betaDir,
          importMarkerPath: join(betaDir, '.ccr-skill-import.json'),
        },
        targetScope: 'user',
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  const result = await searchSkillInstallCandidates({ configHomeDir: configHome })
  const alphaCandidate = result.candidates.find(
    candidate => candidate.manifestInput.name === 'alpha',
  )
  assert.equal(alphaCandidate.state, 'available')

  const alphaPlan = createSkillInstallPlan(alphaCandidate, { configHomeDir: configHome })
  assert.equal(alphaPlan.installable, true)
  assert.equal(alphaPlan.requiresConfirmation, true)
  assert.equal(alphaPlan.writes.length, 4)
  assert.equal(alphaPlan.writes.some(write => write.kind === 'package'), true)
  assert.equal(alphaPlan.writes.some(write => write.kind === 'lockfile'), true)
  assert.equal(alphaPlan.confirmation.token.length > 0, true)

  await mkdir(join(configHome, 'skills', 'packages', 'alpha'), { recursive: true })
  const nonOwnerPlan = createSkillInstallPlan(alphaCandidate, {
    configHomeDir: configHome,
  })
  assert.equal(nonOwnerPlan.installable, false)
  assert.equal(nonOwnerPlan.conflicts[0].kind, 'package-exists')

  const betaCandidates = result.candidates.filter(
    candidate => candidate.manifestInput.name === 'beta',
  )
  assert.equal(betaCandidates.length, 2)
  for (const candidate of betaCandidates) {
    assert.equal(candidate.state, 'duplicate-name')
    const plan = createSkillInstallPlan(candidate, { configHomeDir: configHome })
    assert.equal(plan.installable, false)
    assert.equal(plan.conflicts.some(conflict => conflict.kind === 'name-conflict'), true)
  }

  await writeFile(
    join(configHome, 'skills', 'installed.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        installed: {
          'user:alpha': {
            schemaVersion: 1,
            name: 'alpha',
            scope: 'user',
            installedAt: '2026-06-02T00:00:00.000Z',
            updatedAt: '2026-06-02T00:00:00.000Z',
            manifest: alphaCandidate.manifestInput,
            packageDir: join(configHome, 'skills', 'packages', 'alpha'),
            skillFilePath: join(configHome, 'skills', 'packages', 'alpha', 'SKILL.md'),
            packageOwnerMarkerPath: join(
              configHome,
              'skills',
              'packages',
              'alpha',
              '.ccr-skill-package.json',
            ),
            enabled: true,
            modelInvocable: true,
            userInvocable: true,
            lockKey: 'user:alpha',
          },
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  const installedResult = await searchSkillInstallCandidates({ configHomeDir: configHome })
  const installedAlpha = installedResult.candidates.find(
    candidate => candidate.manifestInput.name === 'alpha',
  )
  assert.equal(installedAlpha.state, 'installed')
  const installedPlan = createSkillInstallPlan(installedAlpha, {
    configHomeDir: configHome,
  })
  assert.equal(installedPlan.installable, false)
  assert.equal(
    installedPlan.conflicts.some(conflict => conflict.kind === 'already-installed'),
    true,
  )
} finally {
  await rm(root, { recursive: true, force: true })
}

async function createImportedSkill(importedRoot, name) {
  const dir = join(importedRoot, name)
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} install plan candidate.\n---\n\n${name} body.\n`,
    'utf8',
  )
  await writeFile(
    join(dir, '.ccr-skill-import.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        name,
        importedAt: '2026-06-02T00:00:00.000Z',
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
  return dir
}

console.log('smoke-skill-install-plan: ok')
