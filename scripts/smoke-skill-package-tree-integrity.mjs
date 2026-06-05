import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  createRuntimeSmokeEnv,
  importDist,
  installSkillFromSource,
  skillMarkdown,
} from './smoke-skill-runtime-helpers.mjs'

const env = await createRuntimeSmokeEnv('ccr-skill-package-tree-')

try {
  const inspector = await importDist('src/services/skills/installInspector.js')
  const sourceDir = join(env.root, 'source-skills', 'tree-drift')
  await mkdir(join(sourceDir, 'references'), { recursive: true })
  await writeFile(join(sourceDir, 'SKILL.md'), skillMarkdown('tree-drift'), 'utf8')
  await writeFile(join(sourceDir, 'references', 'note.md'), 'v1\n', 'utf8')

  await installSkillFromSource({
    name: 'tree-drift',
    sourceDir,
    configHome: env.configHome,
  })

  const installed = await inspector.inspectInstalledSkill('tree-drift', {
    configHomeDir: env.configHome,
  })
  assert.equal(installed.status, 'installed')
  assert.ok(installed.checksum.expectedPackageTree)
  assert.equal(installed.checksum.drifted, false)

  await writeFile(
    join(env.configHome, 'skills', 'packages', 'tree-drift', 'references', 'note.md'),
    'v2\n',
    'utf8',
  )
  const drifted = await inspector.inspectInstalledSkill('tree-drift', {
    configHomeDir: env.configHome,
  })
  assert.equal(drifted.status, 'drifted')
  assert.equal(drifted.checksum.drifted, true)
  assert.equal(drifted.checksum.driftedPaths.includes('packageTree'), true)
  assert.notEqual(
    drifted.checksum.actualPackageTree,
    drifted.checksum.expectedPackageTree,
  )
} finally {
  await env.cleanup()
}

console.log('smoke-skill-package-tree-integrity: ok')
