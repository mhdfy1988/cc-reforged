import assert from 'node:assert/strict'
import {
  createRuntimeSmokeEnv,
  enableRuntimeCommandLoading,
  importDist,
  installSkillFromSource,
  writeSourceSkill,
} from './smoke-skill-runtime-helpers.mjs'

const env = await createRuntimeSmokeEnv('ccr-skill-slash-entry-')

try {
  await enableRuntimeCommandLoading()
  const commandsModule = await importDist('src/commands.js')
  const {
    clearCommandsCache,
    getSkillToolCommands,
    getSlashCommandToolSkills,
  } = commandsModule

  const modelOffDir = await writeSourceSkill(env.root, 'slash-model-off', {
    disableModelInvocation: true,
  })
  const userOffDir = await writeSourceSkill(env.root, 'slash-user-off', {
    userInvocable: false,
  })
  await installSkillFromSource({
    name: 'slash-model-off',
    sourceDir: modelOffDir,
    configHome: env.configHome,
    modelInvocable: false,
    userInvocable: true,
  })
  await installSkillFromSource({
    name: 'slash-user-off',
    sourceDir: userOffDir,
    configHome: env.configHome,
    modelInvocable: true,
    userInvocable: false,
  })
  clearCommandsCache()

  const slashSkillNames = (await getSlashCommandToolSkills(env.root)).map(
    command => command.name,
  )
  assert.equal(slashSkillNames.includes('slash-model-off'), true)
  assert.equal(slashSkillNames.includes('slash-user-off'), false)

  const modelSkillNames = (await getSkillToolCommands(env.root)).map(
    command => command.name,
  )
  assert.equal(modelSkillNames.includes('slash-model-off'), false)
  assert.equal(modelSkillNames.includes('slash-user-off'), true)
} finally {
  await env.cleanup()
}

console.log('smoke-skill-slash-entry: ok')
