import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const loader = await importDist('src/skills/skillRuntimeCatalogLoader.js')
const planner = await importDist('src/skills/skillContextInjectionPlanner.js')

const legacy = promptCommand('shared-helper', 'projectSettings', 'commands_DEPRECATED')
const mcp = promptCommand('shared-helper', 'mcp', 'mcp', {
  mcpServerName: 'runtime-smoke',
})

const catalog = loader.createModelInvocableSkillRuntimeCatalog({
  localCommands: [legacy],
  mcpCommands: [mcp],
})

assert.deepEqual(
  catalog.commands.map(command => [command.name, command.loadedFrom]),
  [['shared-helper', 'mcp']],
)
assert.equal(catalog.diagnostics.length, 1)
assert.equal(catalog.diagnostics[0].kind, 'duplicate-name')
assert.equal(catalog.diagnostics[0].kept.loadedFrom, 'mcp')
assert.equal(catalog.diagnostics[0].skipped.loadedFrom, 'commands_DEPRECATED')

const plan = planner.planSkillContextInjection(catalog.commands, {
  skillSearchEnabled: true,
})
assert.deepEqual(
  plan.staticSkillListing.map(command => [command.name, command.loadedFrom]),
  [['shared-helper', 'mcp']],
)
assert.deepEqual(
  plan.discoveryCandidates.map(candidate => [
    candidate.name,
    candidate.sourceKind,
    candidate.parentMcpServerName,
  ]),
  [['shared-helper', 'mcp', 'runtime-smoke']],
)

function promptCommand(name, source, loadedFrom, options = {}) {
  return {
    type: 'prompt',
    name,
    description: `${name} description`,
    source,
    loadedFrom,
    contentLength: 0,
    progressMessage: 'running',
    ...options,
    async getPromptForCommand() {
      return []
    },
  }
}

console.log('smoke-skill-listing-runtime-catalog-alignment: ok')
