import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-productization-fixtures-'))
const workspace = join(root, 'workspace')
const home = join(root, 'home')
const marketplaceRoot = join(root, 'marketplace')
const installedRoot = join(home, 'plugins', 'cache', 'local')

await Promise.all([
  mkdir(workspace, { recursive: true }),
  mkdir(join(home, 'plugins'), { recursive: true }),
  mkdir(join(marketplaceRoot, '.claude-plugin'), { recursive: true }),
])

const foundationInstalled = join(installedRoot, 'foundation', '1.0.0')
const workflowInstalled = join(installedRoot, 'workflow-suite', '1.0.0')
const workflowRollback = join(installedRoot, 'workflow-suite', '0.9.0')
const disabledInstalled = join(installedRoot, 'release-auditor', '1.1.0')

await writePluginPackage(foundationInstalled, {
  name: 'foundation',
  version: '1.0.0',
  description: '为其他 Plugin 提供共享工具与基础配置。',
  author: { name: 'CCR Fixtures' },
})
await writePluginPackage(workflowInstalled, workflowManifest('1.0.0'))
await writePluginPackage(workflowRollback, workflowManifest('0.9.0'))
await writePluginPackage(disabledInstalled, {
  name: 'release-auditor',
  version: '1.1.0',
  description: '检查版本、变更日志和发布前门禁。',
  author: { name: 'CCR Fixtures' },
  skills: './skills',
})

await writePluginPackage(
  join(marketplaceRoot, 'packages', 'foundation'),
  {
    name: 'foundation',
    version: '1.0.0',
    description: '为其他 Plugin 提供共享工具与基础配置。',
    author: { name: 'CCR Fixtures' },
  },
)
await writePluginPackage(
  join(marketplaceRoot, 'packages', 'workflow-suite'),
  workflowManifest('2.0.0'),
)
await writePluginPackage(
  join(marketplaceRoot, 'packages', 'release-auditor'),
  {
    name: 'release-auditor',
    version: '1.1.0',
    description: '检查版本、变更日志和发布前门禁。',
    author: { name: 'CCR Fixtures' },
    skills: './skills',
  },
)
await writePluginPackage(
  join(marketplaceRoot, 'packages', 'data-inspector'),
  {
    name: 'data-inspector',
    version: '1.0.0',
    description: '浏览结构化数据并生成诊断摘要。',
    author: { name: 'CCR Fixtures' },
    mcpServers: {
      inspector: {
        type: 'stdio',
        command: process.execPath,
        args: ['--version'],
      },
    },
  },
)

await writeJson(join(marketplaceRoot, '.claude-plugin', 'marketplace.json'), {
  name: 'local',
  owner: { name: 'CCR Fixtures' },
  plugins: [
    marketplaceEntry('foundation', '1.0.0'),
    marketplaceEntry('workflow-suite', '2.0.0', ['foundation']),
    marketplaceEntry('release-auditor', '1.1.0'),
    marketplaceEntry('data-inspector', '1.0.0'),
  ],
})

await writeJson(join(home, 'plugins', 'known_marketplaces.json'), {
  local: {
    source: { source: 'directory', path: marketplaceRoot },
    installLocation: marketplaceRoot,
    lastUpdated: '2026-06-08T00:00:00.000Z',
  },
})

await writeJson(join(home, 'plugins', 'installed_plugins.json'), {
  version: 2,
  plugins: {
    'foundation@local': [
      installation('user', foundationInstalled, '1.0.0'),
    ],
    'workflow-suite@local': [
      installation('user', workflowInstalled, '1.0.0'),
    ],
    'release-auditor@local': [
      installation('user', disabledInstalled, '1.1.0'),
    ],
    'missing-package@local': [
      installation(
        'user',
        join(installedRoot, 'missing-package', '1.0.0'),
        '1.0.0',
      ),
    ],
  },
})

await writeJson(join(home, 'settings.json'), {
  enabledPlugins: {
    'foundation@local': true,
    'workflow-suite@local': true,
    'release-auditor@local': false,
  },
  pluginConfigs: {
    'workflow-suite@local': {
      options: {
        endpoint: 'http://127.0.0.1:4318',
        reviewMode: 'strict',
      },
    },
  },
})

await writeJson(join(home, '.credentials.json'), {
  pluginSecrets: {
    'workflow-suite@local': {
      apiToken: 'fixture-secret',
    },
  },
})

const runtimePath = join(
  home,
  'plugins',
  'runtime',
  `${createHash('sha256').update('app-server').digest('hex').slice(0, 24)}.json`,
)
await writeJson(runtimePath, {
  activations: [
    {
      runtimeInstanceId: 'app-server',
      pluginId: 'foundation@local',
      activeVersion: '1.0.0',
      activationRevision: 'fixture-foundation-active',
      state: 'active',
      components: [
        { component: 'tool:foundation', state: 'active' },
      ],
    },
    {
      runtimeInstanceId: 'app-server',
      pluginId: 'workflow-suite@local',
      activeVersion: '1.0.0',
      activationRevision: 'fixture-workflow-partial',
      state: 'partial',
      components: [
        { component: 'skill:review-follow-up', state: 'active' },
        { component: 'mcp:workflow-tools', state: 'active' },
        {
          component: 'hook:session-start',
          state: 'restart-required',
          diagnostic: 'Hook 需要在新的运行时实例中加载。',
        },
      ],
    },
  ],
  loadedPlugins: [],
})

await writeJson(join(home, 'plugins', 'retention.json'), {
  schemaVersion: 1,
  records: [
    {
      retentionId: 'fixture-workflow-rollback',
      pluginId: 'workflow-suite@local',
      version: '0.9.0',
      packagePath: workflowRollback,
      reason: 'update',
      operationId: 'fixture-operation-update',
      createdAt: '2026-06-08T00:00:00.000Z',
      expiresAt: '2099-06-08T00:00:00.000Z',
    },
  ],
})

console.log(
  JSON.stringify(
    {
      root,
      workspace,
      home,
      marketplaceRoot,
      runtimePath,
    },
    null,
    2,
  ),
)

function workflowManifest(version) {
  return {
    name: 'workflow-suite',
    version,
    description: '聚合代码审查、发布检查和浏览器协作能力。',
    author: { name: 'CCR Fixtures', email: 'fixtures@example.test' },
    homepage: 'https://example.test/workflow-suite',
    repository: 'https://example.test/workflow-suite.git',
    license: 'MIT',
    keywords: ['review', 'release', 'browser'],
    dependencies: ['foundation'],
    skills: './skills',
    commands: './commands',
    outputStyles: './output-styles',
    mcpServers: {
      'workflow-tools': {
        type: 'stdio',
        command: process.execPath,
        args: ['--version'],
      },
    },
    userConfig: {
      endpoint: {
        type: 'string',
        title: '服务地址',
        description: '工作流服务入口。',
        required: true,
      },
      apiToken: {
        type: 'string',
        title: '访问令牌',
        description: '访问工作流服务所需的令牌。',
        required: true,
        sensitive: true,
      },
    },
    ccr: {
      ui: { icon: 'blocks', category: 'developer-tools' },
      apps: [
        {
          id: 'github',
          displayName: 'GitHub',
          description: '读取仓库、PR 和检查结果。',
          relation: 'requires',
          skillIds: ['review-follow-up'],
          mcpServerNames: ['workflow-tools'],
        },
        {
          id: 'browser',
          displayName: 'Browser',
          description: '验证本地页面和交互流程。',
          relation: 'suggests',
          toolIds: ['browser_navigate'],
        },
      ],
    },
  }
}

async function writePluginPackage(packageRoot, manifest) {
  await Promise.all([
    mkdir(join(packageRoot, '.claude-plugin'), { recursive: true }),
    mkdir(join(packageRoot, 'skills', 'review-follow-up'), {
      recursive: true,
    }),
    mkdir(join(packageRoot, 'commands'), { recursive: true }),
    mkdir(join(packageRoot, 'output-styles'), { recursive: true }),
  ])
  await writeJson(
    join(packageRoot, '.claude-plugin', 'plugin.json'),
    manifest,
  )
  await writeFile(
    join(packageRoot, 'skills', 'review-follow-up', 'SKILL.md'),
    `---\nname: review-follow-up\ndescription: Review actionable changes after feedback.\n---\n\nReview the requested changes and report the result.\n`,
    'utf8',
  )
  await writeFile(
    join(packageRoot, 'commands', 'review.md'),
    `---\ndescription: Review the current change.\n---\n\nReview the current change and list actionable findings.\n`,
    'utf8',
  )
  await writeFile(
    join(packageRoot, 'output-styles', 'compact.md'),
    '# Compact\n\nUse concise sections and direct findings.\n',
    'utf8',
  )
}

function marketplaceEntry(name, version, dependencies = []) {
  return {
    name,
    version,
    source: `./packages/${name}`,
    ...(dependencies.length > 0 ? { dependencies } : {}),
  }
}

function installation(scope, installPath, version) {
  return {
    scope,
    installPath,
    version,
    installedAt: '2026-06-08T00:00:00.000Z',
    lastUpdated: '2026-06-08T00:00:00.000Z',
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
