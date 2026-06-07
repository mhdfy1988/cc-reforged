import assert from 'node:assert/strict'
import {
  createRuntimeSmokeEnv,
  enableRuntimeCommandLoading,
  importDist,
  installSkillFromSource,
  writeSourceSkill,
} from './smoke-skill-runtime-helpers.mjs'

const env = await createRuntimeSmokeEnv('ccr-skill-turn-zero-discovery-')

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
  const prefetch = await importDist('src/services/skillSearch/prefetch.js')
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

  await assertDiscovery(prefetch, context, '排查这个 UI 与数据不一致的 bug', [
    'bug-debug-helper',
  ])
  const bugCapabilityId = [...context.discoveredSkillCapabilityIds][0]
  assert.ok(bugCapabilityId)
  const duplicateBug = await prefetch.getTurnZeroSkillDiscovery(
    '继续排查这个 UI 与数据不一致的 bug',
    [],
    context,
  )
  assert.equal(
    duplicateBug.length,
    0,
    'expected already discovered skills to be filtered from task discovery',
  )
  await assertDiscovery(prefetch, context, '更新 README 和 goal 文档', [
    'docs-update-helper',
  ])
  await assertDiscovery(prefetch, context, '准备发布版本并检查 changelog', [
    'release-check-helper',
  ])

  const catalog = await prefetch.getTurnZeroSkillDiscovery(
    '我现在有哪些 skill',
    [],
    context,
  )
  assert.deepEqual(
    catalog[0].skills.map(skill => skill.name).sort(),
    ['bug-debug-helper', 'docs-update-helper', 'release-check-helper'],
  )
  assert.equal(context.discoveredSkillCapabilityIds.size > 0, true)

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
  const visibleFiltered = await prefetch.getTurnZeroSkillDiscovery(
    '排查这个 UI 与数据不一致的 bug',
    [],
    visibleContext,
  )
  assert.equal(
    visibleFiltered.length,
    0,
    'expected visible skills to be filtered from task discovery',
  )
} finally {
  await env.cleanup()
}

async function assertDiscovery(prefetch, context, input, expectedNames) {
  const attachments = await prefetch.getTurnZeroSkillDiscovery(input, [], context)
  assert.equal(attachments.length, 1, `expected discovery for ${input}`)
  assert.equal(attachments[0].type, 'skill_discovery')
  assert.equal(
    attachments[0].skills.every(skill =>
      skill.capabilityId.startsWith('skill:'),
    ),
    true,
  )
  for (const expectedName of expectedNames) {
    assert.equal(
      attachments[0].skills.some(skill => skill.name === expectedName),
      true,
      `expected ${expectedName} for ${input}`,
    )
  }
}

console.log('smoke-skill-turn-zero-discovery: ok')
