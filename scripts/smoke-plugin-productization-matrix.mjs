import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { pluginProductizationCases } from './plugin-productization-test-cases.mjs'

const packageJson = JSON.parse(await readFile('./package.json', 'utf8'))
const ids = new Set()
for (const testCase of pluginProductizationCases) {
  assert.equal(ids.has(testCase.id), false, `duplicate case id ${testCase.id}`)
  ids.add(testCase.id)
  assert.ok(testCase.title)
  assert.ok(testCase.polarity === 'positive' || testCase.polarity === 'negative')
  assert.equal(
    typeof packageJson.scripts[testCase.evidenceScript],
    'string',
    `missing evidence script ${testCase.evidenceScript}`,
  )
}
assert.ok(
  pluginProductizationCases.length >= 50,
  `expected at least 50 Plugin cases, got ${pluginProductizationCases.length}`,
)

const scenarioIds = new Set(
  pluginProductizationCases
    .filter(item => item.category === 'architecture-scenario')
    .map(item => item.scenario),
)
assert.deepEqual([...scenarioIds].sort((a, b) => a - b), range(1, 42))

for (const invariant of range(1, 14)) {
  const cases = pluginProductizationCases.filter(
    item =>
      item.category === 'final-invariant' &&
      item.invariant === invariant,
  )
  assert.equal(cases.length, 2, `invariant ${invariant} must have two cases`)
  assert.deepEqual(
    new Set(cases.map(item => item.polarity)),
    new Set(['positive', 'negative']),
  )
}

const preferredOrder = [
  'smoke:plugin-domain-session',
  'smoke:plugin-action-protocol',
  'smoke:plugin-dependency-boundaries',
  'smoke:plugin-install-transaction',
  'smoke:plugin-lifecycle-transaction',
  'smoke:plugin-transaction-fault-matrix',
  'smoke:plugin-cross-process-lock',
  'smoke:plugin-runtime-activator',
  'smoke:plugin-version-lifecycle',
  'smoke:plugin-configuration-governance',
  'smoke:plugin-app-relations',
  'smoke:plugin-marketplace-service',
  'smoke:plugin-productization-sample',
  'smoke:plugin-adapter-parity',
  'smoke:plugin-registry-compatibility',
  'smoke:plugin-legacy-write-boundary',
  'smoke:desktop-plugin-workbench',
  'smoke:external-extension-matrix',
]
const requiredScripts = new Set(
  pluginProductizationCases.map(item => item.evidenceScript),
)
assert.deepEqual(
  new Set(preferredOrder),
  requiredScripts,
  'matrix order and evidence registry must stay aligned',
)

console.log(
  `[plugin-matrix] cases=${pluginProductizationCases.length} scenarios=${scenarioIds.size} invariants=14 evidence=${preferredOrder.length}`,
)
for (const script of preferredOrder) runNpmScript(script)
console.log(
  `[plugin-matrix] passed cases=${pluginProductizationCases.length}`,
)

function runNpmScript(script) {
  console.log(`[plugin-matrix] start ${script}`)
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm'
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', `npm.cmd run ${script}`]
      : ['run', script]
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${script} failed with ${result.status}`)
  console.log(`[plugin-matrix] ok ${script}`)
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}
