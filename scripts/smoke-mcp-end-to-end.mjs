import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const clientModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/app-server/client/index.js')).href
)
const builderModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/installManifestBuilder.js'))
    .href
)

const { startManagedStdioAppServerClient } = clientModule
const { buildCcrMcpInstallManifestInput } = builderModule

const root = await mkdtemp(join(tmpdir(), 'ccr-mcp-e2e-'))
const configHome = join(root, 'ccr-home')

function makeManifestFixtures() {
  return [
    {
      name: 'e2e_stdio',
      expectedKind: 'local-directory',
      expectedTransport: 'stdio',
      manifest: buildCcrMcpInstallManifestInput({
        template: 'local-stdio',
        name: 'e2e_stdio',
        displayName: 'E2E stdio MCP',
        command: process.execPath,
        directory: './fixtures/e2e-stdio',
        argsText: './server.mjs\n--stdio',
        envText: 'E2E_SECRET=secret',
      }),
    },
    {
      name: 'e2e_local_http',
      expectedKind: 'remote-url',
      expectedTransport: 'http',
      manifest: buildCcrMcpInstallManifestInput({
        template: 'local-http',
        name: 'e2e_local_http',
        displayName: 'E2E local HTTP MCP',
        url: 'http://127.0.0.1:3217/mcp',
        headersText: 'X-E2E=yes',
      }),
    },
    {
      name: 'e2e_npm_package',
      expectedKind: 'stdio-npm-package',
      expectedTransport: 'stdio',
      manifest: buildCcrMcpInstallManifestInput({
        template: 'stdio-npm-package',
        name: 'e2e_npm_package',
        displayName: 'E2E npm MCP',
        packageName: '@example/e2e-mcp',
        version: '0.1.0',
        argsText: '--stdio',
      }),
    },
    {
      name: 'e2e_remote_http',
      expectedKind: 'remote-url',
      expectedTransport: 'http',
      manifest: buildCcrMcpInstallManifestInput({
        template: 'remote-http',
        name: 'e2e_remote_http',
        displayName: 'E2E remote HTTP MCP',
        url: 'https://example.invalid/mcp',
        headersText: 'Authorization=Bearer test-token',
      }),
    },
  ]
}

function findCandidate(search, name) {
  return search.candidates.find(candidate => candidate.manifest?.name === name)
}

try {
  const managed = startManagedStdioAppServerClient({
    defaultTimeoutMs: 20_000,
    process: {
      command: process.execPath,
      args: ['cli.js', 'app-server', '--listen', 'stdio'],
      cwd: repoRoot,
      env: {
        ...process.env,
        CCR_CONFIG_DIR: configHome,
        CLAUDE_CONFIG_DIR: configHome,
        DISABLE_TELEMETRY: '1',
        DISABLE_ERROR_REPORTING: '1',
        NO_COLOR: '1',
      },
    },
  })

  try {
    await managed.client.initialize({
      clientInfo: {
        name: 'smoke-mcp-end-to-end',
        title: 'CCR MCP End-to-End Smoke',
      },
      capabilities: {
        mcpManagement: true,
      },
    })

    const workspaceA = join(root, 'workspace-a')
    const workspaceB = join(root, 'workspace-b')
    await mkdir(workspaceA, { recursive: true })
    await mkdir(workspaceB, { recursive: true })
    await managed.client.openWorkspace({ path: workspaceA, trust: 'trusted' })
    await managed.client.addMcp({
      name: 'e2e_global_toggle',
      scope: 'user',
      config: {
        type: 'http',
        url: 'http://127.0.0.1:3217/mcp',
      },
    })
    await managed.client.disableMcp({ name: 'e2e_global_toggle' })
    assert.equal(
      (await managed.client.listMcp({ includeDisabled: true })).servers.find(
        server => server.name === 'e2e_global_toggle',
      )?.enabled,
      false,
      'disabled user MCP should be disabled in the current workspace',
    )
    await managed.client.openWorkspace({ path: workspaceB, trust: 'trusted' })
    assert.equal(
      (await managed.client.listMcp({ includeDisabled: true })).servers.find(
        server => server.name === 'e2e_global_toggle',
      )?.enabled,
      false,
      'disabled user MCP state must remain global after switching workspace',
    )
    await managed.client.enableMcp({ name: 'e2e_global_toggle' })
    await managed.client.openWorkspace({ path: workspaceA, trust: 'trusted' })
    assert.equal(
      (await managed.client.listMcp({ includeDisabled: true })).servers.find(
        server => server.name === 'e2e_global_toggle',
      )?.enabled,
      true,
      'enabled user MCP state must remain global after switching back',
    )
    await managed.client.removeMcp({ name: 'e2e_global_toggle', scope: 'user' })

    const fixtures = makeManifestFixtures()
    for (const fixture of fixtures) {
      const plan = await managed.client.planMcpInstall({
        manifest: fixture.manifest,
        scope: 'user',
      })
      assert.equal(plan.installable, true, `${fixture.name} should be installable`)
      assert.equal(plan.manifest.kind, fixture.expectedKind)
      assert.equal(plan.manifest.transport, fixture.expectedTransport)
      assert.ok(plan.confirmation?.token)
    }

    const saved = await managed.client.saveMcpInstallManifest({
      manifest: fixtures.find(fixture => fixture.name === 'e2e_local_http').manifest,
      overwrite: true,
    })
    assert.equal(saved.saved, true)
    assert.equal(saved.name, 'e2e_local_http')
    assert.match(saved.path, /mcp[\\/]manifests[\\/]e2e_local_http\.json$/)

    const savedSearch = await managed.client.searchMcpInstalls({
      query: 'e2e_local_http',
    })
    const savedCandidate = findCandidate(savedSearch, 'e2e_local_http')
    assert.ok(savedCandidate)
    assert.equal(savedCandidate.sourceType, 'local-manifest')
    assert.equal(savedCandidate.state, 'available')

    await assert.rejects(
      () =>
        managed.client.saveMcpInstallManifest({
          manifest: fixtures.find(fixture => fixture.name === 'e2e_local_http')
            .manifest,
          overwrite: false,
        }),
      /already exists|已存在|MCP install candidate manifest already exists/,
    )

    await managed.client.disableMcp({ name: 'e2e_local_http' })

    const localPlan = await managed.client.planMcpInstall({
      manifest: savedCandidate.manifestInput,
      scope: 'user',
    })
    await managed.client.applyMcpInstall({
      manifest: savedCandidate.manifestInput,
      scope: 'user',
      confirmed: true,
      confirmationToken: localPlan.confirmation.token,
    })
    const localMcpAfterInstall = await managed.client.listMcp({
      includeDisabled: true,
    })
    assert.equal(
      localMcpAfterInstall.servers.find(server => server.name === 'e2e_local_http')
        ?.enabled,
      true,
      'fresh install must clear stale disabled state for the same MCP name',
    )

    const localInstalled = await managed.client.listMcpInstalls()
    const localRecord = localInstalled.installed.find(
      record => record.name === 'e2e_local_http',
    )
    assert.equal(localRecord?.configStatus?.state, 'configured')

    const installedSearch = await managed.client.searchMcpInstalls({
      query: 'e2e_local_http',
    })
    assert.equal(findCandidate(installedSearch, 'e2e_local_http')?.state, 'installed')

    await managed.client.disableMcp({ name: 'e2e_local_http' })
    await managed.client.uninstallMcp({
      name: 'e2e_local_http',
      confirmed: true,
    })
    const afterLocalUninstall = await managed.client.listMcpInstalls()
    assert.equal(
      afterLocalUninstall.installed.some(record => record.name === 'e2e_local_http'),
      false,
    )
    await managed.client.addMcp({
      name: 'e2e_local_http',
      scope: 'user',
      config: {
        type: 'http',
        url: 'http://127.0.0.1:3217/mcp',
      },
    })
    const localMcpAfterManualReadd = await managed.client.listMcp({
      includeDisabled: true,
    })
    assert.equal(
      localMcpAfterManualReadd.servers.find(
        server => server.name === 'e2e_local_http',
      )?.enabled,
      true,
      'uninstall must clear disabled state so same-name manual config is enabled',
    )
    await managed.client.removeMcp({ name: 'e2e_local_http', scope: 'user' })

    const presetSearch = await managed.client.searchMcpInstalls({ query: 'sentry' })
    const sentryCandidate = findCandidate(presetSearch, 'sentry')
    assert.ok(sentryCandidate)
    assert.equal(sentryCandidate.sourceType, 'builtin-preset')
    assert.equal(sentryCandidate.manifest.kind, 'remote-url')
    assert.equal(sentryCandidate.manifest.dataBoundary, 'remote-service')

    const sentryPlan = await managed.client.planMcpInstall({
      manifest: sentryCandidate.manifestInput,
      scope: 'user',
    })
    await managed.client.applyMcpInstall({
      manifest: sentryCandidate.manifestInput,
      scope: 'user',
      confirmed: true,
      confirmationToken: sentryPlan.confirmation.token,
    })
    assert.equal(
      (await managed.client.listMcpInstalls()).installed.find(
        record => record.name === 'sentry',
      )?.configStatus?.state,
      'configured',
    )

    await managed.client.removeMcp({ name: 'sentry', scope: 'user' })
    assert.equal(
      (await managed.client.listMcpInstalls()).installed.find(
        record => record.name === 'sentry',
      )?.configStatus?.state,
      'missing-config',
    )

    await managed.client.repairMcp({
      name: 'sentry',
      scope: 'user',
      confirmed: true,
    })
    assert.equal(
      (await managed.client.listMcpInstalls()).installed.find(
        record => record.name === 'sentry',
      )?.configStatus?.state,
      'configured',
    )

    await managed.client.uninstallMcp({ name: 'sentry', confirmed: true })
    assert.equal(
      (await managed.client.listMcpInstalls()).installed.some(
        record => record.name === 'sentry',
      ),
      false,
    )

    const allCandidates = await managed.client.searchMcpInstalls({})
    assert.ok(
      allCandidates.sources.some(
        source => source.sourceType === 'remote-registry' && source.enabled === false,
      ),
    )
    assert.equal(
      allCandidates.candidates.some(
        candidate => candidate.sourceType === 'remote-registry',
      ),
      false,
    )
  } finally {
    await managed.close()
  }
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-mcp-end-to-end: ok')
