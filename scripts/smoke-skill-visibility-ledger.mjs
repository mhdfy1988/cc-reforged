import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const planner = await importDist('src/skills/skillContextInjectionPlanner.js')
const discovery = await importDist(
  'src/services/skillSearch/skillDiscoveryService.js',
)
const ledger = await importDist('src/skills/skillVisibilityLedger.js')

const commands = [
  promptCommand('same-helper', 'managed'),
  promptCommand('same-helper', 'plugin', {
    source: 'plugin',
    pluginId: 'plugin-one',
  }),
  promptCommand('loaded-helper', 'managed'),
  promptCommand('catalog-helper', 'bundled'),
]

const plan = planner.planSkillContextInjection(commands, {
  skillSearchEnabled: true,
})
const index = discovery.createSkillDiscoveryIndex(plan.discoveryCandidates)
const sameEntries = index.filter(entry => entry.name === 'same-helper')
assert.equal(sameEntries.length, 2)
assert.notEqual(sameEntries[0].capabilityId, sameEntries[1].capabilityId)

const visibleContext = {}
ledger.recordVisibleSkill(visibleContext, {
  name: sameEntries[0].name,
  capabilityId: sameEntries[0].capabilityId,
})
const visibleFiltered = discovery.filterAlreadySurfacedSkillDiscoveryIndex(
  index,
  visibleContext,
)
assert.equal(
  visibleFiltered.some(entry => entry.capabilityId === sameEntries[0].capabilityId),
  false,
)
assert.equal(
  visibleFiltered.some(entry => entry.capabilityId === sameEntries[1].capabilityId),
  true,
  'same-name different-source Skill must not be filtered by name when ids differ',
)

const nameOnlyContext = {
  visibleSkillNames: new Set(['same-helper']),
}
const nameOnlyFiltered = discovery.filterAlreadySurfacedSkillDiscoveryIndex(
  index,
  nameOnlyContext,
)
assert.equal(
  nameOnlyFiltered.filter(entry => entry.name === 'same-helper').length,
  2,
  'name-only visibility must not hide canonical Skill entries',
)

const loadedCommand = commands.find(command => command.name === 'loaded-helper')
const loadedContext = {}
ledger.recordLoadedSkillCommand(loadedContext, loadedCommand)
const loadedFiltered = discovery.filterAlreadySurfacedSkillDiscoveryIndex(
  index,
  loadedContext,
)
assert.equal(
  loadedFiltered.some(entry => entry.name === 'loaded-helper'),
  false,
)
assert.equal(loadedContext.loadedSkillNames.has('loaded-helper'), true)
assert.equal(loadedContext.loadedSkillCapabilityIds.size, 1)

const catalog = discovery.discoverSkills(index, '我现在有哪些 skill', {
  limit: 10,
})
assert.equal(catalog.catalogQuery, true)
assert.equal(catalog.matches.length, index.length)

console.log('smoke-skill-visibility-ledger: ok')

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
