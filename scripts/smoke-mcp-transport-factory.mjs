import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const transportFactory = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/mcp/transportFactory.js')).href
)

const {
  createSdkControlClientTransport,
  createStdioClientTransport,
  resolveStdioTransportLaunch,
} = transportFactory

const stdioServer = {
  type: 'stdio',
  command: 'node',
  args: ['server.js', '--debug'],
  env: { MCP_TOKEN: 'token-1' },
}

assert.deepEqual(
  resolveStdioTransportLaunch(stdioServer, {
    shellPrefix: '',
    baseEnv: { PATH: 'base-path', MCP_TOKEN: 'base-token' },
  }),
  {
    command: 'node',
    args: ['server.js', '--debug'],
    env: { PATH: 'base-path', MCP_TOKEN: 'token-1' },
    stderr: 'pipe',
  },
)

assert.deepEqual(
  resolveStdioTransportLaunch(stdioServer, {
    shellPrefix: 'cmd /c',
    baseEnv: { PATH: 'base-path' },
  }),
  {
    command: 'cmd /c',
    args: ['node server.js --debug'],
    env: { PATH: 'base-path', MCP_TOKEN: 'token-1' },
    stderr: 'pipe',
  },
)

const transport = createStdioClientTransport(stdioServer)
assert.equal(typeof transport.start, 'function')
assert.equal(typeof transport.close, 'function')

const sdkTransport = createSdkControlClientTransport('sdk-server', async message => message)
assert.equal(typeof sdkTransport.start, 'function')
assert.equal(typeof sdkTransport.send, 'function')
assert.equal(typeof sdkTransport.close, 'function')

console.log('smoke-mcp-transport-factory: ok')
