import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const policy = await importDist('src/skills/skillContextInjectionPolicy.js')

const { applyStaticSkillListingPolicy, filterToStaticSkillListing } = policy

const commands = [
  promptCommand('bundled-helper', 'bundled'),
  promptCommand('managed-helper', 'managed'),
  promptCommand('mcp-helper', 'mcp'),
  promptCommand('plugin-helper', 'plugin'),
  promptCommand('dynamic-helper', 'dynamic'),
  promptCommand('model-off-helper', 'managed', { disableModelInvocation: true }),
  localCommand('local-helper'),
]

assert.deepEqual(
  filterToStaticSkillListing(commands).map(command => command.name),
  ['bundled-helper', 'managed-helper', 'mcp-helper'],
)

const firstPass = applyStaticSkillListingPolicy(commands)
assert.deepEqual(
  firstPass.hidden.map(decision => [decision.command.name, decision.reason]),
  [
    ['plugin-helper', 'source-discovery-only'],
    ['dynamic-helper', 'source-discovery-only'],
    ['model-off-helper', 'model-invocation-disabled'],
    ['local-helper', 'unsupported-command-type'],
  ],
)

const manyMcpCommands = [
  promptCommand('bundled-helper', 'bundled'),
  promptCommand('managed-helper', 'managed'),
  ...Array.from({ length: 31 }, (_, index) =>
    promptCommand(`mcp-helper-${index}`, 'mcp'),
  ),
]

assert.deepEqual(
  filterToStaticSkillListing(manyMcpCommands).map(command => command.name),
  ['bundled-helper', 'managed-helper'],
)

const overBudget = applyStaticSkillListingPolicy(manyMcpCommands)
assert.equal(overBudget.diagnostics.length, 1)
assert.equal(overBudget.hidden.filter(item => item.reason === 'mcp-over-budget').length, 31)

function promptCommand(name, loadedFrom, options = {}) {
  return {
    type: 'prompt',
    name,
    description: `${name} description`,
    source: loadedFrom,
    loadedFrom,
    ...options,
    contentLength: 0,
    progressMessage: 'running',
    async getPromptForCommand() {
      return []
    },
  }
}

function localCommand(name) {
  return {
    type: 'local',
    name,
    description: `${name} description`,
    loadedFrom: 'managed',
    supportsNonInteractive: false,
    async load() {
      return { async call() { return { type: 'skip' } } }
    },
  }
}

console.log('smoke-skill-static-listing-filter: ok')
