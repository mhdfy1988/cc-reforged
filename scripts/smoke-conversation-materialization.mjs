import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.CLAUDE_CODE_SIMPLE = '1'

const tempRoot = await mkdtemp(join(tmpdir(), 'ccr-conversation-materialization-'))
let timestampTick = 0

try {
  const {
    materializeConversationFromLoadedTranscript,
    materializeConversationFromTranscript,
  } = await import('../dist/src/utils/conversationMaterialization.js')
  const { loadMessagesFromJsonlPath } = await import(
    '../dist/src/utils/conversationRecovery.js'
  )

  await testOrdinaryRecovery(materializeConversationFromTranscript)
  await testOrdinaryCompact(materializeConversationFromTranscript)
  await testCompactFollowersRemainInCurrentContext(
    materializeConversationFromTranscript,
  )
  await testLargeOrdinaryCompact(materializeConversationFromTranscript)
  await testLivePreservedSegment(materializeConversationFromTranscript)
  await testStalePreservedSegment(materializeConversationFromLoadedTranscript)
  await testMalformedPreservedSegment(materializeConversationFromTranscript)
  await testOrderedRawIndexAndMalformedLine(materializeConversationFromTranscript)
  await testClassifiedTranscriptEvents(materializeConversationFromLoadedTranscript)
  await testParallelToolSiblingResultsRemainInCurrentContext(
    materializeConversationFromLoadedTranscript,
  )
  await testCompactWithParallelToolSiblingResults(
    materializeConversationFromLoadedTranscript,
  )
  await testMaterializationFailureKeepsDiagnosticError(
    materializeConversationFromTranscript,
    loadMessagesFromJsonlPath,
  )
  await testSnipRemoval(materializeConversationFromTranscript)
  await testSidechainIgnoredAsMainLeaf(materializeConversationFromTranscript)
  await testSidechainChildDoesNotHideMainLeaf(materializeConversationFromTranscript)
  await testTerminalSystemChildUsesNearestMainLeaf(materializeConversationFromTranscript)
  await testMultipleMainLeavesDoNotBlockTailResolution(
    materializeConversationFromTranscript,
  )

  console.log('smoke-conversation-materialization: ok')
} finally {
  await rm(tempRoot, { recursive: true, force: true })
}

async function testOrdinaryRecovery(materialize) {
  const sessionId = randomUUID()
  const firstUser = userEntry(sessionId, null, 'ordinary recovery user')
  const assistant = assistantEntry(
    sessionId,
    firstUser.uuid,
    'ordinary recovery assistant',
  )
  const secondUser = userEntry(
    sessionId,
    assistant.uuid,
    'ordinary recovery tail user',
  )

  const result = await materialize(
    await writeTranscript('ordinary-recovery', [
      firstUser,
      assistant,
      secondUser,
    ]),
  )

  assert.equal(result.status, 'ok')
  assert.equal(result.currentContextTailUuid, secondUser.uuid)
  assertMessageText(result, 'ordinary recovery user')
  assertMessageText(result, 'ordinary recovery assistant')
  assertMessageText(result, 'ordinary recovery tail user')
  assertDisplayText(result, 'ordinary recovery user')
  assertDisplayText(result, 'ordinary recovery assistant')
  assertDisplayText(result, 'ordinary recovery tail user')
}

async function testOrdinaryCompact(materialize) {
  const sessionId = randomUUID()
  const beforeUser = userEntry(sessionId, null, 'old user before compact')
  const beforeAssistant = assistantEntry(
    sessionId,
    beforeUser.uuid,
    'old assistant before compact',
  )
  const boundary = compactBoundaryEntry(sessionId, beforeAssistant.uuid)
  const afterUser = userEntry(sessionId, boundary.uuid, 'new user after compact')

  const result = await materialize(
    await writeTranscript('ordinary-compact', [
      beforeUser,
      beforeAssistant,
      boundary,
      afterUser,
    ]),
  )

  assert.equal(result.status, 'ok')
  assertMessageText(result, 'new user after compact')
  assertNoMessageText(result, 'old user before compact')
  assertNoMessageText(result, 'old assistant before compact')
  assertDisplayText(result, 'old user before compact')
  assertDisplayText(result, 'old assistant before compact')
  assertDisplayText(result, 'new user after compact')
  assertDiagnostic(result, 'compact_boundary_pruned_without_preserved_segment')
}

async function testCompactFollowersRemainInCurrentContext(materialize) {
  const sessionId = randomUUID()
  const beforeUser = userEntry(sessionId, null, 'compact follower old user')
  const beforeAssistant = assistantEntry(
    sessionId,
    beforeUser.uuid,
    'compact follower old assistant',
  )
  const boundary = compactBoundaryEntry(sessionId, beforeAssistant.uuid)
  const summary = userEntry(
    sessionId,
    boundary.uuid,
    'compact follower summary',
  )
  summary.isCompactSummary = true
  summary.isVisibleInTranscriptOnly = true
  const attachment = attachmentEntry(
    sessionId,
    summary.uuid,
    'compact-follower.txt',
  )
  const hookSystem = systemEntry(
    sessionId,
    attachment.uuid,
    'hook_additional_context',
  )

  const result = await materialize(
    await writeTranscript('compact-followers', [
      beforeUser,
      beforeAssistant,
      boundary,
      summary,
      attachment,
      hookSystem,
    ]),
  )

  assert.equal(result.status, 'ok')
  assert.deepEqual(
    result.messages.map(message => message.type),
    ['system', 'user', 'attachment', 'system'],
  )
  assertMessageText(result, 'compact follower summary')
  assertNoMessageText(result, 'compact follower old user')
  assertMessageType(result.messages, 'attachment')
  assertMessageSubtype(result.messages, 'hook_additional_context')
  assertDiagnostic(result, 'current_context_followers_appended')
}

async function testLargeOrdinaryCompact(materialize) {
  const sessionId = randomUUID()
  const beforeUser = userEntry(sessionId, null, 'large old user')
  const beforeAssistant = assistantEntry(
    sessionId,
    beforeUser.uuid,
    `large old assistant ${'x'.repeat(6 * 1024 * 1024)}`,
  )
  const boundary = compactBoundaryEntry(sessionId, beforeAssistant.uuid)
  const afterUser = userEntry(sessionId, boundary.uuid, 'large after compact')

  const result = await materialize(
    await writeTranscript('large-ordinary-compact', [
      beforeUser,
      beforeAssistant,
      boundary,
      afterUser,
    ]),
  )

  assert.equal(result.status, 'ok')
  assertMessageText(result, 'large after compact')
  assertNoMessageText(result, 'large old user')
  assertNoMessageText(result, 'large old assistant')
  assertDisplayText(result, 'large old user')
  assertDisplayText(result, 'large old assistant')
  assertDisplayText(result, 'large after compact')
}

async function testLivePreservedSegment(materialize) {
  const sessionId = randomUUID()
  const preservedHead = userEntry(sessionId, null, 'preserved user')
  const preservedTail = assistantEntry(
    sessionId,
    preservedHead.uuid,
    'preserved assistant',
  )
  const boundary = compactBoundaryEntry(sessionId, preservedTail.uuid, {
    preservedSegment: {
      headUuid: preservedHead.uuid,
      tailUuid: preservedTail.uuid,
      anchorUuid: undefined,
    },
  })
  boundary.compactMetadata.preservedSegment.anchorUuid = boundary.uuid
  const afterUser = userEntry(sessionId, boundary.uuid, 'after live segment')

  const result = await materialize(
    await writeTranscript('live-segment', [
      preservedHead,
      preservedTail,
      boundary,
      afterUser,
    ]),
  )

  assert.equal(result.status, 'ok')
  assertMessageText(result, 'preserved user')
  assertMessageText(result, 'preserved assistant')
  assertMessageText(result, 'after live segment')
}

function testStalePreservedSegment(materializeLoaded) {
  const sessionId = randomUUID()
  const preservedHead = userEntry(sessionId, null, 'stale preserved user')
  const preservedTail = assistantEntry(
    sessionId,
    preservedHead.uuid,
    'stale preserved assistant',
  )
  const staleBoundary = compactBoundaryEntry(sessionId, preservedTail.uuid, {
    preservedSegment: {
      headUuid: preservedHead.uuid,
      tailUuid: preservedTail.uuid,
      anchorUuid: undefined,
    },
  })
  staleBoundary.compactMetadata.preservedSegment.anchorUuid = staleBoundary.uuid
  const interimUser = userEntry(sessionId, staleBoundary.uuid, 'interim user')
  const latestBoundary = compactBoundaryEntry(sessionId, interimUser.uuid)
  const afterUser = userEntry(sessionId, latestBoundary.uuid, 'after stale segment')

  const result = materializeLoaded(
    loadedTranscript([
      preservedHead,
      preservedTail,
      staleBoundary,
      interimUser,
      latestBoundary,
      afterUser,
    ]),
  )

  assert.equal(result.status, 'ok')
  assertMessageText(result, 'after stale segment')
  assertNoMessageText(result, 'stale preserved user')
  assertNoMessageText(result, 'stale preserved assistant')
  assertNoMessageText(result, 'interim user')
  assertDiagnostic(result, 'compact_preserved_segment_stale')
}

async function testMalformedPreservedSegment(materialize) {
  const sessionId = randomUUID()
  const beforeUser = userEntry(sessionId, null, 'malformed old user')
  const beforeAssistant = assistantEntry(
    sessionId,
    beforeUser.uuid,
    'malformed old assistant',
  )
  const boundary = compactBoundaryEntry(sessionId, beforeAssistant.uuid, {
    preservedSegment: {
      headUuid: beforeUser.uuid,
      tailUuid: randomUUID(),
      anchorUuid: undefined,
    },
  })
  boundary.compactMetadata.preservedSegment.anchorUuid = boundary.uuid
  const afterUser = userEntry(sessionId, boundary.uuid, 'after malformed segment')

  const result = await materialize(
    await writeTranscript('malformed-segment', [
      beforeUser,
      beforeAssistant,
      boundary,
      afterUser,
    ]),
  )

  assert.equal(result.status, 'ok')
  assertMessageText(result, 'after malformed segment')
  assertNoMessageText(result, 'malformed old user')
  assertNoMessageText(result, 'malformed old assistant')
  assertDiagnostic(result, 'compact_preserved_segment_malformed')
}

async function testOrderedRawIndexAndMalformedLine(materialize) {
  const sessionId = randomUUID()
  const beforeUser = userEntry(sessionId, null, 'raw index old user')
  const beforeAssistant = assistantEntry(
    sessionId,
    beforeUser.uuid,
    'raw index old assistant',
  )
  const boundary = compactBoundaryEntry(sessionId, beforeAssistant.uuid)
  const afterUser = userEntry(sessionId, boundary.uuid, 'raw index after compact')

  const result = await materialize(
    await writeRawTranscript('ordered-raw-index-malformed', [
      JSON.stringify(beforeUser),
      '{ bad json',
      JSON.stringify(beforeAssistant),
      JSON.stringify(boundary),
      JSON.stringify(afterUser),
    ]),
  )

  assert.equal(result.status, 'ok')
  assert.equal(result.rawTranscriptEvents, 4)
  assertMessageText(result, 'raw index after compact')
  assertNoMessageText(result, 'raw index old user')
  assertDisplayText(result, 'raw index old user')
  assertDisplayText(result, 'raw index old assistant')
  assertDisplayText(result, 'raw index after compact')
  const malformed = assertDiagnostic(result, 'malformed_jsonl_lines_skipped')
  assert.deepEqual(malformed.details.rawIndexes, [1])
  const compact = assertDiagnostic(
    result,
    'compact_boundary_pruned_without_preserved_segment',
  )
  assert.equal(compact.details.boundaryRawIndex, 3)
}

async function testClassifiedTranscriptEvents(materialize) {
  const sessionId = randomUUID()
  const root = userEntry(sessionId, null, 'classifier root user')
  const toolUse = assistantToolUseEntry(
    sessionId,
    root.uuid,
    'tool-classifier-1',
  )
  const toolResult = toolResultEntry(
    sessionId,
    toolUse.uuid,
    'tool-classifier-1',
    toolUse.uuid,
  )
  const assistantAfterTool = assistantEntry(
    sessionId,
    toolResult.uuid,
    'classifier assistant after tool',
  )
  const boundary = compactBoundaryEntry(sessionId, assistantAfterTool.uuid)
  const afterCompact = userEntry(
    sessionId,
    boundary.uuid,
    'classifier after compact',
  )
  const sidechain = userEntry(
    sessionId,
    afterCompact.uuid,
    'classifier sidechain',
    true,
  )

  const result = materialize(
    loadedTranscript([
      root,
      toolUse,
      toolResult,
      assistantAfterTool,
      boundary,
      afterCompact,
      sidechain,
    ]),
  )

  assert.equal(result.status, 'ok')
  assert.equal(result.currentContextTailUuid, afterCompact.uuid)
  assert.equal(result.currentContextTailEvent.kind, 'user_input')
  assertClassifiedEvent(result, {
    kind: 'user_input',
    uuid: root.uuid,
    advancesMainTail: true,
  })
  assertClassifiedEvent(result, {
    kind: 'assistant_response',
    uuid: toolUse.uuid,
    advancesMainTail: true,
  })
  assertClassifiedEvent(result, {
    kind: 'tool_use',
    uuid: toolUse.uuid,
    toolUseId: 'tool-classifier-1',
    contentIndex: 0,
    advancesMainTail: false,
  })
  assertClassifiedEvent(result, {
    kind: 'tool_result',
    uuid: toolResult.uuid,
    toolUseId: 'tool-classifier-1',
    contentIndex: 0,
    sourceToolAssistantUUID: toolUse.uuid,
    advancesMainTail: false,
  })
  assert(
    result.classifiedTranscriptEvents.every(
      event => event.uuid !== toolResult.uuid || event.kind !== 'user_input',
    ),
    'tool_result-only user message must not be classified as user_input',
  )
  assertClassifiedEvent(result, {
    kind: 'compact_boundary',
    uuid: boundary.uuid,
    advancesMainTail: false,
  })
  assertClassifiedEvent(result, {
    kind: 'sidechain',
    uuid: sidechain.uuid,
    advancesMainTail: false,
  })
  const classified = assertDiagnostic(result, 'transcript_events_classified')
  assert.equal(classified.details.count, result.classifiedTranscriptEvents.length)
  assert(classified.details.counts.tool_result >= 1)
}

function testParallelToolSiblingResultsRemainInCurrentContext(materialize) {
  const sessionId = randomUUID()
  const root = userEntry(sessionId, null, 'parallel tool root')
  const assistantMessageId = randomUUID()
  const toolUseA = assistantToolUseEntry(
    sessionId,
    root.uuid,
    'parallel-tool-a',
  )
  toolUseA.message.id = assistantMessageId
  const toolUseB = assistantToolUseEntry(
    sessionId,
    root.uuid,
    'parallel-tool-b',
  )
  toolUseB.message.id = assistantMessageId
  const toolResultB = toolResultEntry(
    sessionId,
    toolUseB.uuid,
    'parallel-tool-b',
    toolUseB.uuid,
  )
  const toolResultA = toolResultEntry(
    sessionId,
    toolUseA.uuid,
    'parallel-tool-a',
    toolUseA.uuid,
  )
  const finalAssistant = assistantEntry(
    sessionId,
    toolResultA.uuid,
    'parallel tool final assistant',
  )

  const result = materialize(
    loadedTranscript([
      root,
      toolUseA,
      toolUseB,
      toolResultB,
      toolResultA,
      finalAssistant,
    ]),
  )

  assert.equal(result.status, 'ok')
  assert.equal(result.currentContextTailUuid, finalAssistant.uuid)
  assertNoDiagnostic(result, 'multiple_main_leaves')
  assertContentBlock(result.currentContextMessages, 'tool_use', {
    id: 'parallel-tool-a',
  })
  assertContentBlock(result.currentContextMessages, 'tool_use', {
    id: 'parallel-tool-b',
  })
  assertContentBlock(result.currentContextMessages, 'tool_result', {
    tool_use_id: 'parallel-tool-a',
  })
  assertContentBlock(result.currentContextMessages, 'tool_result', {
    tool_use_id: 'parallel-tool-b',
  })
}

function testCompactWithParallelToolSiblingResults(materialize) {
  const sessionId = randomUUID()
  const root = userEntry(sessionId, null, 'compact parallel root')
  const assistantMessageId = randomUUID()
  const toolUseA = assistantToolUseEntry(
    sessionId,
    root.uuid,
    'compact-parallel-tool-a',
  )
  toolUseA.message.id = assistantMessageId
  const toolUseB = assistantToolUseEntry(
    sessionId,
    root.uuid,
    'compact-parallel-tool-b',
  )
  toolUseB.message.id = assistantMessageId
  const toolResultB = toolResultEntry(
    sessionId,
    toolUseB.uuid,
    'compact-parallel-tool-b',
    toolUseB.uuid,
  )
  const toolResultA = toolResultEntry(
    sessionId,
    toolUseA.uuid,
    'compact-parallel-tool-a',
    toolUseA.uuid,
  )
  const boundary = compactBoundaryEntry(sessionId, toolResultA.uuid)
  const afterCompact = userEntry(
    sessionId,
    boundary.uuid,
    'compact parallel after compact',
  )

  const result = materialize(
    loadedTranscript([
      root,
      toolUseA,
      toolUseB,
      toolResultB,
      toolResultA,
      boundary,
      afterCompact,
    ]),
  )

  assert.equal(result.status, 'ok')
  assert.equal(result.currentContextTailUuid, afterCompact.uuid)
  assertMessageText(result, 'compact parallel after compact')
  assertNoMessageText(result, 'compact parallel root')
  assertContentBlock(result.displayReplayEvents, 'tool_use', {
    id: 'compact-parallel-tool-a',
  })
  assertContentBlock(result.displayReplayEvents, 'tool_use', {
    id: 'compact-parallel-tool-b',
  })
  assertContentBlock(result.displayReplayEvents, 'tool_result', {
    tool_use_id: 'compact-parallel-tool-a',
  })
  assertContentBlock(result.displayReplayEvents, 'tool_result', {
    tool_use_id: 'compact-parallel-tool-b',
  })
  assertDiagnostic(result, 'compact_boundary_pruned_without_preserved_segment')
}

async function testMaterializationFailureKeepsDiagnosticError(
  materialize,
  loadMessages,
) {
  const sessionId = randomUUID()
  const orphanToolResult = toolResultEntry(
    sessionId,
    randomUUID(),
    'orphan-tail-tool',
    randomUUID(),
  )
  const filePath = await writeTranscript('materialization-failure-diagnostic', [
    orphanToolResult,
  ])

  const result = await materialize(filePath)
  assert.equal(result.status, 'error')
  assertDiagnostic(result, 'no_current_context_tail')
  await assert.rejects(
    () => loadMessages(filePath),
    error => {
      assert.match(error.message, /History transcript materialization failed/)
      assert.match(error.message, /no_current_context_tail/)
      assert.doesNotMatch(error.message, /Session transcript not found/)
      return true
    },
  )
}

async function testSnipRemoval(materialize) {
  const sessionId = randomUUID()
  const root = userEntry(sessionId, null, 'snip root')
  const before = assistantEntry(sessionId, root.uuid, 'snip before')
  const removed = userEntry(sessionId, before.uuid, 'snipped middle user')
  const after = assistantEntry(sessionId, removed.uuid, 'snip after')
  const snipMarker = systemEntry(sessionId, null, 'snip_marker')
  snipMarker.snipMetadata = { removedUuids: [removed.uuid] }

  const result = await materialize(
    await writeTranscript('snip-removal', [
      root,
      before,
      removed,
      after,
      snipMarker,
    ]),
  )

  assert.equal(result.status, 'ok')
  assertMessageText(result, 'snip root')
  assertMessageText(result, 'snip before')
  assertMessageText(result, 'snip after')
  assertNoMessageText(result, 'snipped middle user')
}

async function testSidechainIgnoredAsMainLeaf(materialize) {
  const sessionId = randomUUID()
  const root = userEntry(sessionId, null, 'main user')
  const assistant = assistantEntry(sessionId, root.uuid, 'main assistant')
  const sidechain = userEntry(sessionId, null, 'sidechain user', true)

  const result = await materialize(
    await writeTranscript('sidechain', [root, assistant, sidechain]),
  )

  assert.equal(result.status, 'ok')
  assertMessageText(result, 'main user')
  assertMessageText(result, 'main assistant')
  assertNoMessageText(result, 'sidechain user')
}

async function testSidechainChildDoesNotHideMainLeaf(materialize) {
  const sessionId = randomUUID()
  const root = userEntry(sessionId, null, 'main before sidechain child')
  const assistant = assistantEntry(
    sessionId,
    root.uuid,
    'main assistant before sidechain child',
  )
  const sidechain = userEntry(
    sessionId,
    assistant.uuid,
    'sidechain child should not hide main leaf',
    true,
  )

  const result = await materialize(
    await writeTranscript('sidechain-child', [root, assistant, sidechain]),
  )

  assert.equal(result.status, 'ok')
  assertMessageText(result, 'main before sidechain child')
  assertMessageText(result, 'main assistant before sidechain child')
  assertNoMessageText(result, 'sidechain child should not hide main leaf')
}

async function testTerminalSystemChildUsesNearestMainLeaf(materialize) {
  const sessionId = randomUUID()
  const root = userEntry(sessionId, null, 'main before terminal system')
  const assistant = assistantEntry(
    sessionId,
    root.uuid,
    'assistant before terminal system',
  )
  const terminalSystem = systemEntry(
    sessionId,
    assistant.uuid,
    'terminal_status',
  )

  const result = await materialize(
    await writeTranscript('terminal-system-child', [
      root,
      assistant,
      terminalSystem,
    ]),
  )

  assert.equal(result.status, 'ok')
  assertMessageText(result, 'main before terminal system')
  assertMessageText(result, 'assistant before terminal system')
}

async function testMultipleMainLeavesDoNotBlockTailResolution(materialize) {
  const sessionId = randomUUID()
  const first = userEntry(sessionId, null, 'first main leaf')
  const second = userEntry(sessionId, null, 'second main leaf')

  const result = await materialize(
    await writeTranscript('multiple-main-leaves', [first, second]),
  )

  assert.equal(result.status, 'ok')
  assert.equal(result.currentContextTailUuid, second.uuid)
  assert.equal(result.canonicalLeafUuid, second.uuid)
  assert.equal(result.currentContextTailEvent.kind, 'user_input')
  assertMessageText(result, 'second main leaf')
  assertNoDiagnostic(result, 'multiple_main_leaves')
  assertDiagnostic(result, 'legacy_multiple_main_leaves_diagnostic')
}

async function writeTranscript(name, entries) {
  const filePath = join(tempRoot, `${name}.jsonl`)
  const body = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n'
  await writeFile(filePath, body, 'utf8')
  return filePath
}

async function writeRawTranscript(name, lines) {
  const filePath = join(tempRoot, `${name}.jsonl`)
  await writeFile(filePath, `${lines.join('\n')}\n`, 'utf8')
  return filePath
}

function loadedTranscript(entries) {
  return {
    messages: new Map(entries.map(entry => [entry.uuid, entry])),
    summaries: new Map(),
    customTitles: new Map(),
    tags: new Map(),
    agentNames: new Map(),
    agentColors: new Map(),
    agentSettings: new Map(),
    prNumbers: new Map(),
    prUrls: new Map(),
    prRepositories: new Map(),
    modes: new Map(),
    worktreeStates: new Map(),
    fileHistorySnapshots: new Map(),
    attributionSnapshots: new Map(),
    contentReplacements: new Map(),
    agentContentReplacements: new Map(),
    contextCollapseCommits: [],
    contextCollapseSnapshot: undefined,
    leafUuids: new Set(),
  }
}

function userEntry(sessionId, parentUuid, text, isSidechain = false) {
  return {
    type: 'user',
    uuid: randomUUID(),
    parentUuid,
    isSidechain,
    sessionId,
    timestamp: timestamp(),
    cwd: tempRoot,
    version: 'smoke',
    userType: 'external',
    message: {
      role: 'user',
      content: text,
    },
  }
}

function assistantEntry(sessionId, parentUuid, text, isSidechain = false) {
  return {
    type: 'assistant',
    uuid: randomUUID(),
    parentUuid,
    isSidechain,
    sessionId,
    timestamp: timestamp(),
    cwd: tempRoot,
    version: 'smoke',
    userType: 'external',
    message: {
      id: randomUUID(),
      role: 'assistant',
      content: [{ type: 'text', text }],
      usage: {
        input_tokens: 123,
        output_tokens: 5,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  }
}

function assistantToolUseEntry(sessionId, parentUuid, toolUseId) {
  const entry = assistantEntry(sessionId, parentUuid, '', false)
  entry.message.content = [
    {
      type: 'tool_use',
      id: toolUseId,
      name: 'Read',
      input: {
        file_path: join(tempRoot, 'classifier.txt'),
      },
    },
  ]
  return entry
}

function toolResultEntry(
  sessionId,
  parentUuid,
  toolUseId,
  sourceToolAssistantUUID,
) {
  const entry = userEntry(sessionId, parentUuid, '', false)
  entry.sourceToolAssistantUUID = sourceToolAssistantUUID
  entry.message.content = [
    {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: 'classifier tool result',
    },
  ]
  return entry
}

function compactBoundaryEntry(sessionId, parentUuid, compactMetadata = {}) {
  const entry = systemEntry(sessionId, parentUuid, 'compact_boundary')
  entry.compactMetadata = compactMetadata
  return entry
}

function attachmentEntry(sessionId, parentUuid, name) {
  return {
    type: 'attachment',
    uuid: randomUUID(),
    parentUuid,
    isSidechain: false,
    sessionId,
    timestamp: timestamp(),
    cwd: tempRoot,
    version: 'smoke',
    userType: 'external',
    attachment: {
      type: 'hook_additional_context',
      fileName: name,
      content: [`context from ${name}`],
    },
  }
}

function systemEntry(sessionId, parentUuid, subtype) {
  return {
    type: 'system',
    subtype,
    uuid: randomUUID(),
    parentUuid,
    isSidechain: false,
    sessionId,
    timestamp: timestamp(),
    cwd: tempRoot,
    version: 'smoke',
    userType: 'external',
  }
}

function assertMessageText(result, text) {
  assert(
    result.messages.some(message => getText(message).includes(text)),
    `expected materialized messages to include "${text}"`,
  )
}

function assertNoMessageText(result, text) {
  assert(
    result.messages.every(message => !getText(message).includes(text)),
    `expected materialized messages not to include "${text}"`,
  )
}

function assertMessageType(messages, type) {
  assert(
    messages.some(message => message.type === type),
    `expected materialized messages to include type "${type}"`,
  )
}

function assertMessageSubtype(messages, subtype) {
  assert(
    messages.some(message => message.subtype === subtype),
    `expected materialized messages to include subtype "${subtype}"`,
  )
}

function assertDisplayText(result, text) {
  assert(
    result.displayReplayEvents.some(message => getText(message).includes(text)),
    `expected display replay events to include "${text}"`,
  )
}

function assertDiagnostic(result, code) {
  const diagnostic = result.diagnostics.find(diagnostic => diagnostic.code === code)
  assert(
    diagnostic,
    `expected diagnostic ${code}`,
  )
  return diagnostic
}

function assertNoDiagnostic(result, code) {
  assert(
    result.diagnostics.every(diagnostic => diagnostic.code !== code),
    `expected diagnostic ${code} to be absent`,
  )
}

function assertContentBlock(messages, type, expectedFields) {
  const found = messages.some(message =>
    getContentBlocks(message).some(block => {
      if (block.type !== type) return false
      return Object.entries(expectedFields).every(
        ([key, value]) => block[key] === value,
      )
    }),
  )
  assert(
    found,
    `expected content block ${type} ${JSON.stringify(expectedFields)}`,
  )
}

function assertClassifiedEvent(result, expected) {
  const event = result.classifiedTranscriptEvents.find(candidate =>
    Object.entries(expected).every(
      ([key, value]) => candidate[key] === value,
    ),
  )
  assert(
    event,
    `expected classified event ${JSON.stringify(expected)}`,
  )
  return event
}

function getText(message) {
  const content = message.message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map(block => (block && block.type === 'text' ? block.text : ''))
    .join('\n')
}

function getContentBlocks(message) {
  const content = message.message?.content
  return Array.isArray(content)
    ? content.filter(
        block => block !== null && typeof block === 'object' && !Array.isArray(block),
      )
    : []
}

function timestamp() {
  const value = new Date(Date.UTC(2026, 4, 24, 0, 0, timestampTick))
  timestampTick += 1
  return value.toISOString()
}
