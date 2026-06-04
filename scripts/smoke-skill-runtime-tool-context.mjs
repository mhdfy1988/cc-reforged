import assert from 'node:assert/strict'
import {
  createRuntimeSmokeEnv,
  enableRuntimeCommandLoading,
  importDist,
  installSkillFromSource,
  writeSourceSkill,
} from './smoke-skill-runtime-helpers.mjs'

const env = await createRuntimeSmokeEnv('ccr-skill-runtime-tool-context-')

try {
  for (const spec of [
    { name: 'tool-visible' },
    { name: 'tool-model-off', modelInvocable: false, userInvocable: true },
    { name: 'tool-disabled', enabled: false },
  ]) {
    const sourceDir = await writeSourceSkill(env.root, spec.name)
    await installSkillFromSource({
      ...spec,
      sourceDir,
      configHome: env.configHome,
    })
  }

  await enableRuntimeCommandLoading()
  const commandsModule = await importDist('src/commands.js')
  commandsModule.clearCommandsCache()
  const commands = await commandsModule.getSkillToolCommands(env.root)
  const names = new Set(commands.map(command => command.name))

  assert.equal(names.has('tool-visible'), true)
  assert.equal(names.has('tool-model-off'), false)
  assert.equal(names.has('tool-disabled'), false)
} finally {
  await env.cleanup()
}

console.log('smoke-skill-runtime-tool-context: ok')
