import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const builderModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/installManifestBuilder.js'))
    .href
)

const { buildCcrMcpInstallManifestInput } = builderModule

const localStdio = buildCcrMcpInstallManifestInput({
  template: 'local-stdio',
  name: 'my-stdio',
  displayName: 'My stdio MCP',
  command: 'node',
  directory: './my-mcp',
  argsText: './my-mcp/dist/index.js\n--flag',
  envText: 'MY_API_KEY=secret\nMODE=dev',
})
assert.equal(localStdio.source.kind, 'local-directory')
assert.equal(localStdio.transport, 'stdio')
assert.equal(localStdio.entry.command, 'node')
assert.deepEqual(localStdio.entry.args, ['./my-mcp/dist/index.js', '--flag'])
assert.equal(localStdio.serverConfig.env.MY_API_KEY, 'secret')
assert.equal(localStdio.envSchema[0].secret, true)

const localHttp = buildCcrMcpInstallManifestInput({
  template: 'local-http',
  name: 'my-local-http',
  url: 'http://127.0.0.1:3001/mcp',
  headersText: 'X-Test=yes',
})
assert.equal(localHttp.source.kind, 'remote-url')
assert.equal(localHttp.transport, 'http')
assert.equal(localHttp.dataBoundary, 'local-only')
assert.equal(localHttp.serverConfig.headers['X-Test'], 'yes')

const npmPackage = buildCcrMcpInstallManifestInput({
  template: 'stdio-npm-package',
  name: 'my-package',
  packageName: '@example/mcp',
  version: '1.2.3',
  argsText: '--stdio',
})
assert.equal(npmPackage.source.kind, 'stdio-npm-package')
assert.equal(npmPackage.source.packageName, '@example/mcp')
assert.equal(npmPackage.version, '1.2.3')
assert.deepEqual(npmPackage.entry.args, ['--stdio'])

const remoteHttp = buildCcrMcpInstallManifestInput({
  template: 'remote-http',
  name: 'my-remote',
  url: 'https://example.invalid/mcp',
})
assert.equal(remoteHttp.source.kind, 'remote-url')
assert.equal(remoteHttp.dataBoundary, 'remote-service')

assert.throws(
  () =>
    buildCcrMcpInstallManifestInput({
      template: 'local-stdio',
      name: '',
      command: 'node',
    }),
  /MCP 名称不能为空/,
)
assert.throws(
  () =>
    buildCcrMcpInstallManifestInput({
      template: 'remote-http',
      name: 'bad-headers',
      url: 'https://example.invalid/mcp',
      headersText: 'Authorization',
    }),
  /KEY=value/,
)

console.log('smoke-mcp-manifest-builder: ok')
