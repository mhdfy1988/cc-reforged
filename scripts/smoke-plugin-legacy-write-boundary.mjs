import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const operations = await read('src/services/plugins/pluginOperations.ts')
const installHelpers = await read(
  'src/utils/plugins/pluginInstallationHelpers.ts',
)
const managePlugins = await read('src/commands/plugin/ManagePlugins.tsx')
const lspRecommendation = await read(
  'src/hooks/useLspPluginRecommendation.tsx',
)
const startupCheck = await read(
  'src/utils/plugins/pluginStartupCheck.ts',
)

for (const forbidden of [
  'updateSettingsForSource(',
  'addInstalledPlugin(',
  'removePluginInstallation(',
  'cacheAndRegisterPlugin(',
  'installResolvedPlugin(',
]) {
  assert.equal(
    operations.includes(forbidden),
    false,
    `pluginOperations must not contain legacy write ${forbidden}`,
  )
}
for (const forbidden of [
  'updateSettingsForSource(',
  'addInstalledPlugin(',
  'cachePlugin(',
  'installResolvedPlugin(',
  'installPluginFromMarketplace(',
]) {
  assert.equal(
    installHelpers.includes(forbidden),
    false,
    `pluginInstallationHelpers must be read-only: ${forbidden}`,
  )
}
assert.equal(
  managePlugins.includes('Remove directly from all editable settings sources'),
  false,
)
assert.equal(
  managePlugins.includes("updateSettingsForSource('localSettings'"),
  false,
)
assert.match(managePlugins, /disablePluginOp\(pluginId_8, 'local'\)/)
assert.match(
  lspRecommendation,
  /installPluginFromMarketplace\(/,
)
assert.equal(lspRecommendation.includes('cacheAndRegisterPlugin('), false)
assert.match(startupCheck, /installPluginOp\(pluginId, scope\)/)
assert.equal(startupCheck.includes('cacheAndRegisterPlugin('), false)

console.log('smoke-plugin-legacy-write-boundary: ok')

async function read(path) {
  return readFile(path, 'utf8')
}
