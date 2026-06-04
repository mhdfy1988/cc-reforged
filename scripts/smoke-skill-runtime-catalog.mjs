import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const catalogModule = await importDist('src/skills/skillRuntimeCatalog.js')
const { createSkillRuntimeCatalog, getSkillRuntimePriority } = catalogModule

const bundled = promptCommand('shared', 'bundled', 'bundled')
const managed = promptCommand('shared', 'userSettings', 'managed')
const user = promptCommand('user-skill', 'userSettings', 'skills')
const project = promptCommand('project-skill', 'projectSettings', 'skills')
const dynamic = promptCommand('dynamic-skill', 'projectSettings', 'dynamic')
const mcp = promptCommand('mcp-skill', 'mcp', 'mcp')
const legacy = promptCommand(
  'legacy-skill',
  'projectSettings',
  'commands_DEPRECATED',
)

assert.equal(getSkillRuntimePriority(project), 1)
assert.equal(getSkillRuntimePriority(user), 2)
assert.equal(getSkillRuntimePriority(managed), 3)
assert.equal(getSkillRuntimePriority(bundled), 5)
assert.equal(getSkillRuntimePriority(dynamic), 6)
assert.equal(getSkillRuntimePriority(mcp), 7)
assert.equal(getSkillRuntimePriority(legacy), 8)

const catalog = createSkillRuntimeCatalog([
  bundled,
  managed,
  user,
  project,
  dynamic,
  mcp,
  legacy,
])
const byName = new Map(catalog.commands.map(command => [command.name, command]))

assert.equal(byName.get('shared'), managed)
assert.equal(byName.get('project-skill'), project)
assert.equal(byName.get('dynamic-skill'), dynamic)
assert.equal(byName.get('mcp-skill'), mcp)
assert.equal(byName.get('legacy-skill'), legacy)
assert.equal(catalog.diagnostics.length, 1)
assert.equal(catalog.diagnostics[0].kind, 'duplicate-name')
assert.equal(catalog.diagnostics[0].kept.loadedFrom, 'managed')
assert.equal(catalog.diagnostics[0].skipped.loadedFrom, 'bundled')

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

console.log('smoke-skill-runtime-catalog: ok')
