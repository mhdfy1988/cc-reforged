import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const catalogModule = await importDist('src/skills/skillRuntimeCatalog.js')
const {
  createSkillRuntimeCatalog,
  getLastSkillRuntimeCatalogDiagnostics,
} = catalogModule

const commands = [
  promptCommand('matrix', 'mcp', 'mcp'),
  promptCommand('matrix', 'projectSettings', 'dynamic'),
  promptCommand('matrix', 'bundled', 'bundled'),
  promptCommand('matrix', 'userSettings', 'managed'),
  promptCommand('standalone-mcp', 'mcp', 'mcp'),
]

const catalog = createSkillRuntimeCatalog(commands)
const byName = new Map(catalog.commands.map(command => [command.name, command]))
assert.equal(byName.get('matrix').loadedFrom, 'managed')
assert.equal(byName.get('standalone-mcp').loadedFrom, 'mcp')
assert.equal(catalog.diagnostics.length, 3)

const latest = getLastSkillRuntimeCatalogDiagnostics()
assert.equal(latest.length, 3)
assert.deepEqual(
  latest.map(item => item.skipped.loadedFrom).sort(),
  ['bundled', 'dynamic', 'mcp'],
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

console.log('smoke-skill-runtime-catalog-unified: ok')
