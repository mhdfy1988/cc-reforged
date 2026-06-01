import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ccrConfigDir = await mkdtemp(join(tmpdir(), 'ccr-mcp-manifest-import-'))
process.env.CCR_CONFIG_DIR = ccrConfigDir

try {
  const configModule = await import(
    pathToFileURL(join(repoRoot, 'dist/src/utils/config.js')).href
  )
  configModule.enableConfigs()

  const manifestModule = await import(
    pathToFileURL(join(repoRoot, 'dist/src/services/mcp/installManifest.js')).href
  )
  const installManagerModule = await import(
    pathToFileURL(join(repoRoot, 'dist/src/services/mcp/installManager.js')).href
  )

  const { createCcrMcpInstallManifest, summarizeCcrMcpInstallManifest } =
    manifestModule
  const { createCcrMcpInstallPlan } = installManagerModule

  const localStdioPath = join(
    repoRoot,
    'docs/examples/mcp/local-stdio-manifest.json',
  )
  const localHttpPath = join(
    repoRoot,
    'docs/examples/mcp/local-http-manifest.json',
  )
  const localStdioInput = JSON.parse(await readFile(localStdioPath, 'utf8'))
  const localHttpInput = JSON.parse(await readFile(localHttpPath, 'utf8'))

  const localStdio = createCcrMcpInstallManifest(localStdioInput)
  assert.equal(localStdio.name, 'local-stdio-example')
  assert.equal(localStdio.source.kind, 'local-directory')
  assert.equal(localStdio.transport, 'stdio')
  assert.equal(
    summarizeCcrMcpInstallManifest(localStdio).kind,
    'local-directory',
  )

  const stdioPlan = createCcrMcpInstallPlan({
    scope: 'user',
    manifest: localStdio,
  })
  assert.equal(stdioPlan.name, 'local-stdio-example')
  assert.equal(stdioPlan.installable, true)
  assert.equal(stdioPlan.manifest.kind, 'local-directory')
  assert.equal(stdioPlan.serverConfigPreview.type, 'stdio')
  assert.equal(stdioPlan.serverConfigPreview.command, 'node')

  const localHttp = createCcrMcpInstallManifest(localHttpInput)
  assert.equal(localHttp.name, 'local-http-example')
  assert.equal(localHttp.source.kind, 'remote-url')
  assert.equal(localHttp.transport, 'http')
  assert.equal(localHttp.dataBoundary, 'local-only')

  const httpPlan = createCcrMcpInstallPlan({
    scope: 'user',
    manifest: localHttp,
  })
  assert.equal(httpPlan.name, 'local-http-example')
  assert.equal(httpPlan.installable, true)
  assert.equal(httpPlan.manifest.kind, 'remote-url')
  assert.equal(httpPlan.serverConfigPreview.type, 'http')
  assert.equal(httpPlan.serverConfigPreview.url, 'http://127.0.0.1:3001/mcp')

  assert.throws(
    () =>
      createCcrMcpInstallManifest({
        schemaVersion: 1,
        name: 'invalid-manifest',
        transport: 'stdio',
      }),
    /Invalid input/,
  )

  console.log('smoke-mcp-manifest-import: ok')
} finally {
  await rm(ccrConfigDir, { recursive: true, force: true })
}
