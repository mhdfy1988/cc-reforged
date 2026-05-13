#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const repoRoot = process.cwd()
const reportOnly = process.argv.includes('--report-only')
const releaseDir = join(repoRoot, 'release', 'desktop')
const winUnpackedDir = join(releaseDir, 'win-unpacked')
const resourcesDir = join(winUnpackedDir, 'resources')
const appAsarPath = join(resourcesDir, 'app.asar')
const appAsarUnpackedDir = join(resourcesDir, 'app.asar.unpacked')
const unpackedNodeModulesDir = join(appAsarUnpackedDir, 'node_modules')
const packageJsonPath = join(repoRoot, 'package.json')

const thresholds = {
  maxAppAsarUnpackedFiles: Number(process.env.CCR_PACKAGE_LAYOUT_MAX_UNPACKED_FILES ?? 1000),
  maxUnpackedNodeModulesFiles: Number(
    process.env.CCR_PACKAGE_LAYOUT_MAX_UNPACKED_NODE_MODULES_FILES ?? 500,
  ),
  maxAppAsarUnpackedBytes: Number(process.env.CCR_PACKAGE_LAYOUT_MAX_UNPACKED_BYTES ?? 50 * 1024 * 1024),
  maxUnpackedNodeModulesBytes: Number(
    process.env.CCR_PACKAGE_LAYOUT_MAX_UNPACKED_NODE_MODULES_BYTES ?? 30 * 1024 * 1024,
  ),
}

if (!existsSync(packageJsonPath)) {
  fail('package.json not found', { packageJsonPath })
}

if (!existsSync(winUnpackedDir)) {
  fail('win-unpacked not found. Run npm.cmd run desktop:pack first.', { winUnpackedDir })
}

const packageJson = JSON.parse(await readText(packageJsonPath))
const expectedInstaller = `CCR-${packageJson.version}-win-x64.exe`
const installerPath = join(releaseDir, expectedInstaller)
const blockmapPath = `${installerPath}.blockmap`

const report = {
  ok: true,
  reportOnly,
  thresholds,
  paths: {
    releaseDir,
    winUnpackedDir,
    resourcesDir,
    appAsarPath,
    appAsarUnpackedDir,
    unpackedNodeModulesDir,
    installerPath,
    blockmapPath,
  },
  installer: await fileSummary(installerPath),
  blockmap: await fileSummary(blockmapPath),
  winUnpacked: await treeSummary(winUnpackedDir),
  resources: await topLevelSummaries(resourcesDir),
  appAsar: await fileSummary(appAsarPath),
  appAsarUnpacked: await treeSummary(appAsarUnpackedDir),
  unpackedNodeModules: await treeSummary(unpackedNodeModulesDir),
  forbiddenUnpackedPaths: {
    cli: await pathExists(join(appAsarUnpackedDir, 'cli.js')),
    dist: await pathExists(join(appAsarUnpackedDir, 'dist')),
    bunBundleLoader: await pathExists(join(appAsarUnpackedDir, 'bun-bundle-loader.mjs')),
  },
}

if (!reportOnly) {
  assertLayout(report)
}

console.log(JSON.stringify(report, null, 2))

async function readText(path) {
  const { readFile } = await import('node:fs/promises')
  return readFile(path, 'utf8')
}

async function pathExists(path) {
  return existsSync(path)
}

async function fileSummary(path) {
  if (!existsSync(path)) {
    return {
      path,
      exists: false,
      bytes: 0,
      mb: 0,
    }
  }

  const info = await stat(path)
  return {
    path,
    exists: true,
    bytes: info.isFile() ? info.size : 0,
    mb: toMb(info.isFile() ? info.size : 0),
  }
}

async function topLevelSummaries(path) {
  if (!existsSync(path)) {
    return []
  }

  const entries = await readdir(path, { withFileTypes: true })
  const summaries = await Promise.all(
    entries.map(async entry => {
      const entryPath = join(path, entry.name)
      if (entry.isDirectory()) {
        const summary = await treeSummary(entryPath)
        return {
          name: entry.name,
          type: 'dir',
          ...summary,
        }
      }

      const summary = await fileSummary(entryPath)
      return {
        name: entry.name,
        type: 'file',
        ...summary,
        files: summary.exists ? 1 : 0,
        dirs: 0,
      }
    }),
  )

  return summaries.sort((a, b) => b.bytes - a.bytes)
}

async function treeSummary(path) {
  if (!existsSync(path)) {
    return {
      path,
      exists: false,
      bytes: 0,
      mb: 0,
      files: 0,
      dirs: 0,
    }
  }

  let bytes = 0
  let files = 0
  let dirs = 0
  const stack = [path]

  while (stack.length > 0) {
    const current = stack.pop()
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = join(current, entry.name)
      if (entry.isDirectory()) {
        dirs += 1
        stack.push(entryPath)
      } else if (entry.isFile()) {
        files += 1
        bytes += (await stat(entryPath)).size
      }
    }
  }

  return {
    path,
    exists: true,
    bytes,
    mb: toMb(bytes),
    files,
    dirs,
  }
}

function assertLayout(report) {
  const failures = []

  if (!report.appAsar.exists) {
    failures.push({
      check: 'app.asar.exists',
      message: 'app.asar must exist',
      path: report.appAsar.path,
    })
  }

  if (report.forbiddenUnpackedPaths.cli) {
    failures.push({
      check: 'app.asar.unpacked.cli',
      message: 'cli.js must stay inside app.asar instead of app.asar.unpacked',
    })
  }

  if (report.forbiddenUnpackedPaths.dist) {
    failures.push({
      check: 'app.asar.unpacked.dist',
      message: 'dist must stay inside app.asar instead of app.asar.unpacked',
    })
  }

  if (report.forbiddenUnpackedPaths.bunBundleLoader) {
    failures.push({
      check: 'app.asar.unpacked.bunBundleLoader',
      message: 'bun-bundle-loader.mjs must stay inside app.asar instead of app.asar.unpacked',
    })
  }

  if (report.appAsarUnpacked.files > thresholds.maxAppAsarUnpackedFiles) {
    failures.push({
      check: 'app.asar.unpacked.files',
      actual: report.appAsarUnpacked.files,
      max: thresholds.maxAppAsarUnpackedFiles,
    })
  }

  if (report.appAsarUnpacked.bytes > thresholds.maxAppAsarUnpackedBytes) {
    failures.push({
      check: 'app.asar.unpacked.bytes',
      actual: report.appAsarUnpacked.bytes,
      max: thresholds.maxAppAsarUnpackedBytes,
    })
  }

  if (report.unpackedNodeModules.files > thresholds.maxUnpackedNodeModulesFiles) {
    failures.push({
      check: 'app.asar.unpacked.node_modules.files',
      actual: report.unpackedNodeModules.files,
      max: thresholds.maxUnpackedNodeModulesFiles,
    })
  }

  if (report.unpackedNodeModules.bytes > thresholds.maxUnpackedNodeModulesBytes) {
    failures.push({
      check: 'app.asar.unpacked.node_modules.bytes',
      actual: report.unpackedNodeModules.bytes,
      max: thresholds.maxUnpackedNodeModulesBytes,
    })
  }

  if (failures.length > 0) {
    fail('desktop package layout is not slim enough', { failures, report })
  }
}

function toMb(bytes) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100
}

function fail(message, details = {}) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message,
        ...details,
      },
      null,
      2,
    ),
  )
  process.exit(1)
}
