import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  enableRuntimeCommandLoading,
  importDist,
  installSkillFromSource,
  writeSourceSkill,
} from './smoke-skill-runtime-helpers.mjs'

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-request-context-'))
const configHomeA = join(root, 'ccr-home-a')
const configHomeB = join(root, 'ccr-home-b')
process.env.CCR_CONFIG_DIR = configHomeA

try {
  const sourceA = await writeSourceSkill(root, 'home-a-helper', {
    description: 'Skill visible only from config home A.',
  })
  const sourceB = await writeSourceSkill(root, 'home-b-helper', {
    description: 'Skill visible only from config home B.',
  })
  await installSkillFromSource({
    name: 'home-a-helper',
    sourceDir: sourceA,
    configHome: configHomeA,
  })
  await installSkillFromSource({
    name: 'home-b-helper',
    sourceDir: sourceB,
    configHome: configHomeB,
  })

  await enableRuntimeCommandLoading()
  const commandsModule = await importDist('src/commands.js')
  const prefetch = await importDist('src/services/skillSearch/prefetch.js')
  const { DiscoverSkillsTool } = await importDist(
    'src/tools/DiscoverSkillsTool/DiscoverSkillsTool.js',
  )
  const { SkillTool } = await importDist('src/tools/SkillTool/SkillTool.js')
  const { createFileStateCacheWithSizeLimit } = await importDist(
    'src/utils/fileStateCache.js',
  )
  const { getDefaultAppState } = await importDist(
    'src/state/AppStateStore.js',
  )

  commandsModule.clearCommandsCache()

  const commandsA = await commandsModule.getSkillToolCommands(root, {
    configHomeDir: configHomeA,
  })
  const commandsB = await commandsModule.getSkillToolCommands(root, {
    configHomeDir: configHomeB,
  })
  assertNameSet(commandsA, ['home-a-helper'], ['home-b-helper'])
  assertNameSet(commandsB, ['home-b-helper'], ['home-a-helper'])

  const contextA = createToolContext({
    cwd: root,
    configHomeDir: configHomeA,
    commands: commandsA,
    createFileStateCacheWithSizeLimit,
    getDefaultAppState,
  })
  const contextB = createToolContext({
    cwd: root,
    configHomeDir: configHomeB,
    commands: commandsB,
    createFileStateCacheWithSizeLimit,
    getDefaultAppState,
  })

  const catalogA = await prefetch.buildRuntimeSkillDiscoveryCatalog(contextA)
  const catalogB = await prefetch.buildRuntimeSkillDiscoveryCatalog(contextB)
  assertNameSet(catalogA.index, ['home-a-helper'], ['home-b-helper'])
  assertNameSet(catalogB.index, ['home-b-helper'], ['home-a-helper'])

  const discoveredA = await DiscoverSkillsTool.call(
    { query: 'Skill visible only from config home A', max_results: 5 },
    contextA,
  )
  assert.equal(
    discoveredA.data.matches.some(match => match.name === 'home-a-helper'),
    true,
  )
  assert.equal(
    contextA.discoveredSkillCapabilityIds.size > 0,
    true,
    'expected DiscoverSkillsTool to record canonical ids',
  )

  assert.equal(
    (await SkillTool.validateInput({ skill: 'home-a-helper' }, contextA))
      .result,
    true,
  )
  assert.equal(
    (await SkillTool.validateInput({ skill: 'home-b-helper' }, contextA))
      .result,
    false,
  )
  assert.equal(
    (await SkillTool.validateInput({ skill: 'home-b-helper' }, contextB))
      .result,
    true,
  )

  const callResult = await SkillTool.call(
    { skill: 'home-a-helper' },
    contextA,
    async () => ({ behavior: 'allow' }),
    createParentMessage(),
  )
  assert.equal(callResult.data.success, true)
  assert.equal(callResult.data.commandName, 'home-a-helper')
  assert.equal(
    contextA.loadedSkillCapabilityIds.size > 0,
    true,
    'expected SkillTool.call to record loaded canonical ids',
  )
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-skill-request-context-e2e: ok')

function assertNameSet(items, included, excluded) {
  const names = new Set(items.map(item => item.name))
  for (const name of included) {
    assert.equal(names.has(name), true, `expected ${name}`)
  }
  for (const name of excluded) {
    assert.equal(names.has(name), false, `did not expect ${name}`)
  }
}

function createToolContext(input) {
  let appState = input.getDefaultAppState()
  return {
    abortController: new AbortController(),
    readFileState: input.createFileStateCacheWithSizeLimit(20),
    visibleSkillNames: new Set(),
    visibleSkillCapabilityIds: new Set(),
    discoveredSkillNames: new Set(),
    discoveredSkillCapabilityIds: new Set(),
    loadedSkillNames: new Set(),
    loadedSkillCapabilityIds: new Set(),
    options: {
      commands: input.commands,
      cwd: input.cwd,
      configHomeDir: input.configHomeDir,
      debug: false,
      mainLoopModel: 'sonnet',
      tools: [],
      verbose: false,
      thinkingConfig: { type: 'disabled' },
      mcpClients: [],
      mcpResources: {},
      isNonInteractiveSession: true,
      agentDefinitions: { activeAgents: [], allAgents: [] },
    },
    messages: [],
    getAppState() {
      return appState
    },
    setAppState(updater) {
      appState = updater(appState)
    },
    setInProgressToolUseIDs() {},
    setResponseLength() {},
    updateFileHistoryState() {},
    updateAttributionState() {},
  }
}

function createParentMessage() {
  return {
    type: 'assistant',
    uuid: '00000000-0000-4000-8000-000000000001',
    message: {
      id: 'msg_smoke_skill_request_context',
      type: 'message',
      role: 'assistant',
      model: 'sonnet',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
      },
    },
  }
}
