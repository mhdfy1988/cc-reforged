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

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-import-compatible-'))

try {
  const codexDir = join(root, 'codex-demo')
  await mkdir(join(codexDir, 'agents'), { recursive: true })
  await mkdir(join(codexDir, 'assets'), { recursive: true })
  await writeFile(
    join(codexDir, 'SKILL.md'),
    `---\nname: codex-demo\ndescription: Use when testing Codex skill import discovery.\n---\n\nCodex body.\n`,
    'utf8',
  )
  await writeFile(
    join(codexDir, 'agents', 'openai.yaml'),
    `interface:\n  short_description: Codex UI short description\n  icon_small: ./assets/small.svg\n  icon_large: ./assets/large.png\n  brand_color: "#123456"\n  default_prompt: Use codex-demo.\n`,
    'utf8',
  )

  const codexResult = await discoverSkillImportCandidate({
    kind: 'codex-skill-dir',
    path: codexDir,
  })
  assert.equal(codexResult.success, true)
  assert.equal(codexResult.candidate.originVendor, 'codex')
  assert.equal(
    codexResult.candidate.normalizedPreview.interface.shortDescription,
    'Codex UI short description',
  )
  assert.equal(
    codexResult.candidate.normalizedPreview.interface.defaultPrompt,
    'Use codex-demo.',
  )

  const brokenCodexDir = join(root, 'broken-codex-demo')
  await mkdir(join(brokenCodexDir, 'agents'), { recursive: true })
  await writeFile(
    join(brokenCodexDir, 'SKILL.md'),
    `---\nname: broken-codex-demo\ndescription: Use when testing broken Codex metadata.\n---\n\nBroken Codex body.\n`,
    'utf8',
  )
  await writeFile(join(brokenCodexDir, 'agents', 'openai.yaml'), '[', 'utf8')
  const brokenCodexResult = await discoverSkillImportCandidate({
    kind: 'codex-skill-dir',
    path: brokenCodexDir,
  })
  assert.equal(brokenCodexResult.success, true)
  assert.equal(
    brokenCodexResult.candidate.warnings.some(value =>
      value.includes('openai.yaml'),
    ),
    true,
  )

  const openClawDir = join(root, 'openclaw-demo')
  await mkdir(openClawDir, { recursive: true })
  await writeFile(
    join(openClawDir, 'SKILL.md'),
    `---\nname: openclaw-demo\ndescription: Use when testing OpenClaw skill import discovery.\nmetadata:\n  openclaw:\n    skillKey: openclaw-demo\n    requires:\n      bins:\n        - node\n      env:\n        - OPENCLAW_API_KEY\n    install:\n      - kind: node\n        package: "@example/openclaw-demo"\n---\n\nOpenClaw body.\n`,
    'utf8',
  )

  const openClawResult = await discoverSkillImportCandidate({
    kind: 'openclaw-skill-dir',
    path: openClawDir,
  })
  assert.equal(openClawResult.success, true)
  assert.equal(openClawResult.candidate.originVendor, 'openclaw')
  assert.equal(openClawResult.candidate.normalizedPreview.origin.vendor, 'openclaw')
  assert.equal(
    openClawResult.candidate.warnings.some(value =>
      value.includes('requires.bins: node'),
    ),
    true,
  )
  assert.equal(
    openClawResult.candidate.warnings.some(value =>
      value.includes('requires.env: OPENCLAW_API_KEY'),
    ),
    true,
  )
  assert.equal(
    openClawResult.candidate.warnings.some(value =>
      value.includes('will not execute'),
    ),
    true,
  )
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-skill-import-compatible-discovery: ok')
