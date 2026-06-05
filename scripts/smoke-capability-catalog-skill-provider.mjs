import assert from 'node:assert/strict'
import {
  createRuntimeSmokeEnv,
  importDist,
  installSkillFromSource,
  writeSourceSkill,
} from './smoke-skill-runtime-helpers.mjs'

const { listSkillCapabilities } = await importDist(
  'src/services/capabilities/skillCapabilityProvider.js',
)

const env = await createRuntimeSmokeEnv('ccr-capability-skill-provider-')
try {
  const sourceDir = await writeSourceSkill(env.root, 'unified-skill-cap')
  await installSkillFromSource({
    name: 'unified-skill-cap',
    sourceDir,
    configHome: env.configHome,
  })

  const capabilities = await listSkillCapabilities({
    configHomeDir: env.configHome,
    cwd: env.root,
  })
  const skill = capabilities.find(capability => capability.name === 'unified-skill-cap')
  assert.ok(skill)
  assert.equal(skill.kind, 'skill')
  assert.equal(skill.source.kind, 'managed-skill')
  assert.equal(skill.state.installed, true)
  assert.equal(skill.invocation.modelInvocable, true)
  assert.equal(skill.relations.installedRef, 'user:unified-skill-cap')
} finally {
  await env.cleanup()
}

console.log('smoke-capability-catalog-skill-provider: ok')
