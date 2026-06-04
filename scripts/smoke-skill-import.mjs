import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [discoveryModule, plannerModule, managerModule] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/importDiscovery.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/importPlanner.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/importManager.js')).href),
])

const { discoverSkillImportCandidate } = discoveryModule
const { createSkillImportPlan } = plannerModule
const { applySkillImportPlan } = managerModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-import-apply-'))
const configHome = join(root, 'ccr-home')

try {
  const localDir = await createSkillDir('local-demo', {
    frontmatter: 'name: local-demo\ndescription: Local import demo.',
    body: 'Local body.',
    script: true,
  })
  const localResult = await importSource({
    kind: 'local-skill-dir',
    path: localDir,
  })
  assert.equal(localResult.package.name, 'local-demo')
  assert.equal(localResult.package.source, 'imported')
  assert.deepEqual(localResult.package.resources.scripts, ['scripts/run.js'])

  const localCandidate = await mustDiscover({
    kind: 'local-skill-dir',
    path: localDir,
  })
  const conflictPlan = createSkillImportPlan(localCandidate, { configHomeDir: configHome })
  assert.equal(conflictPlan.importable, false)
  assert.equal(conflictPlan.conflicts[0].kind, 'target-exists')

  const codexDir = await createSkillDir('codex-demo', {
    frontmatter: 'name: codex-demo\ndescription: Codex import demo.',
    body: 'Codex body.',
  })
  await mkdir(join(codexDir, 'agents'), { recursive: true })
  await writeFile(
    join(codexDir, 'agents', 'openai.yaml'),
    'interface:\n  short_description: Codex imported UI\n  default_prompt: Use codex-demo.\n',
    'utf8',
  )
  const codexResult = await importSource({
    kind: 'codex-skill-dir',
    path: codexDir,
  })
  assert.equal(codexResult.package.origin.vendor, 'codex')
  assert.equal(codexResult.package.interface.shortDescription, 'Codex imported UI')

  const openClawDir = await createSkillDir('openclaw-demo', {
    frontmatter:
      'name: openclaw-demo\ndescription: OpenClaw import demo.\nmetadata:\n  openclaw:\n    requires:\n      env:\n        - OPENCLAW_KEY\n    install:\n      - kind: node\n        package: "@example/openclaw-demo"',
    body: 'OpenClaw body.',
  })
  const openClawResult = await importSource({
    kind: 'openclaw-skill-dir',
    path: openClawDir,
  })
  assert.equal(openClawResult.package.origin.vendor, 'openclaw')
  assert.equal(
    openClawResult.warnings.some(value => value.includes('OPENCLAW_KEY')),
    true,
  )

  const commandDir = join(root, 'project', '.claude', 'commands')
  await mkdir(commandDir, { recursive: true })
  const commandPath = join(commandDir, 'foo.md')
  await writeFile(
    commandPath,
    '---\ndescription: Foo command import demo.\n---\n\nRun foo with $ARGUMENTS.\n',
    'utf8',
  )
  const commandResult = await importSource({
    kind: 'claude-command',
    path: commandPath,
  })
  assert.equal(commandResult.package.name, 'foo')
  assert.equal(commandResult.package.origin.vendor, 'claude')
  assert.equal(
    (await readFile(join(commandResult.targetDir, 'SKILL.md'), 'utf8')).includes(
      'name: foo',
    ),
    true,
  )
  assert.equal(commandResult.package.invocation.userInvocable, true)

  const marker = JSON.parse(
    await readFile(join(commandResult.targetDir, '.ccr-skill-import.json'), 'utf8'),
  )
  assert.equal(marker.converted, true)
  assert.equal(marker.originalCommandPath, commandPath)
} finally {
  await rm(root, { recursive: true, force: true })
}

async function createSkillDir(name, options) {
  const dir = join(root, 'sources', name)
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'SKILL.md'),
    `---\n${options.frontmatter}\n---\n\n${options.body}\n`,
    'utf8',
  )
  if (options.script) {
    await mkdir(join(dir, 'scripts'), { recursive: true })
    await writeFile(join(dir, 'scripts', 'run.js'), 'console.log("ok")\n', 'utf8')
  }
  return dir
}

async function mustDiscover(source) {
  const result = await discoverSkillImportCandidate(source)
  assert.equal(result.success, true, result.success ? '' : result.error.message)
  return result.candidate
}

async function importSource(source) {
  const candidate = await mustDiscover(source)
  const plan = createSkillImportPlan(candidate, { configHomeDir: configHome })
  assert.equal(plan.importable, true)
  await assert.rejects(() =>
    applySkillImportPlan(plan, {
      confirmationToken: 'wrong-token',
      configHomeDir: configHome,
    }),
  )
  return applySkillImportPlan(plan, {
    confirmationToken: plan.confirmation.token,
    configHomeDir: configHome,
    now: new Date('2026-06-02T00:00:00.000Z'),
  })
}

console.log('smoke-skill-import: ok')
