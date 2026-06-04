import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const catalogModule = await importDist('src/skills/skillRuntimeCatalog.js')
const { createSkillRuntimeCatalog } = catalogModule

const managed = promptCommand('shared-mcp', 'userSettings', 'managed')
const mcp = promptCommand('shared-mcp', 'mcp', 'mcp')
const mcpOnly = promptCommand('remote-skill', 'mcp', 'mcp')

const catalog = createSkillRuntimeCatalog([mcp, managed, mcpOnly])
const byName = new Map(catalog.commands.map(command => [command.name, command]))

assert.equal(byName.get('shared-mcp'), managed)
assert.equal(byName.get('remote-skill'), mcpOnly)
assert.equal(catalog.diagnostics.length, 1)
assert.equal(catalog.diagnostics[0].name, 'shared-mcp')
assert.equal(catalog.diagnostics[0].kept.loadedFrom, 'managed')
assert.equal(catalog.diagnostics[0].skipped.loadedFrom, 'mcp')

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

console.log('smoke-skill-runtime-mcp-catalog: ok')
