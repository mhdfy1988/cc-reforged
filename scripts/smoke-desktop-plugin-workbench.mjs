import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

const [page, client, preload, main, styles] = await Promise.all([
  read('apps/desktop/src/renderer/src/components/pages/PluginsPage.tsx'),
  read('apps/desktop/src/renderer/src/domain/pluginManagementClient.ts'),
  read('apps/desktop/src/preload/index.ts'),
  read('apps/desktop/src/main/index.ts'),
  read('apps/desktop/src/renderer/src/styles.css'),
])

assert.match(page, /pluginManagementClient/)
assert.doesNotMatch(page, /CapabilityManagementState/)
assert.doesNotMatch(page, /listCapabilityManagement/)
assert.match(page, /导入 Plugin/)
assert.match(page, /Plugin 包类型/)
assert.match(page, />文件夹</)
assert.match(page, />压缩包</)
assert.match(page, /pluginManagementClient\.importLocal/)
assert.match(page, /refreshPluginRuntimeAndCatalog/)
assert.match(page, /pluginManagementClient\.refreshRuntime\(\)/)
assert.match(page, /当前没有已安装或内置 Plugin/)
assert.doesNotMatch(page, /Plugin 导入来源/)
assert.doesNotMatch(page, /isOfficialMarketplaceSource/)
assert.doesNotMatch(page, /claude-plugins-official/)
assert.doesNotMatch(page, /aria-label="插件视图"/)
assert.doesNotMatch(page, />\s*浏览\s*</)
assert.doesNotMatch(page, /Marketplace 筛选/)
assert.doesNotMatch(page, /marketplace\.json/)
assert.doesNotMatch(page, /查看安装计划/)
assert.doesNotMatch(page, /默认不启用、不激活/)
assert.doesNotMatch(page, /PluginBrowseDetail/)
assert.doesNotMatch(page, /MarketplacePluginCard/)
assert.doesNotMatch(page, /plugin-browse-install-bar/)
assert.doesNotMatch(page, /已安装 Plugin 不会被卸载/)
assert.doesNotMatch(page, /确认移除/)
assert.match(page, /确认\{formatAction\(props\.plan\.action\)\}/)
assert.match(page, /props\.error/)
assert.match(page, /const canRepair = canRepairPlugin\(plugin\)/)
assert.match(page, /function canRepairPlugin\(plugin: PluginManagementItem\)/)
assert.match(page, /candidate\.sourceKind === 'marketplace'[\s\S]*candidate\.source !== undefined/)
assert.match(page, /\{canRepair \? \([\s\S]*label="修复插件"/)

for (const label of [
  '概览',
  '能力',
  '运行时',
  '配置',
  '依赖与更新',
  '安全与来源',
  '诊断',
]) {
  assert.match(page, new RegExp(label))
}

for (const action of [
  "'enable'",
  "'disable'",
  "'update'",
  "'rollback'",
  "'repair'",
  "'uninstall'",
]) {
  assert.match(page, new RegExp(action))
}

assert.match(client, /window\.ccr\.listPlugins/)
assert.match(client, /window\.ccr\.planPluginAction/)
assert.match(client, /window\.ccr\.applyPluginAction/)
assert.match(client, /window\.ccr\.getPluginOperation/)
assert.match(client, /window\.ccr\.refreshRuntime\(\)/)
assert.match(client, /window\.ccr\.importLocalPlugin/)
assert.match(client, /window\.ccr\.addPluginMarketplace/)
assert.match(client, /window\.ccr\.removePluginMarketplace/)
assert.match(client, /window\.ccr\.refreshPluginMarketplace/)
assert.match(preload, /ccr:plugins-list/)
assert.match(preload, /ccr:plugin-action-plan/)
assert.match(preload, /ccr:plugin-action-apply/)
assert.match(preload, /ccr:plugin-local-import/)
assert.match(preload, /ccr:plugin-marketplace-add/)
assert.match(preload, /ccr:plugin-marketplace-remove/)
assert.match(preload, /ccr:plugin-marketplace-refresh/)
assert.match(preload, /ccr:refresh-runtime/)
assert.match(main, /client\.listPlugins/)
assert.match(main, /client\.planPluginAction/)
assert.match(main, /client\.applyPluginAction/)
assert.match(main, /activatePluginRuntimeSnapshot\('manual-refresh-runtime'\)/)
assert.match(main, /client\.importLocalPlugin/)
assert.match(main, /client\.addPluginMarketplace/)
assert.match(main, /client\.removePluginMarketplace/)
assert.match(main, /client\.refreshPluginMarketplace/)

assert.match(styles, /\.plugin-market-layout[\s\S]*overflow: hidden/)
assert.match(styles, /\.plugin-directory-list,[\s\S]*overflow: auto/)
assert.match(styles, /\.plugin-detail-panel[\s\S]*overflow: auto/)
assert.match(styles, /\.plugin-workbench \.plugin-market-toolbar/)
assert.match(styles, /\.plugin-source-dialog/)
assert.match(styles, /@media \(max-width: 980px\)[\s\S]*\.plugin-management-heading/)

console.log('Desktop Plugin workbench smoke passed.')

async function read(path) {
  return readFile(resolve(root, path), 'utf8')
}
