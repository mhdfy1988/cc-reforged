import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const discoveryModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/skills/importDiscovery.js')).href
)

const { discoverSkillImportCandidate } = discoveryModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-import-local-'))

try {
  const skillDir = join(root, 'local-demo')
  await mkdir(join(skillDir, 'scripts'), { recursive: true })
  await mkdir(join(skillDir, 'references', 'nested'), { recursive: true })
  await mkdir(join(skillDir, 'assets'), { recursive: true })
  await writeFile(
    join(skillDir, 'SKILL.md'),
    `---\nname: local-demo\ndescription: Use when testing local skill import discovery.\nallowed-tools: Read, Grep\nargument-hint: <topic>\nuser-invocable: false\ncontext: fork\n---\n\nFollow the local discovery smoke instructions.\n`,
    'utf8',
  )
  await writeFile(join(skillDir, 'scripts', 'run.js'), 'console.log("ok")\n', 'utf8')
  await writeFile(
    join(skillDir, 'references', 'nested', 'guide.md'),
    '# Guide\n',
    'utf8',
  )
  await writeFile(join(skillDir, 'assets', 'icon.txt'), 'icon\n', 'utf8')

  const result = await discoverSkillImportCandidate({
    kind: 'local-skill-dir',
    path: skillDir,
  })

  assert.equal(result.success, true)
  assert.equal(result.candidate.state, 'available')
  assert.equal(result.candidate.name, 'local-demo')
  assert.equal(
    result.candidate.description,
    'Use when testing local skill import discovery.',
  )
  assert.equal(result.candidate.originVendor, 'agent-skills')
  assert.equal(result.candidate.targetName, 'local-demo')
  assert.equal(result.candidate.normalizedPreview.source, 'imported')
  assert.equal(result.candidate.normalizedPreview.invocation.modelInvocable, true)
  assert.equal(result.candidate.normalizedPreview.invocation.userInvocable, false)
  assert.equal(result.candidate.normalizedPreview.invocation.context, 'fork')
  assert.deepEqual(result.candidate.normalizedPreview.invocation.allowedTools, [
    'Read',
    'Grep',
  ])
  assert.deepEqual(result.candidate.normalizedPreview.resources.scripts, [
    'scripts/run.js',
  ])
  assert.deepEqual(result.candidate.normalizedPreview.resources.references, [
    'references/nested/guide.md',
  ])
  assert.deepEqual(result.candidate.normalizedPreview.resources.assets, [
    'assets/icon.txt',
  ])

  const missingResult = await discoverSkillImportCandidate({
    kind: 'local-skill-dir',
    path: join(root, 'missing-skill'),
  })
  assert.equal(missingResult.success, false)
  assert.equal(missingResult.error.reason, 'missing-skill-md')

} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-skill-import-local-discovery: ok')
