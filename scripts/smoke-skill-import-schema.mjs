import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const [importSourceModule, importPathsModule] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/importSource.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/importPaths.js')).href),
])

const {
  parseSkillImportSource,
  parseSkillImportCandidate,
  parseSkillImportPlan,
  parseCcrSkillImportMarker,
  parseSkillImportResult,
  SkillImportSourceSchema,
} = importSourceModule
const {
  CCR_SKILL_IMPORT_MARKER_FILE,
  getCcrSkillImportPaths,
  getCcrImportedSkillDir,
  getCcrSkillImportMarkerPath,
  sanitizeImportedSkillDirName,
} = importPathsModule

for (const source of [
  { kind: 'local-skill-dir', path: 'D:/skills/local' },
  { kind: 'local-archive', path: 'D:/skills/local.zip' },
  {
    kind: 'codex-skill-dir',
    path: 'D:/skills/codex',
    openaiYamlPath: 'D:/skills/codex/agents/openai.yaml',
  },
  { kind: 'openclaw-skill-dir', path: 'D:/skills/openclaw' },
  { kind: 'claude-command', path: 'D:/project/.claude/commands/foo.md' },
]) {
  assert.equal(parseSkillImportSource(source).kind, source.kind)
}

assert.equal(
  SkillImportSourceSchema().safeParse({ kind: 'local-skill-dir', path: '' })
    .success,
  false,
)

const configHome = 'D:/tmp/ccr-home'
assert.equal(
  getCcrSkillImportPaths(configHome).importedRootDir,
  'D:\\tmp\\ccr-home\\skills\\imported',
)
assert.equal(sanitizeImportedSkillDirName('bad/name:here'), 'bad-name-here')
assert.equal(
  getCcrImportedSkillDir('demo-skill', configHome),
  'D:\\tmp\\ccr-home\\skills\\imported\\demo-skill',
)
assert.equal(
  getCcrSkillImportMarkerPath('demo-skill', configHome),
  `D:\\tmp\\ccr-home\\skills\\imported\\demo-skill\\${CCR_SKILL_IMPORT_MARKER_FILE}`,
)

const packagePreview = {
  schemaVersion: 1,
  id: 'imported:demo-skill:D:/tmp/ccr-home/skills/imported/demo-skill/SKILL.md',
  name: 'demo-skill',
  description: 'Demo skill for import schema smoke.',
  bodyPath: 'D:/tmp/ccr-home/skills/imported/demo-skill/SKILL.md',
  body: 'Demo body.',
  baseDir: 'D:/tmp/ccr-home/skills/imported/demo-skill',
  source: 'imported',
  origin: {
    vendor: 'codex',
    sourcePath: 'D:/skills/codex/SKILL.md',
  },
  resources: {
    scripts: [],
    references: [],
    assets: [],
  },
  invocation: {
    modelInvocable: true,
    userInvocable: true,
    context: 'inline',
    allowedTools: [],
    argumentNames: [],
  },
  compatibility: {
    rawFrontmatter: {},
    warnings: [],
  },
}

const candidate = parseSkillImportCandidate({
  candidateId: 'candidate:demo-skill',
  source: {
    kind: 'codex-skill-dir',
    path: 'D:/skills/codex',
    openaiYamlPath: 'D:/skills/codex/agents/openai.yaml',
  },
  state: 'available',
  name: 'demo-skill',
  description: 'Demo skill for import schema smoke.',
  originVendor: 'codex',
  sourcePath: 'D:/skills/codex',
  targetName: 'demo-skill',
  normalizedPreview: packagePreview,
})
assert.equal(candidate.stateMessage, '')
assert.deepEqual(candidate.warnings, [])
assert.equal(candidate.normalizedPreview.origin.vendor, 'codex')

const archiveCandidate = parseSkillImportCandidate({
  candidateId: 'local-archive:D:/skills/archive-demo.zip',
  source: {
    kind: 'local-archive',
    path: 'D:/skills/archive-demo.zip',
    extractedPath: 'D:/tmp/ccr-skill-archive/archive-demo',
    archiveFormat: 'zip',
  },
  state: 'available',
  name: 'archive-demo',
  description: 'Archive demo skill.',
  originVendor: 'agent-skills',
  sourcePath: 'D:/skills/archive-demo.zip',
  targetName: 'archive-demo',
})
assert.equal(archiveCandidate.source.kind, 'local-archive')
assert.equal(archiveCandidate.source.archiveFormat, 'zip')

const plan = parseSkillImportPlan({
  schemaVersion: 1,
  planId: 'plan:demo-skill',
  candidateId: candidate.candidateId,
  name: candidate.name,
  source: candidate.source,
  originVendor: candidate.originVendor,
  targetDir: getCcrImportedSkillDir(candidate.targetName, configHome),
  writes: [
    {
      kind: 'skill-md',
      fromPath: 'D:/skills/codex/SKILL.md',
      toPath: 'D:/tmp/ccr-home/skills/imported/demo-skill/SKILL.md',
      mode: 'copy',
    },
    {
      kind: 'import-marker',
      toPath: getCcrSkillImportMarkerPath(candidate.targetName, configHome),
      mode: 'record',
    },
  ],
  conversion: {
    required: false,
    kind: 'none',
  },
  requiresConfirmation: true,
  confirmation: {
    token: 'confirm-demo-skill',
    message: 'Import demo-skill.',
  },
})
assert.equal(plan.importable, true)
assert.deepEqual(plan.conflicts, [])
assert.deepEqual(plan.risks, [])

const marker = parseCcrSkillImportMarker({
  schemaVersion: 1,
  name: candidate.name,
  importedAt: '2026-06-02T00:00:00.000Z',
  source: candidate.source,
  sourcePath: candidate.sourcePath,
  originVendor: candidate.originVendor,
  converted: false,
})
assert.equal(marker.converted, false)

const result = parseSkillImportResult({
  schemaVersion: 1,
  name: candidate.name,
  targetDir: plan.targetDir,
  skillFilePath: 'D:/tmp/ccr-home/skills/imported/demo-skill/SKILL.md',
  markerPath: getCcrSkillImportMarkerPath(candidate.targetName, configHome),
  package: packagePreview,
})
assert.equal(result.package.source, 'imported')
assert.deepEqual(result.warnings, [])

assert.throws(() =>
  parseSkillImportPlan({
    ...plan,
    requiresConfirmation: false,
  }),
)

console.log('smoke-skill-import-schema: ok')
