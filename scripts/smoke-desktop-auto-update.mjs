#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packageJson = readJson('package.json')
const files = {
  main: readText('apps/desktop/src/main/index.ts'),
  preload: readText('apps/desktop/src/preload/index.ts'),
  renderer: readText('apps/desktop/src/renderer/src/main.tsx'),
  updateService: readText('apps/desktop/src/main/updateService.ts'),
  updateState: readText('apps/desktop/src/main/updateState.ts'),
}

if (!packageJson.dependencies?.['electron-updater']) {
  fail('electron-updater must be a runtime dependency')
}

const reactVersion = packageJson.dependencies?.react
const reactDomVersion = packageJson.devDependencies?.['react-dom']
if (!reactVersion || reactVersion !== reactDomVersion || reactVersion.startsWith('^')) {
  fail('react and react-dom must be pinned to the exact same version for Desktop dev runtime', {
    react: reactVersion,
    reactDom: reactDomVersion,
  })
}

for (const status of [
  'idle',
  'disabled',
  'checking',
  'available',
  'not-available',
  'downloading',
  'downloaded',
  'installing',
  'error',
]) {
  assertText(files.updateState, `'${status}'`, 'update state is missing an expected status')
}

for (const expected of [
  "import electronUpdater from 'electron-updater'",
  'const { autoUpdater } = electronUpdater',
  'autoDownload = false',
  'autoInstallOnAppQuit = false',
  "CCR_DESKTOP_DISABLE_UPDATES === '1'",
  'checkForUpdates()',
  'downloadUpdate()',
  'quitAndInstall(false, true)',
  'beforeInstall',
  'applyDevelopmentMock',
  'Desktop update mock is only available in development mode.',
]) {
  assertText(files.updateService, expected, 'update service is missing an expected behavior')
}

for (const channel of [
  "'ccr:update-status'",
  "'ccr:update-check'",
  "'ccr:update-download'",
  "'ccr:update-install'",
  "'ccr:update-dev-mock'",
  "'ccr:turn-interrupt'",
]) {
  assertText(files.main, channel, 'main process is missing an expected IPC channel')
}

assertText(files.main, 'interruptTurn()', 'main process must expose turn interruption')
assertText(files.main, 'managedClient.client.interruptTurn', 'main process must call the App Server interrupt API')

assertText(files.main, 'updateInstallInProgress', 'main process must avoid blocking updater quit')
assertText(files.main, 'status.updates = updateState', 'main process must persist update state in desktop status')
assertText(files.main, "broadcast('update'", 'main process must broadcast update state changes')
assertText(files.main, "../preload/index.mjs", 'main process must load the emitted ESM preload file')
assertText(files.main, 'CCR_DESKTOP_RENDERER_DIAGNOSTICS', 'main process must support renderer diagnostics')
assertText(files.main, "titleBarStyle: 'hidden'", 'main process must enable the custom Windows title bar')
assertText(files.main, 'titleBarOverlay', 'main process must keep native window controls over the custom title bar')

for (const method of [
  'getUpdateStatus',
  'checkForUpdates',
  'downloadUpdate',
  'installUpdate',
  'mockUpdateState',
  'interruptTurn',
]) {
  assertText(files.preload, method, 'preload API is missing an expected method')
}

for (const expected of [
  '自动更新',
  '检查更新',
  '下载',
  '重启安装',
  'TopbarUpdateNotice',
  'topbar-update',
  '下载更新',
  'getUpdateStatusText',
  'getUpdateDetailText',
  'shouldShowTopbarUpdateNotice',
  '开发态模拟',
  'mockUpdateState',
  'interruptCurrentTurn',
  'activeTurnId',
  '停止',
  'WindowTitlebar',
  'window-titlebar',
]) {
  assertText(files.renderer, expected, 'renderer is missing update UI affordance')
}

console.log(
  JSON.stringify(
    {
      ok: true,
      dependency: `electron-updater@${packageJson.dependencies['electron-updater']}`,
      checked: [
        'update state statuses',
        'react runtime version alignment',
        'electron-updater adapter',
        'development disabled guard',
        'manual download policy',
        'install quit guard',
        'main IPC channels',
        'preload API',
        'turn interrupt action',
        'custom title bar',
        'settings UI controls',
        'topbar update download action',
        'development update mock controls',
      ],
    },
    null,
    2,
  ),
)

function readJson(relativePath) {
  return JSON.parse(readText(relativePath))
}

function readText(relativePath) {
  const path = join(root, relativePath)
  if (!existsSync(path)) {
    fail('required file is missing', { path })
  }
  return readFileSync(path, 'utf8')
}

function assertText(text, expected, message) {
  if (!text.includes(expected)) {
    fail(message, { expected })
  }
}

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2))
  process.exit(1)
}
