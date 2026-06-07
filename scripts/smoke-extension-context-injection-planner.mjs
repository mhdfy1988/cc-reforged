import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const planner = await importDist('src/skills/skillContextInjectionPlanner.js')

const { planSkillContextInjection } = planner

const commands = [
  promptCommand('bundled-helper', 'bundled'),
  promptCommand('managed-helper', 'managed'),
  promptCommand('mcp-helper', 'mcp'),
  promptCommand('plugin-helper', 'plugin', { source: 'plugin' }),
  promptCommand('dynamic-helper', 'dynamic'),
  promptCommand('project-helper', 'skills', { source: 'projectSettings' }),
  promptCommand('model-off-helper', 'managed', { disableModelInvocation: true }),
  promptCommand('disabled-helper', 'managed', { isEnabled: () => false }),
  localCommand('local-helper'),
]

const searchPlan = planSkillContextInjection(commands, {
  skillSearchEnabled: true,
  filteredListingMax: 30,
  sentSkillNames: new Set(['managed-helper']),
})

assert.deepEqual(names(searchPlan.staticSkillListing), [
  'bundled-helper',
  'managed-helper',
  'mcp-helper',
])
assert.deepEqual(names(searchPlan.newStaticSkillListing), [
  'bundled-helper',
  'mcp-helper',
])
assert.deepEqual(names(searchPlan.discoveryCandidates), [
  'bundled-helper',
  'managed-helper',
  'mcp-helper',
  'plugin-helper',
  'dynamic-helper',
  'project-helper',
])
assert.equal(
  searchPlan.discoveryCandidates.every(candidate =>
    candidate.capabilityId.startsWith('skill:'),
  ),
  true,
)
assert.deepEqual(
  searchPlan.hidden.map(decision => [decision.command.name, decision.reason]),
  [
    ['plugin-helper', 'source-discovery-only'],
    ['dynamic-helper', 'source-discovery-only'],
    ['project-helper', 'source-discovery-only'],
    ['model-off-helper', 'model-invocation-disabled'],
    ['disabled-helper', 'command-disabled'],
    ['local-helper', 'unsupported-command-type'],
  ],
)
assert.equal(searchPlan.budgetUsage.hiddenCount, searchPlan.hidden.length)

const legacyPlan = planSkillContextInjection(commands, {
  skillSearchEnabled: false,
})
assert.deepEqual(names(legacyPlan.staticSkillListing), [
  'bundled-helper',
  'managed-helper',
  'mcp-helper',
  'plugin-helper',
  'dynamic-helper',
  'project-helper',
])
assert.equal(legacyPlan.budgetUsage.filteredListingMax, null)

const overBudgetPlan = planSkillContextInjection(
  [
    promptCommand('bundled-helper', 'bundled'),
    promptCommand('managed-helper', 'managed'),
    ...Array.from({ length: 31 }, (_, index) =>
      promptCommand(`mcp-helper-${index}`, 'mcp'),
    ),
  ],
  {
    skillSearchEnabled: true,
    filteredListingMax: 30,
  },
)
assert.deepEqual(names(overBudgetPlan.staticSkillListing), [
  'bundled-helper',
  'managed-helper',
])
assert.equal(
  overBudgetPlan.hidden.filter(item => item.reason === 'mcp-over-budget').length,
  31,
)
assert.equal(overBudgetPlan.diagnostics.length, 1)

function names(items) {
  return items.map(item => item.name)
}

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
      return {
        async call() {
          return { type: 'skip' }
        },
      }
    },
  }
}

console.log('smoke-extension-context-injection-planner: ok')
