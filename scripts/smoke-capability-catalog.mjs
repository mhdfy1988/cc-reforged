import assert from 'node:assert/strict'
import {
  createRuntimeSmokeEnv,
  importDist,
  installSkillFromSource,
  writeSourceSkill,
} from './smoke-skill-runtime-helpers.mjs'

const { listExtensionCapabilities } = await importDist(
  'src/services/capabilities/capabilityService.js',
)
const { enableConfigs } = await importDist('src/utils/config.js')

const env = await createRuntimeSmokeEnv('ccr-capability-catalog-')
try {
  enableConfigs()
  const sourceDir = await writeSourceSkill(env.root, 'catalog-skill-cap')
  await installSkillFromSource({
    name: 'catalog-skill-cap',
    sourceDir,
    configHome: env.configHome,
  })

  const catalog = await listExtensionCapabilities({
    configHomeDir: env.configHome,
    cwd: env.root,
  })
  assert.equal(catalog.schemaVersion, 1)
  assert.equal(catalog.summary.byKind.skill > 0, true)
  assert.equal(catalog.summary.byKind.tool > 0, true)
  assert.equal(
    catalog.capabilities.some(capability => capability.name === 'catalog-skill-cap'),
    true,
  )
} finally {
  await env.cleanup()
}

console.log('smoke-capability-catalog: ok')
