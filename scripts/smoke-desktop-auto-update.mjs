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
  "import { autoUpdater } from 'electron-updater'",
  'autoDownload = false',
  'autoInstallOnAppQuit = false',
  "CCR_DESKTOP_DISABLE_UPDATES === '1'",
  'checkForUpdates()',
  'downloadUpdate()',
  'quitAndInstall(false, true)',
  'beforeInstall',
]) {
  assertText(files.updateService, expected, 'update service is missing an expected behavior')
}

for (const channel of [
  "'ccr:update-status'",
  "'ccr:update-check'",
  "'ccr:update-download'",
  "'ccr:update-install'",
]) {
  assertText(files.main, channel, 'main process is missing an update IPC channel')
}

assertText(files.main, 'updateInstallInProgress', 'main process must avoid blocking updater quit')
assertText(files.main, 'status.updates = updateState', 'main process must persist update state in desktop status')
assertText(files.main, "broadcast('update'", 'main process must broadcast update state changes')

for (const method of [
  'getUpdateStatus',
  'checkForUpdates',
  'downloadUpdate',
  'installUpdate',
]) {
  assertText(files.preload, method, 'preload API is missing an update method')
}

for (const expected of [
  '自动更新',
  '检查更新',
  '下载',
  '重启安装',
  'getUpdateStatusText',
  'getUpdateDetailText',
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
        'electron-updater adapter',
        'development disabled guard',
        'manual download policy',
        'install quit guard',
        'main IPC channels',
        'preload API',
        'settings UI controls',
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
