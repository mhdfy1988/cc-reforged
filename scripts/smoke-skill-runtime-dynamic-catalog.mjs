import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const catalogModule = await importDist('src/skills/skillRuntimeCatalog.js')
const { createSkillRuntimeCatalog, getSkillRuntimePriority } = catalogModule

const project = promptCommand('shared-dynamic', 'projectSettings', 'skills')
const dynamic = promptCommand('shared-dynamic', 'projectSettings', 'dynamic')
const mcp = promptCommand('mcp-lower', 'mcp', 'mcp')
const dynamicHigherThanMcp = promptCommand('mcp-lower', 'projectSettings', 'dynamic')

assert.equal(getSkillRuntimePriority(dynamic), 6)
assert.equal(getSkillRuntimePriority(mcp), 7)

const catalog = createSkillRuntimeCatalog([
  dynamic,
  project,
  mcp,
  dynamicHigherThanMcp,
])
const byName = new Map(catalog.commands.map(command => [command.name, command]))
assert.equal(byName.get('shared-dynamic'), project)
assert.equal(byName.get('mcp-lower'), dynamicHigherThanMcp)
assert.equal(catalog.diagnostics.length, 2)
assert.equal(
  catalog.diagnostics.some(
    item =>
      item.name === 'shared-dynamic' &&
      item.kept.loadedFrom === 'skills' &&
      item.skipped.loadedFrom === 'dynamic',
  ),
  true,
)

function promptCommand(name, source, loadedFrom) {
  return {
    type: 'prompt',
    name,
    description: `${name} description`,
    source,
    loadedFrom,
    contentLength: 0,
    progressMessage: 'running',
    async getPromptForCommand() {
      return []
    },
  }
}

console.log('smoke-skill-runtime-dynamic-catalog: ok')
