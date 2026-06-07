import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const visibility = await importDist(
  'src/skills/skillCommandRuntimeVisibility.js',
)
const catalogModule = await importDist('src/skills/skillRuntimeCatalog.js')

const {
  getSkillCommandAdapterKind,
  isSkillToolCommandCandidate,
  resolveSkillCommandRuntimeEligibility,
} = visibility
const { createSkillRuntimeCatalog, listUserInvocableSkillCommands } =
  catalogModule

const legacy = promptCommand('legacy', {
  source: 'projectSettings',
  loadedFrom: 'commands_DEPRECATED',
})
const plugin = promptCommand('plugin-skill', {
  source: 'plugin',
  loadedFrom: 'plugin',
  hasUserSpecifiedDescription: true,
})
const mcpSkill = promptCommand('mcp-skill', {
  source: 'mcp',
  loadedFrom: 'mcp',
  isMcp: true,
  whenToUse: 'Use for MCP skill work.',
})
const mcpPrompt = promptCommand('mcp__docs__summarize', {
  source: 'mcp',
  isMcp: true,
  userFacingName() {
    return 'docs:summarize (MCP)'
  },
})
const modelOff = promptCommand('model-off', {
  source: 'userSettings',
  loadedFrom: 'skills',
  disableModelInvocation: true,
})
const disabled = promptCommand('disabled', {
  source: 'userSettings',
  loadedFrom: 'skills',
  isEnabled() {
    return false
  },
})
const userOff = promptCommand('user-off', {
  source: 'userSettings',
  loadedFrom: 'skills',
  userInvocable: false,
})

assert.equal(getSkillCommandAdapterKind(legacy), 'legacy-command')
assert.equal(getSkillCommandAdapterKind(plugin), 'plugin-skill')
assert.equal(getSkillCommandAdapterKind(mcpSkill), 'mcp-skill')
assert.equal(getSkillCommandAdapterKind(mcpPrompt), null)

assert.equal(isSkillToolCommandCandidate(legacy), true)
assert.equal(isSkillToolCommandCandidate(plugin), true)
assert.equal(isSkillToolCommandCandidate(mcpSkill), true)
assert.equal(isSkillToolCommandCandidate(mcpPrompt), false)
assert.equal(isSkillToolCommandCandidate(modelOff), false)
assert.equal(isSkillToolCommandCandidate(userOff), true)
assert.equal(isSkillToolCommandCandidate(disabled), false)

assert.deepEqual(resolveSkillCommandRuntimeEligibility(modelOff), {
  eligible: false,
  reason: 'model-invocation-disabled',
})
assert.deepEqual(resolveSkillCommandRuntimeEligibility(disabled), {
  eligible: false,
  reason: 'command-disabled',
})

const catalog = createSkillRuntimeCatalog([
  legacy,
  plugin,
  mcpSkill,
  mcpPrompt,
])
assert.deepEqual(
  catalog.commands.map(command => command.name).sort(),
  ['legacy', 'mcp-skill', 'plugin-skill'],
)

assert.deepEqual(
  listUserInvocableSkillCommands([
    legacy,
    plugin,
    mcpSkill,
    mcpPrompt,
    modelOff,
    userOff,
    disabled,
  ])
    .map(command => command.name)
    .sort(),
  ['legacy', 'mcp-skill', 'model-off', 'plugin-skill'],
)

console.log('smoke-skill-command-adapter-boundaries: ok')

function promptCommand(name, options) {
  return {
    type: 'prompt',
    name,
    description: `${name} description`,
    contentLength: 0,
    progressMessage: 'running',
    ...options,
    async getPromptForCommand() {
      return []
    },
  }
}
