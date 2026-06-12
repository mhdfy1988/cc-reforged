import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-domain-'))
const homeA = join(root, 'home-a')
const homeB = join(root, 'home-b')
const workspaceA = join(root, 'workspace-a')
const workspaceB = join(root, 'workspace-b')
const packageA = join(homeA, 'plugins', 'cache', 'market-a', 'shared', '1.0.0')
const packageB = join(homeB, 'plugins', 'cache', 'market-b', 'other', '2.0.0')
const projectPackageA = join(
  homeA,
  'plugins',
  'cache',
  'market-a',
  'project-only',
  '1.0.0',
)
const projectPackageB = join(
  homeA,
  'plugins',
  'cache',
  'market-a',
  'project-only',
  '2.0.0',
)

try {
  await Promise.all([
    writePluginPackage(packageA, 'shared', '1.0.0'),
    writePluginPackage(packageB, 'other', '2.0.0'),
    writePluginPackage(projectPackageA, 'project-only', '1.0.0'),
    writePluginPackage(projectPackageB, 'project-only', '2.0.0'),
    mkdir(join(homeA, 'plugins'), { recursive: true }),
    mkdir(join(homeB, 'plugins'), { recursive: true }),
    mkdir(join(workspaceA, '.ccr'), { recursive: true }),
    mkdir(join(workspaceB, '.ccr'), { recursive: true }),
  ])
  await Promise.all([
    writeJson(join(homeA, 'settings.json'), {
      enabledPlugins: {
        'shared@market-a': true,
        'same@one': false,
        'same@two': true,
        'missing@market-a': true,
      },
    }),
    writeJson(join(homeB, 'settings.json'), {
      enabledPlugins: { 'other@market-b': true },
    }),
    writeJson(join(workspaceA, '.ccr', 'settings.json'), {
      enabledPlugins: { 'project-only@market-a': true },
    }),
    writeJson(join(workspaceB, '.ccr', 'settings.json'), {
      enabledPlugins: { 'project-only@market-a': false },
    }),
    writeRegistry(homeA, {
      'shared@market-a': [
        installation('user', packageA, '1.0.0'),
      ],
      'project-only@market-a': [
        installation('project', projectPackageA, '1.0.0', workspaceA),
        installation('project', projectPackageB, '2.0.0', workspaceB),
      ],
      'same@one': [
        installation('user', packageA, '1.0.0'),
      ],
      'same@two': [
        installation('user', packageA, '1.0.0'),
      ],
      'missing@market-a': [
        installation(
          'user',
          join(homeA, 'plugins', 'cache', 'missing'),
          '1.0.0',
        ),
      ],
    }),
    writeRegistry(homeB, {
      'other@market-b': [
        installation('user', packageB, '2.0.0'),
      ],
    }),
  ])

  const { enableConfigs } = await importDist('src/utils/config.js')
  enableConfigs()
  const { createPluginDomainSession } = await importDist(
    'src/services/plugins/pluginDomainSession.js',
  )
  const { PluginInspector } = await importDist(
    'src/services/plugins/pluginInspector.js',
  )
  const { listCoreCapabilities } = await importDist(
    'src/core/capabilityCore.js',
  )
  const inspector = new PluginInspector()
  const sessionA = createPluginDomainSession({
    workspaceRoot: workspaceA,
    currentCwd: workspaceA,
    configHomeDir: homeA,
    runtimeInstanceId: 'runtime-a',
    requestId: 'request-a',
    runtimePlugins: [
      runtimePlugin('builtin-tools@builtin', true),
      runtimePlugin('inline-dev@inline', false),
    ],
  })
  const sessionB = createPluginDomainSession({
    workspaceRoot: workspaceB,
    currentCwd: workspaceB,
    configHomeDir: homeB,
    runtimeInstanceId: 'runtime-b',
    requestId: 'request-b',
  })
  const before = await snapshotFiles([
    join(homeA, 'settings.json'),
    join(homeA, 'plugins', 'installed_plugins.json'),
    join(workspaceA, '.ccr', 'settings.json'),
  ])
  const catalogA = await inspector.listCatalog(sessionA)
  const catalogB = await inspector.listCatalog(sessionB)
  const after = await snapshotFiles([...before.keys()])

  assert.deepEqual(after, before, 'Plugin inspector must not mutate source files')
  assert.equal(catalogA.context.configHomeDir, homeA)
  assert.equal(catalogB.context.configHomeDir, homeB)
  assert.equal(catalogA.plugins.some(item => item.pluginId === 'shared@market-a'), true)
  assert.equal(catalogA.plugins.some(item => item.pluginId === 'other@market-b'), false)
  assert.equal(catalogB.plugins.some(item => item.pluginId === 'other@market-b'), true)
  assert.equal(catalogB.plugins.some(item => item.pluginId === 'shared@market-a'), false)

  const projectA = byId(catalogA, 'project-only@market-a')
  assert.equal(projectA.effectiveSelection.installed, true)
  assert.equal(projectA.effectiveSelection.enabled, true)
  assert.equal(
    projectA.installations.find(item => item.installedVersion === '1.0.0')
      .applicableToRequest,
    true,
  )
  assert.equal(
    projectA.installations.find(item => item.installedVersion === '2.0.0')
      .applicableToRequest,
    false,
  )

  const sessionWorkspaceB = createPluginDomainSession({
    workspaceRoot: workspaceB,
    currentCwd: workspaceB,
    configHomeDir: homeA,
    runtimeInstanceId: 'runtime-a',
    requestId: 'request-workspace-b',
  })
  const catalogWorkspaceB = await inspector.listCatalog(sessionWorkspaceB)
  const projectB = byId(catalogWorkspaceB, 'project-only@market-a')
  assert.equal(projectB.effectiveSelection.installed, true)
  assert.equal(projectB.effectiveSelection.enabled, false)
  assert.equal(projectB.effectiveSelection.installationKey.includes('2.0.0'), true)

  assert.equal(byId(catalogA, 'same@one').pluginId, 'same@one')
  assert.equal(byId(catalogA, 'same@two').pluginId, 'same@two')
  assert.equal(byId(catalogA, 'builtin-tools@builtin').derivedState.active, true)
  assert.equal(
    byId(catalogA, 'builtin-tools@builtin').candidates[0].sourceKind,
    'builtin',
  )
  assert.equal(byId(catalogA, 'inline-dev@inline').derivedState.active, true)
  assert.equal(
    byId(catalogA, 'inline-dev@inline').candidates[0].sourceKind,
    'inline',
  )

  const missing = byId(catalogA, 'missing@market-a')
  assert.equal(missing.derivedState.status, 'missing')
  assert.equal(
    missing.diagnostics.some(
      diagnostic => diagnostic.code === 'plugin-package-missing',
    ),
    true,
  )

  await writeRegistry(homeA, {})
  const stableCatalog = await inspector.listCatalog(sessionA)
  assert.equal(
    stableCatalog.plugins.some(item => item.pluginId === 'shared@market-a'),
    true,
    'one request-scoped session must keep its own registry snapshot',
  )
  const freshCatalog = await inspector.listCatalog(
    createPluginDomainSession({
      workspaceRoot: workspaceA,
      configHomeDir: homeA,
      runtimeInstanceId: 'runtime-a',
      requestId: 'request-fresh',
    }),
  )
  assert.equal(
    byId(freshCatalog, 'shared@market-a').effectiveSelection.installed,
    false,
    'a new request must observe the new registry snapshot',
  )
  const freshCore = await listCoreCapabilities({
    cwd: workspaceA,
    configHomeDir: homeA,
    runtimeInstanceId: 'runtime-fresh',
    mcpRuntime: {
      clients: [],
      tools: [],
      commands: [],
      resources: {},
    },
    mcpConfig: { servers: [], errors: [] },
  })
  assertPluginCapabilityAbsent(
    freshCore,
    'shared@market-a',
    'pure marketplace candidates must stay out of the capability catalog',
  )

  await writeRegistry(homeA, {
    'shared@market-a': [installation('user', packageA, '1.0.0')],
    'missing@market-a': [
      installation(
        'user',
        join(homeA, 'plugins', 'cache', 'missing'),
        '1.0.0',
      ),
    ],
  })
  const sharedRuntime = {
    clients: [],
    tools: [],
    commands: [],
    resources: {},
  }
  const [coreA, coreB] = await Promise.all([
    listCoreCapabilities({
      cwd: workspaceA,
      configHomeDir: homeA,
      runtimeInstanceId: 'runtime-a',
      mcpRuntime: sharedRuntime,
      mcpConfig: { servers: [], errors: [] },
    }),
    listCoreCapabilities({
      cwd: workspaceB,
      configHomeDir: homeB,
      runtimeInstanceId: 'runtime-b',
      mcpRuntime: sharedRuntime,
      mcpConfig: { servers: [], errors: [] },
    }),
  ])
  assertPluginCapabilityIsolation(coreA, 'shared@market-a', 'other@market-b')
  assertPluginCapabilityIsolation(coreB, 'other@market-b', 'shared@market-a')
  assert.equal(
    coreA.capabilities.some(capability => capability.id === 'plugin:catalog-errors'),
    false,
    'plugin failures must remain attached to concrete plugin records',
  )
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-plugin-domain-session: ok')

async function writePluginPackage(packagePath, name, version) {
  await mkdir(join(packagePath, '.claude-plugin'), { recursive: true })
  await writeJson(join(packagePath, '.claude-plugin', 'plugin.json'), {
    name,
    version,
    description: `${name} test plugin`,
  })
}

async function writeRegistry(home, plugins) {
  await mkdir(join(home, 'plugins'), { recursive: true })
  await writeJson(join(home, 'plugins', 'installed_plugins.json'), {
    version: 2,
    plugins,
  })
}

function installation(scope, installPath, version, projectPath) {
  return {
    scope,
    installPath,
    version,
    installedAt: '2026-06-08T00:00:00.000Z',
    ...(projectPath ? { projectPath } : {}),
  }
}

function runtimePlugin(source, isBuiltin) {
  const name = source.slice(0, source.lastIndexOf('@'))
  return {
    name,
    manifest: {
      name,
      version: '1.0.0',
      description: `${name} runtime plugin`,
    },
    path: isBuiltin ? 'builtin' : join(root, name),
    source,
    repository: source,
    enabled: true,
    ...(isBuiltin ? { isBuiltin: true } : {}),
  }
}

async function writeJson(filePath, value) {
  await mkdir(join(filePath, '..'), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function snapshotFiles(paths) {
  const entries = await Promise.all(
    paths.map(async filePath => [
      filePath,
      createHash('sha256')
        .update(await readFile(filePath))
        .digest('hex'),
    ]),
  )
  return new Map(entries)
}

function byId(catalog, pluginId) {
  const record = catalog.plugins.find(item => item.pluginId === pluginId)
  assert.ok(record, `expected plugin record ${pluginId}`)
  return record
}

function assertPluginCapabilityIsolation(catalog, included, excluded) {
  const pluginIds = new Set(
    catalog.capabilities
      .filter(capability => capability.kind === 'plugin')
      .map(capability => capability.source.pluginId),
  )
  assert.equal(pluginIds.has(included), true, `expected ${included}`)
  assert.equal(pluginIds.has(excluded), false, `did not expect ${excluded}`)
}

function assertPluginCapabilityAbsent(catalog, excluded, message) {
  const pluginIds = new Set(
    catalog.capabilities
      .filter(capability => capability.kind === 'plugin')
      .map(capability => capability.source.pluginId),
  )
  assert.equal(pluginIds.has(excluded), false, message)
}
