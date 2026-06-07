import assert from 'node:assert/strict'
import '../dist/src/skills/loadSkillsDir.js'
import { buildExtensionCapabilityCatalog } from '../dist/src/services/capabilities/capabilityCatalog.js'

const {
  fetchMcpSkillsForClient,
  getMcpSkillDiscoveryDiagnostics,
} = await import('../dist/src/skills/mcpSkills.js')

let requestCount = 0
const client = {
  name: 'skills-server',
  type: 'connected',
  capabilities: { resources: {} },
  serverInfo: { name: 'skills-fixture', version: '1.0.0' },
  config: {},
  client: {
    async request(request) {
      requestCount += 1
      if (request.method === 'resources/list') {
        return {
          resources: [
            {
              uri: 'skill://index.json',
              name: 'Skill index',
              mimeType: 'application/json',
            },
            {
              uri: 'skill:///review-helper/SKILL.md',
              name: 'review-helper',
              mimeType: 'text/markdown',
            },
          ],
        }
      }
      if (request.params.uri === 'skill://index.json') {
        return {
          contents: [
            {
              uri: 'skill://index.json',
              mimeType: 'application/json',
              text: JSON.stringify({
                skills: [
                  {
                    name: 'review-helper',
                    description: 'Review code changes.',
                    version: '1.2.3',
                    uri: 'skill:///review-helper/SKILL.md',
                  },
                ],
              }),
            },
          ],
        }
      }
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'text/markdown',
            text: `---
name: Review Helper
when_to_use: Review a code change
allowed-tools: Read, Grep
---
Review the current change carefully.
`,
          },
        ],
      }
    },
  },
}

const first = await fetchMcpSkillsForClient(client)
assert.equal(first.length, 1)
assert.equal(first[0].name, 'review-helper')
assert.equal(first[0].loadedFrom, 'mcp')
assert.equal(first[0].source, 'mcp')
assert.equal(first[0].isMcp, true)
assert.equal(first[0].mcpServerName, 'skills-server')
assert.equal(first[0].mcpSkillUri, 'skill:///review-helper/SKILL.md')
assert.equal(first[0].mcpSkillVersion, '1.2.3')
assert.equal(first[0].whenToUse, 'Review a code change')
assert.deepEqual(getMcpSkillDiscoveryDiagnostics('skills-server'), [])

const afterFirstFetch = requestCount
const cached = await fetchMcpSkillsForClient(client)
assert.equal(cached, first)
assert.equal(requestCount, afterFirstFetch)

fetchMcpSkillsForClient.cache.delete('skills-server')
await fetchMcpSkillsForClient(client)
assert.ok(requestCount > afterFirstFetch)

const catalog = buildExtensionCapabilityCatalog([
  capability({
    id: 'mcp-server:skills-server',
    name: 'skills-server',
    kind: 'mcp-server',
    enabled: false,
    runtimeVisible: false,
  }),
  capability({
    id: 'skill:mcp:review-helper',
    name: 'review-helper',
    kind: 'skill',
    relations: { parentMcpServerName: 'skills-server' },
  }),
  capability({
    id: 'mcp-prompt:skills-server:review',
    name: 'mcp__skills-server__review',
    kind: 'mcp-prompt',
    runtimeVisible: false,
    relations: { parentMcpServerName: 'skills-server' },
  }),
])

const child = catalog.capabilities.find(
  item => item.id === 'skill:mcp:review-helper',
)
assert.equal(child.state.available, false)
assert.equal(child.state.runtimeVisible, false)
assert.ok(child.state.hiddenReasons.includes('mcp-server-unavailable'))
assert.ok(
  catalog.capabilities
    .find(item => item.kind === 'mcp-prompt')
    .state.hiddenReasons.includes('mcp-server-unavailable'),
)

function capability({
  id,
  name,
  kind,
  enabled = true,
  runtimeVisible = true,
  relations = {},
}) {
  return {
    schemaVersion: 1,
    id,
    name,
    displayName: name,
    description: name,
    kind,
    source: {
      kind: kind === 'skill' ? 'mcp' : 'mcp',
      label: 'fixture',
      mcpServerName: 'skills-server',
    },
    state: {
      installed: false,
      enabled,
      available: enabled,
      runtimeVisible,
      status: enabled ? 'available' : 'disabled',
    },
    invocation: {
      modelInvocable: kind === 'skill',
      userInvocable: kind === 'skill',
      toolInvocable: kind === 'mcp-tool',
    },
    relations,
    diagnostics: [],
  }
}

console.log('smoke-mcp-skill-resource-adapter: ok')
