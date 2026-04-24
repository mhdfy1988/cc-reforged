#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const rootDir = dirname(fileURLToPath(import.meta.url))
const entrypoint = resolve(rootDir, 'dist/src/entrypoints/cli.js')
const loader = resolve(rootDir, 'bun-bundle-loader.mjs')
const loaderUrl = pathToFileURL(loader).href

if (!existsSync(entrypoint)) {
  console.error(
    'Claude Code Reforged has not been built yet. Run `npm.cmd run build` first.',
  )
  process.exitCode = 1
} else {
  const result = spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-loader',
      loaderUrl,
      entrypoint,
      ...process.argv.slice(2),
    ],
    {
      env: process.env,
      stdio: 'inherit',
      windowsHide: false,
    },
  )

  if (result.error) {
    console.error(result.error.message)
    process.exitCode = 1
  } else {
    process.exitCode = result.status ?? 1
  }
}
