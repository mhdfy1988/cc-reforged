import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const prefetch = await importDist('src/services/skillSearch/prefetch.js')

assert.equal(prefetch.getInterTurnSkillDiscoverySignal([]), null)
assert.equal(
  prefetch.getInterTurnSkillDiscoverySignal([
    userMessage([{ type: 'text', text: 'ordinary user text' }]),
  ]),
  null,
)
assert.equal(
  prefetch.getInterTurnSkillDiscoverySignal([
    userMessage([
      {
        type: 'tool_result',
        tool_use_id: 'tool-1',
        content: 'UI data mismatch found in renderer state',
      },
    ]),
  ]),
  'UI data mismatch found in renderer state',
)
assert.equal(
  prefetch.getInterTurnSkillDiscoverySignal([
    userMessage([
      {
        type: 'tool_result',
        tool_use_id: 'tool-2',
        is_error: true,
        content: 'failed result is not a discovery signal',
      },
    ]),
  ]),
  null,
)
assert.equal(
  prefetch.getInterTurnSkillDiscoverySignal([
    userMessage([
      {
        type: 'tool_result',
        tool_use_id: 'tool-3',
        content: [{ type: 'text', text: 'update README and goal docs' }],
      },
    ]),
  ]),
  'update README and goal docs',
)

function userMessage(content) {
  return {
    type: 'user',
    message: {
      role: 'user',
      content,
    },
  }
}

console.log('smoke-skill-inter-turn-discovery: ok')
