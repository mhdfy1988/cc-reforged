import assert from 'node:assert/strict'
import {
  createRuntimeSmokeEnv,
  enableRuntimeCommandLoading,
  importDist,
  installSkillFromSource,
  writeSourceSkill,
} from './smoke-skill-runtime-helpers.mjs'

const env = await createRuntimeSmokeEnv('ccr-skill-discover-tool-')

try {
  const specs = [
    {
      name: 'bug-debug-helper',
      description:
        '排查项目 BUG、回归、报错、UI 与数据不一致、构建或验证异常时使用。',
    },
    {
      name: 'docs-update-helper',
      description: '项目功能大改、阶段收口、发布前或用户要求检查文档是否过时时使用。',
    },
    {
      name: 'release-check-helper',
      description: '准备项目发布、打包、更新版本、检查 CHANGELOG、运行 release gate 时使用。',
    },
  ]

  for (const spec of specs) {
    const sourceDir = await writeSourceSkill(env.root, spec.name, {
      description: spec.description,
    })
    await installSkillFromSource({
      ...spec,
      sourceDir,
      configHome: env.configHome,
    })
  }

  await enableRuntimeCommandLoading()
  const commandsModule = await importDist('src/commands.js')
  const { DiscoverSkillsTool } = await importDist(
    'src/tools/DiscoverSkillsTool/DiscoverSkillsTool.js',
  )
  commandsModule.clearCommandsCache()

  const context = {
    options: {
      cwd: env.root,
      configHomeDir: env.configHome,
    },
    discoveredSkillNames: new Set(),
    discoveredSkillCapabilityIds: new Set(),
    getAppState() {
      return { mcp: { commands: [] } }
    },
  }

  const result = await DiscoverSkillsTool.call(
    { query: '排查这个 UI 与数据不一致的 bug', max_results: 3 },
    context,
  )
  assert.equal(
    result.data.matches.some(match => match.name === 'bug-debug-helper'),
    true,
    'expected bug-debug-helper discovery match',
  )
  assert.equal(
    context.discoveredSkillNames.has('bug-debug-helper'),
    true,
    'expected tool to record discovered skill names',
  )
  assert.equal(
    context.discoveredSkillCapabilityIds.size > 0,
    true,
    'expected tool to record discovered capability ids',
  )
  assert.equal(
    result.data.matches.every(match => match.capability_id.startsWith('skill:')),
    true,
  )
  const bugCapabilityId = result.data.matches.find(
    match => match.name === 'bug-debug-helper',
  )?.capability_id
  assert.ok(bugCapabilityId)

  const duplicate = await DiscoverSkillsTool.call(
    { query: '继续排查这个 UI 与数据不一致的 bug', max_results: 3 },
    context,
  )
  assert.equal(
    duplicate.data.matches.some(match => match.name === 'bug-debug-helper'),
    false,
    'expected already discovered skills to be filtered from task discovery',
  )

  const catalog = await DiscoverSkillsTool.call(
    { query: '我现在有哪些 skill', max_results: 10 },
    context,
  )
  assert.deepEqual(
    catalog.data.matches.map(match => match.name).sort(),
    ['bug-debug-helper', 'docs-update-helper', 'release-check-helper'],
  )

  const noMatch = await DiscoverSkillsTool.call(
    { query: 'unrelated quantum task', max_results: 3 },
    context,
  )
  assert.equal(noMatch.data.matches.length, 0)

  const visibleContext = {
    options: {
      cwd: env.root,
      configHomeDir: env.configHome,
    },
    visibleSkillNames: new Set(['bug-debug-helper']),
    visibleSkillCapabilityIds: new Set([bugCapabilityId]),
    discoveredSkillNames: new Set(),
    discoveredSkillCapabilityIds: new Set(),
    getAppState() {
      return { mcp: { commands: [] } }
    },
  }
  const visibleFiltered = await DiscoverSkillsTool.call(
    { query: '排查这个 UI 与数据不一致的 bug', max_results: 3 },
    visibleContext,
  )
  assert.equal(
    visibleFiltered.data.matches.some(match => match.name === 'bug-debug-helper'),
    false,
    'expected visible skills to be filtered from task discovery',
  )
} finally {
  await env.cleanup()
}

console.log('smoke-skill-discover-tool: ok')
