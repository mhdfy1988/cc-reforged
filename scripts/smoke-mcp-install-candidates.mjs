import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ccrConfigDir = await mkdtemp(join(tmpdir(), 'ccr-mcp-candidates-'))
process.env.CCR_CONFIG_DIR = ccrConfigDir

function localHttpManifest(name, description) {
  return {
    schemaVersion: 1,
    name,
    displayName: name,
    description,
    source: {
      kind: 'remote-url',
      url: `http://127.0.0.1:3001/${name}`,
      headersRequired: false,
    },
    transport: 'http',
    serverConfig: {
      type: 'http',
      url: `http://127.0.0.1:3001/${name}`,
    },
    permissions: [
      {
        kind: 'network',
        required: true,
      },
    ],
    dataBoundary: 'local-only',
  }
}

try {
  const manifestDir = join(ccrConfigDir, 'mcp', 'manifests')
  await mkdir(manifestDir, { recursive: true })
  await writeFile(
    join(manifestDir, 'local-extra.json'),
    `${JSON.stringify(localHttpManifest('local_extra', 'Local extra MCP'), null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    join(manifestDir, 'playwright-duplicate.json'),
    `${JSON.stringify(localHttpManifest('playwright', 'Duplicate name MCP'), null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    join(manifestDir, 'install-state.json'),
    `${JSON.stringify(localHttpManifest('install_state', 'Install state MCP'), null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    join(manifestDir, 'bad.json'),
    '{"schemaVersion":1,"name":"bad"}',
    'utf8',
  )

  const configModule = await import(
    pathToFileURL(join(repoRoot, 'dist/src/utils/config.js')).href
  )
  configModule.enableConfigs()

  const mcpConfigModule = await import(
    pathToFileURL(join(repoRoot, 'dist/src/services/mcp/config.js')).href
  )
  const installManagerModule = await import(
    pathToFileURL(join(repoRoot, 'dist/src/services/mcp/installManager.js')).href
  )

  const { addMcpConfig } = mcpConfigModule
  const {
    applyCcrMcpInstallPlan,
    createCcrMcpInstallPlan,
    searchCcrMcpInstallCandidates,
  } = installManagerModule

  const all = await searchCcrMcpInstallCandidates()
  assert.ok(all.sources.some(source => source.sourceType === 'builtin-preset'))
  assert.ok(all.sources.some(source => source.sourceType === 'local-manifest'))
  assert.ok(
    all.sources.some(
      source => source.sourceType === 'remote-registry' && source.enabled === false,
    ),
  )
  assert.ok(all.errors.some(error => error.originPath.endsWith('bad.json')))
  assert.ok(
    all.candidates.some(
      candidate =>
        candidate.manifest.name === 'local_extra' &&
        candidate.sourceType === 'local-manifest' &&
        candidate.state === 'available',
    ),
  )
  assert.equal(
    all.candidates.filter(candidate => candidate.manifest.name === 'playwright')
      .length,
    2,
  )
  assert.ok(
    all.candidates
      .filter(candidate => candidate.manifest.name === 'playwright')
      .every(candidate => candidate.state === 'duplicate-name'),
  )

  await addMcpConfig(
    'local_extra',
    {
      type: 'http',
      url: 'http://127.0.0.1:3001/local_extra',
    },
    'user',
  )
  const configured = await searchCcrMcpInstallCandidates({ query: 'local_extra' })
  assert.equal(configured.candidates[0].state, 'configured')

  const installable = localHttpManifest('install_state', 'Install state MCP')
  const plan = createCcrMcpInstallPlan({
    scope: 'user',
    manifest: installable,
  })
  await applyCcrMcpInstallPlan({
    scope: 'user',
    manifest: installable,
    confirmed: true,
    confirmationToken: plan.confirmation.token,
  })
  const installed = await searchCcrMcpInstallCandidates({ query: 'install_state' })
  assert.equal(installed.candidates[0].state, 'installed')

  console.log('smoke-mcp-install-candidates: ok')
} finally {
  await rm(ccrConfigDir, { recursive: true, force: true })
}
