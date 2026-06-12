import assert from 'node:assert/strict'
import {
  findReverseDependents,
  resolveDependencyClosure,
  verifyAndDemote,
} from '../dist/src/utils/plugins/dependencyResolver.js'

const graph = new Map([
  ['root@one', { dependencies: ['dependency'] }],
  ['dependency@one', { dependencies: [] }],
  ['cycle-a@one', { dependencies: ['cycle-b'] }],
  ['cycle-b@one', { dependencies: ['cycle-a'] }],
  ['missing-root@one', { dependencies: ['absent'] }],
  ['cross-root@one', { dependencies: ['shared@two'] }],
  ['shared@two', { dependencies: [] }],
])
const lookup = async id => graph.get(id) ?? null

assert.deepEqual(
  await resolveDependencyClosure('root@one', lookup, new Set()),
  {
    ok: true,
    closure: ['dependency@one', 'root@one'],
  },
)

const cycle = await resolveDependencyClosure(
  'cycle-a@one',
  lookup,
  new Set(),
)
assert.equal(cycle.ok, false)
assert.equal(cycle.reason, 'cycle')
assert.deepEqual(cycle.chain, [
  'cycle-a@one',
  'cycle-b@one',
  'cycle-a@one',
])

const missing = await resolveDependencyClosure(
  'missing-root@one',
  lookup,
  new Set(),
)
assert.equal(missing.ok, false)
assert.equal(missing.reason, 'not-found')
assert.equal(missing.missing, 'absent@one')

const crossBlocked = await resolveDependencyClosure(
  'cross-root@one',
  lookup,
  new Set(),
)
assert.equal(crossBlocked.ok, false)
assert.equal(crossBlocked.reason, 'cross-marketplace')
assert.equal(crossBlocked.dependency, 'shared@two')

assert.deepEqual(
  await resolveDependencyClosure(
    'cross-root@one',
    lookup,
    new Set(),
    new Set(['two']),
  ),
  {
    ok: true,
    closure: ['shared@two', 'cross-root@one'],
  },
)
assert.deepEqual(
  await resolveDependencyClosure(
    'cross-root@one',
    lookup,
    new Set(['shared@two']),
  ),
  {
    ok: true,
    closure: ['cross-root@one'],
  },
)

const loaded = [
  plugin('dependency@one', true),
  plugin('disabled-dependency@one', false),
  plugin('uses-disabled@one', true, ['disabled-dependency']),
  plugin('uses-missing@one', true, ['missing']),
  plugin('healthy@one', true, ['dependency']),
]
const demotion = verifyAndDemote(loaded)
assert.equal(demotion.demoted.has('uses-disabled@one'), true)
assert.equal(demotion.demoted.has('uses-missing@one'), true)
assert.equal(demotion.demoted.has('healthy@one'), false)
assert.equal(
  demotion.errors.some(
    error =>
      error.source === 'uses-disabled@one' &&
      error.reason === 'not-enabled',
  ),
  true,
)
assert.equal(
  demotion.errors.some(
    error =>
      error.source === 'uses-missing@one' &&
      error.reason === 'not-found',
  ),
  true,
)

assert.deepEqual(
  findReverseDependents('dependency@one', loaded),
  ['healthy'],
)

console.log('plugin dependency boundaries smoke passed')

function plugin(source, enabled, dependencies = []) {
  const name = source.slice(0, source.indexOf('@'))
  return {
    name,
    source,
    repository: source,
    path: source,
    enabled,
    manifest: {
      name,
      version: '1.0.0',
      dependencies,
    },
  }
}
