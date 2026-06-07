import assert from 'node:assert/strict'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const localSearch = await importDist('src/services/skillSearch/localSearch.js')
const planner = await importDist(
  'src/skills/skillContextInjectionPlanner.js',
)

const { createSkillDiscoveryIndex, searchSkillDiscoveryIndex } = localSearch

const commands = [
  promptCommand(
    'bug-debug-helper',
    '排查项目 BUG、回归、报错、UI 与数据不一致、构建或验证异常时使用。适用于先复述现象、确认入口、限定首轮范围、沿调用链回溯、做最小修复并验证。',
  ),
  promptCommand(
    'docs-update-helper',
    '项目功能大改、阶段收口、发布前或用户要求检查文档是否过时时使用。适用于同步 README、CHANGELOG、goal 文档、Skill/MCP 专题文档和架构说明。',
  ),
  promptCommand(
    'release-check-helper',
    '准备项目发布、打包、更新版本、检查 CHANGELOG、运行 release gate 或确认发布前工作区时使用。',
  ),
  promptCommand(
    'frontend-design',
    'Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications.',
    { whenToUse: '前端页面、组件、交互、视觉设计和 UI polish' },
  ),
  promptCommand('model-off-helper', 'Should not be returned.', {
    disableModelInvocation: true,
  }),
  promptCommand('disabled-helper', 'Should not be returned.', {
    isEnabled: () => false,
  }),
]
const plan = planner.planSkillContextInjection(commands, {
  skillSearchEnabled: true,
})
const index = createSkillDiscoveryIndex(plan.discoveryCandidates)

assert.equal(index.some(entry => entry.name === 'model-off-helper'), false)
assert.equal(index.some(entry => entry.name === 'disabled-helper'), false)
assert.equal(
  index.every(entry => entry.capabilityId.startsWith('skill:')),
  true,
)

assertTop('排查这个 UI 和数据不一致的 bug', 'bug-debug-helper')
assertTop('更新一下 README 和 goal 文档', 'docs-update-helper')
assertTop('准备发布版本，检查 changelog', 'release-check-helper')
assertTop('把这个前端页面做得更好看', 'frontend-design')

const noMatch = searchSkillDiscoveryIndex(index, '完全无关的随机短句', {
  minScore: 6,
})
assert.equal(noMatch.length, 0)

function assertTop(query, expectedName) {
  const results = searchSkillDiscoveryIndex(index, query)
  assert.equal(results.length > 0, true, `expected results for ${query}`)
  assert.equal(results[0].entry.name, expectedName)
  assert.equal(typeof results[0].entry.capabilityId, 'string')
  assert.equal(results[0].matchedFields.length > 0, true)
}

function promptCommand(name, description, options = {}) {
  return {
    type: 'prompt',
    name,
    description,
    source: 'userSettings',
    loadedFrom: 'managed',
    contentLength: 0,
    progressMessage: 'running',
    ...options,
    async getPromptForCommand() {
      return []
    },
  }
}

console.log('smoke-skill-discovery-index: ok')
