import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

process.env.CC_REFORGED_DISABLE_FEATURES = [
  process.env.CC_REFORGED_DISABLE_FEATURES,
  'EXPERIMENTAL_SKILL_SEARCH',
]
  .filter(Boolean)
  .join(',')

const featureFlags = await importDist('src/build/featureFlags.js')
assert.equal(featureFlags.feature('EXPERIMENTAL_SKILL_SEARCH'), false)

const tools = await importDist('src/tools.js')
assert.equal(
  tools.getAllBaseTools().some(tool => tool.name === 'DiscoverSkills'),
  false,
)

console.log('smoke-skill-search-feature-gate: ok')
