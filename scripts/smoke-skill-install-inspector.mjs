import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [
  candidatesModule,
  plannerModule,
  managerModule,
  inspectorModule,
] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installCandidates.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installPlanner.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installManager.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installInspector.js')).href),
])

const { searchSkillInstallCandidates } = candidatesModule
const { createSkillInstallPlan } = plannerModule
const { applySkillInstallPlan } = managerModule
const { inspectInstalledSkill, listInstalledSkills } = inspectorModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-install-inspector-'))
const configHome = join(root, 'ccr-home')

try {
  const installedNames = [
    'ok-skill',
    'disabled-skill',
    'model-off-skill',
    'drift-skill',
    'missing-skill',
    'missing-marker',
    'missing-package',
    'missing-lock',
  ]
  for (const name of installedNames) {
    await installImportedSkill(name, {
      modelInvocable: name !== 'disabled-skill',
    })
  }
  await setInstalledRecord('disabled-skill', { enabled: false })
  await setInstalledRecord('model-off-skill', {
    enabled: true,
    modelInvocable: false,
    userInvocable: true,
  })

  await writeFile(
    join(configHome, 'skills', 'packages', 'drift-skill', 'SKILL.md'),
    skillMarkdown('drift-skill', { body: 'Changed after install.' }),
    'utf8',
  )
  await rm(join(configHome, 'skills', 'packages', 'missing-skill', 'SKILL.md'), {
    force: true,
  })
  await rm(
    join(configHome, 'skills', 'packages', 'missing-marker', '.ccr-skill-package.json'),
    {
      force: true,
    },
  )
  await rm(join(configHome, 'skills', 'packages', 'missing-package'), {
    recursive: true,
    force: true,
  })

  const lockPath = join(configHome, 'skills', 'lock.json')
  const lockIndex = JSON.parse(await readFile(lockPath, 'utf8'))
  delete lockIndex.locks['user:missing-lock']
  await writeFile(lockPath, `${JSON.stringify(lockIndex, null, 2)}\n`, 'utf8')

  const listed = await listInstalledSkills({ configHomeDir: configHome })
  const statusByName = Object.fromEntries(
    listed.installed.map(inspection => [inspection.name, inspection.status]),
  )
  assert.equal(listed.summary.installed, 2)
  assert.equal(listed.summary.disabled, 1)
  assert.equal(listed.summary.drifted, 1)
  assert.equal(listed.summary['missing-skill-md'], 1)
  assert.equal(listed.summary['missing-owner-marker'], 1)
  assert.equal(listed.summary['missing-package'], 1)
  assert.equal(listed.summary['missing-lock'], 1)
  assert.equal(statusByName['ok-skill'], 'installed')
  assert.equal(statusByName['disabled-skill'], 'disabled')
  assert.equal(statusByName['model-off-skill'], 'installed')
  assert.equal(statusByName['drift-skill'], 'drifted')
  assert.equal(statusByName['missing-skill'], 'missing-skill-md')
  assert.equal(statusByName['missing-marker'], 'missing-owner-marker')
  assert.equal(statusByName['missing-package'], 'missing-package')
  assert.equal(statusByName['missing-lock'], 'missing-lock')

  const okByName = await inspectInstalledSkill('ok-skill', {
    configHomeDir: configHome,
  })
  assert.equal(okByName.status, 'installed')
  assert.equal(okByName.package.name, 'ok-skill')
  assert.equal(okByName.checksum.drifted, false)

  const okByLockKey = await inspectInstalledSkill('user:ok-skill', {
    configHomeDir: configHome,
  })
  assert.equal(okByLockKey.status, 'installed')
  assert.equal(okByLockKey.ownerMarker.owner, 'ccr-skill-installer')

  const drifted = await inspectInstalledSkill('drift-skill', {
    configHomeDir: configHome,
  })
  assert.equal(drifted.status, 'drifted')
  assert.notEqual(drifted.checksum.actualSkillMd, drifted.checksum.expectedSkillMd)

  const missing = await inspectInstalledSkill('not-installed', {
    configHomeDir: configHome,
  })
  assert.equal(missing, null)
} finally {
  await rm(root, { recursive: true, force: true })
}

async function installImportedSkill(name, options = {}) {
  const importedDir = join(configHome, 'skills', 'imported', name)
  await mkdir(importedDir, { recursive: true })
  await writeFile(
    join(importedDir, 'SKILL.md'),
    skillMarkdown(name, {
      modelInvocable: options.modelInvocable ?? true,
    }),
    'utf8',
  )
  await writeFile(
    join(importedDir, '.ccr-skill-import.json'),
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

  const candidateResult = await searchSkillInstallCandidates({
    query: name,
    configHomeDir: configHome,
  })
  const candidate = candidateResult.candidates.find(
    item => item.manifestInput.name === name,
  )
  assert.ok(candidate, `missing install candidate for ${name}`)
  assert.equal(candidate.state, 'available')

  const plan = createSkillInstallPlan(candidate, { configHomeDir: configHome })
  assert.equal(plan.installable, true)
  return applySkillInstallPlan(plan, {
    confirmationToken: plan.confirmation.token,
    configHomeDir: configHome,
    now: new Date('2026-06-02T00:00:00.000Z'),
  })
}

async function setInstalledRecord(name, patch) {
  const installedPath = join(configHome, 'skills', 'installed.json')
  const installedIndex = JSON.parse(await readFile(installedPath, 'utf8'))
  const lockKey = `user:${name}`
  const record = installedIndex.installed?.[lockKey]
  assert.ok(record, `missing installed record for ${name}`)
  installedIndex.installed[lockKey] = {
    ...record,
    ...patch,
    manifest: {
      ...record.manifest,
      defaults: {
        ...record.manifest?.defaults,
        ...(patch.modelInvocable === undefined
          ? {}
          : { modelInvocable: patch.modelInvocable }),
        ...(patch.userInvocable === undefined
          ? {}
          : { userInvocable: patch.userInvocable }),
      },
    },
  }
  await writeFile(installedPath, `${JSON.stringify(installedIndex, null, 2)}\n`, 'utf8')
}

function skillMarkdown(name, options = {}) {
  const modelInvocable = options.modelInvocable ?? true
  const body = options.body ?? `Body for ${name}.`
  return `---\nname: ${name}\ndescription: ${name} smoke skill.\ndisable-model-invocation: ${!modelInvocable}\n---\n\n${body}\n`
}

console.log('smoke-skill-install-inspector: ok')
