import assert from 'node:assert/strict'
import {
  createRuntimeSmokeEnv,
  enableRuntimeCommandLoading,
  importDist,
  installSkillFromSource,
  writeSourceSkill,
} from './smoke-skill-runtime-helpers.mjs'

const env = await createRuntimeSmokeEnv('ccr-skill-runtime-slash-command-')

try {
  for (const spec of [
    { name: 'slash-visible', modelInvocable: false, userInvocable: true },
    { name: 'slash-user-off', modelInvocable: true, userInvocable: false },
    { name: 'slash-disabled', enabled: false },
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
  const commands = await commandsModule.getSlashCommandToolSkills(env.root)
  const names = new Set(commands.map(command => command.name))

  assert.equal(names.has('slash-visible'), true)
  assert.equal(names.has('slash-user-off'), false)
  assert.equal(names.has('slash-disabled'), false)
} finally {
  await env.cleanup()
}

console.log('smoke-skill-runtime-slash-command: ok')
