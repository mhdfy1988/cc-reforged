import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  createRuntimeSmokeEnv,
  importDist,
  installSkillFromSource,
  skillMarkdown,
  writeSourceSkill,
} from './smoke-skill-runtime-helpers.mjs'

const env = await createRuntimeSmokeEnv('ccr-skill-runtime-loader-')

try {
  const loader = await importDist('src/skills/installedSkillLoader.js')

  for (const spec of [
    { name: 'runtime-ok' },
    { name: 'runtime-disabled', enabled: false },
    { name: 'runtime-model-off', modelInvocable: false, userInvocable: true },
    { name: 'runtime-user-off', modelInvocable: true, userInvocable: false },
    { name: 'runtime-drifted' },
  ]) {
    const sourceDir = await writeSourceSkill(env.root, spec.name)
    await installSkillFromSource({
      ...spec,
      sourceDir,
      configHome: env.configHome,
    })
  }

  await writeFile(
    join(env.configHome, 'skills', 'packages', 'runtime-drifted', 'SKILL.md'),
    skillMarkdown('runtime-drifted', { body: 'Changed after install.' }),
    'utf8',
  )

  const result = await loader.loadInstalledSkillRuntimePackages({
    configHomeDir: env.configHome,
  })
  const entriesByName = new Map(
    result.entries.map(entry => [entry.package.name, entry]),
  )

  assert.ok(entriesByName.has('runtime-ok'))
  assert.ok(entriesByName.has('runtime-model-off'))
  assert.ok(entriesByName.has('runtime-user-off'))
  assert.equal(entriesByName.has('runtime-disabled'), false)
  assert.equal(entriesByName.has('runtime-drifted'), false)
  assert.equal(entriesByName.get('runtime-ok').package.source, 'managed')
  assert.equal(entriesByName.get('runtime-model-off').activation.modelInvocable, false)
  assert.equal(entriesByName.get('runtime-model-off').activation.userInvocable, true)
  assert.equal(entriesByName.get('runtime-user-off').activation.modelInvocable, true)
  assert.equal(entriesByName.get('runtime-user-off').activation.userInvocable, false)
  assert.equal(result.summary.installed, 2)
  assert.equal(result.summary.disabled, 2)
  assert.equal(result.summary.drifted, 1)
} finally {
  await env.cleanup()
}

console.log('smoke-skill-runtime-installed-loader: ok')
