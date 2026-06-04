import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [presetsModule, candidatesModule] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/builtinPresets.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installCandidates.js')).href),
])

const { listBuiltinSkillPresets } = presetsModule
const { searchSkillInstallCandidates } = candidatesModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-install-candidates-'))
const configHome = join(root, 'ccr-home')
const importedRoot = join(configHome, 'skills', 'imported')
const manifestsDir = join(configHome, 'skills', 'manifests')

try {
  await mkdir(importedRoot, { recursive: true })
  await mkdir(manifestsDir, { recursive: true })

  const localDir = await createImportedSkill({
    name: 'local-demo',
    description: 'Local imported install candidate.',
    vendor: 'agent-skills',
    script: true,
  })
  const codexDir = await createImportedSkill({
    name: 'codex-demo',
    description: 'Codex imported install candidate.',
    vendor: 'codex',
    openaiYaml: true,
  })

  const manifest = {
    schemaVersion: 1,
    name: 'manifest-demo',
    description: 'Local manifest install candidate.',
    source: {
      kind: 'imported-skill',
      path: codexDir,
      importMarkerPath: join(codexDir, '.ccr-skill-import.json'),
    },
    targetScope: 'user',
    defaults: {
      enabled: true,
      modelInvocable: true,
      userInvocable: true,
    },
    trust: {
      thirdParty: true,
      executableContent: false,
      networkDeclared: false,
      secretsDeclared: [],
    },
    compatibility: {
      vendor: 'codex',
      convertedFromCommand: false,
    },
  }
  await writeFile(
    join(manifestsDir, 'manifest-demo.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
  await writeFile(join(manifestsDir, 'invalid.json'), '{"schemaVersion":1}', 'utf8')

  await writeFile(
    join(configHome, 'skills', 'installed.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        installed: {
          'user:local-demo': {
            schemaVersion: 1,
            name: 'local-demo',
            scope: 'user',
            installedAt: '2026-06-02T00:00:00.000Z',
            updatedAt: '2026-06-02T00:00:00.000Z',
            manifest: {
              ...manifest,
              name: 'local-demo',
              description: 'Local imported install candidate.',
              source: {
                kind: 'imported-skill',
                path: localDir,
                importMarkerPath: join(localDir, '.ccr-skill-import.json'),
              },
              compatibility: {
                vendor: 'agent-skills',
                convertedFromCommand: false,
              },
            },
            packageDir: join(configHome, 'skills', 'packages', 'local-demo'),
            skillFilePath: join(
              configHome,
              'skills',
              'packages',
              'local-demo',
              'SKILL.md',
            ),
            packageOwnerMarkerPath: join(
              configHome,
              'skills',
              'packages',
              'local-demo',
              '.ccr-skill-package.json',
            ),
            enabled: true,
            modelInvocable: true,
            userInvocable: true,
            lockKey: 'user:local-demo',
          },
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  const result = await searchSkillInstallCandidates({ configHomeDir: configHome })
  const builtinPresets = listBuiltinSkillPresets()
  assert.equal(result.errors.length, 1)
  assert.equal(result.errors[0].sourceType, 'local-manifest')
  assert.equal(result.candidates.length, 3 + builtinPresets.length)
  assert.equal(
    result.sources.some(source => source.sourceType === 'builtin-preset'),
    true,
  )

  const localCandidate = result.candidates.find(
    candidate => candidate.manifestInput.name === 'local-demo',
  )
  assert.equal(localCandidate.state, 'installed')
  assert.equal(localCandidate.packagePreview.name, 'local-demo')
  assert.deepEqual(localCandidate.packagePreview.resources.scripts, [
    'scripts/run.js',
  ])

  const codexCandidate = result.candidates.find(
    candidate =>
      candidate.sourceType === 'imported-skill' &&
      candidate.manifestInput.name === 'codex-demo',
  )
  assert.equal(codexCandidate.state, 'available')
  assert.equal(codexCandidate.packagePreview.origin.vendor, 'codex')
  assert.equal(codexCandidate.packagePreview.interface.shortDescription, 'Codex UI')

  const manifestCandidate = result.candidates.find(
    candidate => candidate.sourceType === 'local-manifest',
  )
  assert.equal(manifestCandidate.state, 'available')
  assert.equal(manifestCandidate.manifestInput.name, 'manifest-demo')
  assert.equal(manifestCandidate.packagePreview.name, 'codex-demo')

  const builtinCandidate = result.candidates.find(
    candidate =>
      candidate.sourceType === 'builtin-preset' &&
      candidate.manifestInput.name === 'skill-package-helper',
  )
  assert.equal(builtinCandidate.state, 'available')
  assert.equal(builtinCandidate.manifestInput.name, 'skill-package-helper')
  assert.equal(builtinCandidate.manifestInput.trust.thirdParty, false)
  assert.equal(builtinCandidate.packagePreview.origin.vendor, 'ccr')
  assert.deepEqual(builtinCandidate.packagePreview.resources.references, [
    'references/checklist.md',
  ])

  const skillInstallCandidate = result.candidates.find(
    candidate =>
      candidate.sourceType === 'builtin-preset' &&
      candidate.manifestInput.name === 'skill-install-helper',
  )
  assert.equal(skillInstallCandidate.state, 'available')
  assert.equal(skillInstallCandidate.manifestInput.displayName, 'Skill 安装助手')

  const filtered = await searchSkillInstallCandidates({
    configHomeDir: configHome,
    query: 'manifest-demo',
  })
  assert.equal(filtered.candidates.length, 1)
  assert.equal(filtered.candidates[0].manifestInput.name, 'manifest-demo')
} finally {
  await rm(root, { recursive: true, force: true })
}

async function createImportedSkill(input) {
  const dir = join(importedRoot, input.name)
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'SKILL.md'),
    `---\nname: ${input.name}\ndescription: ${input.description}\n---\n\n${input.name} body.\n`,
    'utf8',
  )
  if (input.script) {
    await mkdir(join(dir, 'scripts'), { recursive: true })
    await writeFile(join(dir, 'scripts', 'run.js'), 'console.log("ok")\n', 'utf8')
  }
  if (input.openaiYaml) {
    await mkdir(join(dir, 'agents'), { recursive: true })
    await writeFile(
      join(dir, 'agents', 'openai.yaml'),
      'interface:\n  short_description: Codex UI\n',
      'utf8',
    )
  }
  await writeFile(
    join(dir, '.ccr-skill-import.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        name: input.name,
        importedAt: '2026-06-02T00:00:00.000Z',
        source: {
          kind: input.vendor === 'codex' ? 'codex-skill-dir' : 'local-skill-dir',
          path: `D:/source/${input.name}`,
        },
        sourcePath: `D:/source/${input.name}`,
        originVendor: input.vendor,
        converted: false,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  return dir
}

console.log('smoke-skill-install-candidates: ok')
