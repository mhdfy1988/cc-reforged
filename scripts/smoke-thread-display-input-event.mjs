import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildThreadDisplaySnapshot,
  coreEventToThreadDisplayPatch,
  createThreadDisplayReducer,
} from '../dist/src/app-server/threadDisplay.js'
import {
  appServerThreadMessagesToDisplayReducerInputEvents,
  assertThreadDisplayReducerInputEvent,
  coreTurnEventToDisplayReducerInputEvent,
  createUnsupportedDisplayReducerInputEvent,
} from '../dist/src/app-server/threadDisplayInputEvent.js'
import { resolveThreadDisplayFacts } from '../dist/src/app-server/threadDisplayFacts.js'
import { projectThreadDisplayItem } from '../dist/src/display/threadDisplayProjection.js'

const threadId = 'thread-input-event-smoke'
const sessionId = 'session-input-event-smoke'
const toolUseId = 'tool-input-event-smoke'

const threadDisplaySource = readFileSync(
  new URL('../src/app-server/threadDisplay.ts', import.meta.url),
  'utf8',
)
const attachmentProjectorSource = readFileSync(
  new URL('../src/display/threadDisplayAttachmentProjector.ts', import.meta.url),
  'utf8',
)
const threadDisplayFactsSource = readFileSync(
  new URL('../src/app-server/threadDisplayFacts.ts', import.meta.url),
  'utf8',
)
const threadDisplayProjectionSource = readFileSync(
  new URL('../src/display/threadDisplayProjection.ts', import.meta.url),
  'utf8',
)
const removedLegacyReducerNames = [
  'snapshotItems',
  'toolItemIndexes',
  'reduceThreadMessagesToDisplayItems',
  'reduceCoreEventDisplayPatchOperations',
  'threadMessagesToDisplayItems',
  'getCoreEventDisplayPatchOperations',
  'reduceThreadDisplayInputEventsToDisplayItems',
  'reduceThreadDisplayInputEventPatchOperations',
  'acceptThreadMessages',
  'acceptCoreEvent',
  'createPatchOperations',
  'applyPatchOperationToState',
  'getStartedToolLifecycleFactPatchOperations',
  'getCompletedToolLifecycleFactPatchOperations',
]
for (const name of removedLegacyReducerNames) {
  assert.equal(
    threadDisplaySource.includes(name),
    false,
    `legacy display reducer entry should not return: ${name}`,
  )
}
const orderedReducerStateMarkers = [
  'orderedItemIds',
  'itemsById',
  'displayIdBySourceIdentity',
  'toolLifecycleByToolUseId',
]
for (const marker of orderedReducerStateMarkers) {
  assert.equal(
    threadDisplaySource.includes(marker),
    true,
    `ordered display reducer state marker should exist: ${marker}`,
  )
}
assert.equal(
  threadDisplaySource.includes('materializeGeneratedOutputImageBlocks'),
  true,
  'generated output path blocks should be materialized before projection',
)
assert.equal(
  threadDisplaySource.includes('resolveThreadDisplayFacts'),
  true,
  'ThreadDisplayReducer should resolve DisplayFact before state transitions',
)
assert.equal(
  threadDisplaySource.includes('acceptRealtimeInputEvent'),
  true,
  'realtime display input should be accepted as reducer state transitions',
)
assert.equal(
  threadDisplaySource.includes('toSnapshot('),
  true,
  'ThreadDisplayReducer should expose snapshot as a state output view',
)
assert.equal(
  threadDisplayFactsSource.includes('export type ThreadDisplayFact'),
  true,
  'DisplayFact union should be explicit and importable',
)
assert.equal(
  threadDisplayProjectionSource.includes('getDisplayFactScopedBlocks'),
  true,
  'projection should prefer reducer-confirmed DisplayFact scoped blocks',
)
assert.equal(
  attachmentProjectorSource.includes('collectGeneratedOutputImagePathBlocks'),
  false,
  'attachment projector must not infer model output attachments from message text',
)

const unconfirmedToolProjection = projectThreadDisplayItem({
  id: 'projector-unconfirmed-tool-block',
  type: 'assistant_message',
  text: '工具前的普通文本',
  status: 'completed',
  identity: {
    threadId,
    turnId: 'turn-projector-purity',
    itemId: 'projector-unconfirmed-tool-block',
  },
  content: [
    { type: 'text', text: '工具前的普通文本' },
    {
      type: 'tool_use',
      id: 'raw-tool-id-should-not-be-claimed',
      name: 'Read',
      input: { file_path: 'package.json' },
    },
  ],
})
assert.equal(
  unconfirmedToolProjection?.event?.toolSnapshot,
  undefined,
  'projector should not scan mixed raw blocks to invent a tool event',
)
assert.equal(unconfirmedToolProjection?.event?.type, 'assistant_message')

const confirmedToolProjection = projectThreadDisplayItem({
  id: 'projector-confirmed-tool-block',
  type: 'tool_call',
  text: '',
  status: 'running',
  identity: {
    threadId,
    turnId: 'turn-projector-purity',
    itemId: 'projector-confirmed-tool-block',
    contentIndex: 1,
    toolUseId: 'confirmed-tool-use-id',
  },
  content: [
    { type: 'text', text: '旁路文本' },
    {
      type: 'tool_use',
      id: 'raw-tool-id-should-not-win',
      name: 'Read',
      input: { file_path: 'package.json' },
    },
  ],
})
assert.equal(
  confirmedToolProjection?.event?.toolSnapshot?.identity?.toolUseId,
  'confirmed-tool-use-id',
  'projector identity should come from reducer-confirmed item identity',
)

const historyMessages = [
  {
    id: 'message-user-1',
    role: 'user',
    text: '读取 package.json',
    createdAt: '2026-05-28T00:00:00.000Z',
    content: [{ type: 'text', text: '读取 package.json' }],
  },
  {
    id: 'message-tool-1',
    role: 'assistant',
    text: '',
    status: 'completed',
    createdAt: '2026-05-28T00:00:01.000Z',
    content: [
      {
        type: 'tool_use',
        id: toolUseId,
        name: 'Read',
        input: { file_path: 'package.json' },
        status: 'completed',
      },
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: 'package content',
      },
    ],
  },
]

const historyInputEvents = appServerThreadMessagesToDisplayReducerInputEvents(
  historyMessages,
  { threadId, sessionId },
)

assert.equal(historyInputEvents.length, historyMessages.length)
assert.deepEqual(
  historyInputEvents.map(event => event.kind),
  ['message', 'message'],
)
assert.equal(historyInputEvents[0].source, 'history')
assert.equal(historyInputEvents[0].threadId, threadId)
assert.equal(historyInputEvents[0].sessionId, sessionId)
assert.deepEqual(historyInputEvents[0].orderKey, {
  source: 'history',
  ordinal: 0,
  timestamp: '2026-05-28T00:00:00.000Z',
  itemId: 'message-user-1',
})
assert.equal(historyInputEvents[0].sourceIdentity.kind, 'message')
assert.equal(historyInputEvents[0].sourceIdentity.sourceId, 'history:message:message-user-1')
assert.equal(historyInputEvents[0].payload.type, 'message')
assert.deepEqual(
  historyInputEvents[0].diagnostics,
  [],
  'normal history input event should carry an explicit diagnostics array',
)
assert.equal(historyInputEvents[0].identity.sourceIndex, 0)
assert.equal(historyInputEvents[1].blocks.length, 2)
assert.equal(historyInputEvents[1].identity.messageUuid, 'message-tool-1')
assert.equal(historyInputEvents[1].orderKey.source, 'history')
assert.equal(historyInputEvents[1].orderKey.ordinal, 1)
assert.equal(historyInputEvents[1].sourceIdentity.kind, 'tool')
assert.equal(historyInputEvents[1].sourceIdentity.toolUseId, toolUseId)
assert.equal(historyInputEvents[1].payload.type, 'message')
const historyToolFacts = resolveThreadDisplayFacts(historyInputEvents[1])
assert.equal(historyToolFacts.length, 2)
assert.equal(historyToolFacts[0].factType, 'file')
assert.equal(historyToolFacts[0].fileOperation, 'read')
assert.equal(historyToolFacts[0].toolUseId, toolUseId)
assert.equal(historyToolFacts[1].factType, 'tool_lifecycle')
assert.equal(historyToolFacts[1].parentToolUseId, toolUseId)

const classifiedHistoryEvents =
  appServerThreadMessagesToDisplayReducerInputEvents(
    [
      {
        id: 'message-user-image',
        role: 'user',
        text: '[图片]',
        content: [
          {
            type: 'image',
            attachmentId: 'upload-image-1',
            displayName: 'image.png',
            mimeType: 'image/png',
          },
        ],
      },
      {
        id: 'message-error-1',
        role: 'error',
        text: '工具执行失败',
        content: [{ type: 'text', text: '工具执行失败' }],
      },
      {
        id: 'message-system-1',
        role: 'system',
        kind: 'context_compacted',
        text: '上下文已压缩',
        content: [{ type: 'text', text: '上下文已压缩' }],
      },
    ],
    { threadId, sessionId },
  )
assert.equal(classifiedHistoryEvents[0].sourceIdentity.kind, 'attachment')
assert.equal(
  classifiedHistoryEvents[0].sourceIdentity.sourceId,
  'history:attachment:upload-image-1',
)
assert.equal(classifiedHistoryEvents[1].sourceIdentity.kind, 'error')
assert.equal(classifiedHistoryEvents[2].sourceIdentity.kind, 'system')
assert.equal(resolveThreadDisplayFacts(classifiedHistoryEvents[0])[0].factType, 'attachment')
assert.equal(resolveThreadDisplayFacts(classifiedHistoryEvents[1])[0].factType, 'error')
assert.equal(resolveThreadDisplayFacts(classifiedHistoryEvents[2])[0].factType, 'system')

const syntheticSystemSnapshot = buildThreadDisplaySnapshot({
  threadId,
  sessionId,
  source: 'history',
  messages: [
    {
      id: 'message-system-synthetic-no-response',
      role: 'system',
      text: 'No response requested.',
      status: 'completed',
      content: [{ type: 'text', text: 'No response requested.' }],
    },
  ],
})
assert.equal(
  syntheticSystemSnapshot.items.length,
  0,
  'synthetic system notices must not enter ThreadDisplay items without projection',
)
assert.deepEqual(
  syntheticSystemSnapshot.diagnostics ?? [],
  [],
  'filtered synthetic system notices must not create projection diagnostics',
)

const visibleSystemSnapshot = buildThreadDisplaySnapshot({
  threadId,
  sessionId,
  source: 'history',
  messages: [
    {
      id: 'message-system-visible',
      role: 'system',
      kind: 'system_notice',
      text: '系统提示仍应展示。',
      status: 'completed',
      content: [{ type: 'text', text: '系统提示仍应展示。' }],
    },
  ],
})
assert.equal(visibleSystemSnapshot.items.length, 1)
assert.equal(visibleSystemSnapshot.items[0].type, 'system_notice')
assert.equal(visibleSystemSnapshot.items[0].projection?.event.type, 'system_notice')

const snapshot = buildThreadDisplaySnapshot({
  threadId,
  sessionId,
  source: 'history',
  messages: historyMessages,
})

assert.equal(snapshot.threadId, threadId)
assert.equal(snapshot.sessionId, sessionId)
assert.equal(snapshot.items.length, 2)
const toolItem = snapshot.items.find(item => item.projection?.event?.toolSnapshot)
assert(toolItem, 'snapshot should still contain a merged tool lifecycle item')
assert.equal(toolItem.metadata.displayFact.factType, 'file')
assert.equal(toolItem.metadata.displayFact.fileOperation, 'read')
assert.equal(toolItem.metadata.primaryBlock.type, 'tool_use')
assert.equal(toolItem.projection.event.toolSnapshot.identity.toolUseId, toolUseId)
assert.equal(toolItem.projection.event.fileToolSnapshot.path, 'package.json')

const generatedOutputPath =
  'C:\\Users\\luoji\\.ccr\\generated_outputs\\smoke-thread-display\\out_projector_purity.png'
const generatedImageSnapshot = buildThreadDisplaySnapshot({
  threadId,
  sessionId,
  source: 'history',
  messages: [
    {
      id: 'message-generated-output-path',
      role: 'assistant',
      text: `已生成图片：\n${generatedOutputPath}`,
      status: 'completed',
      content: [
        {
          type: 'text',
          text: `已生成图片：\n${generatedOutputPath}`,
        },
      ],
    },
  ],
})
const generatedImageEvent = generatedImageSnapshot.items[0].projection?.event
assert.equal(generatedImageEvent?.attachmentSnapshots?.[0]?.source, 'ModelOutput')
assert.equal(generatedImageEvent?.attachmentSnapshots?.[0]?.path, generatedOutputPath)
assert.equal(
  generatedImageSnapshot.items[0].metadata.displayFact.factType,
  'attachment',
  'generated output paths should be materialized before DisplayFact resolution',
)
assert.equal(
  generatedImageSnapshot.items[0].metadata.displayFact.sourceIdentityKind,
  'attachment',
)
assert.equal(
  generatedImageEvent?.text.includes(generatedOutputPath),
  false,
  'generated output path should be hidden after App Server materializes an image block',
)

const generatedOutputPath2 =
  'C:\\Users\\luoji\\.ccr\\generated_outputs\\smoke-thread-display\\out_projector_purity_2.webp'
const ordinaryLocalImagePath =
  'C:\\Users\\luoji\\Pictures\\ordinary-local-image.png'
const multiGeneratedMessages = [
  {
    id: 'message-generated-output-multi',
    role: 'assistant',
    text: [
      '已生成图片：',
      generatedOutputPath,
      generatedOutputPath2,
      `普通路径：${ordinaryLocalImagePath}`,
    ].join('\n'),
    status: 'completed',
    content: [
      {
        type: 'text',
        text: [
          '已生成图片：',
          generatedOutputPath,
          generatedOutputPath2,
          `普通路径：${ordinaryLocalImagePath}`,
        ].join('\n'),
      },
    ],
  },
]
const multiGeneratedInputEvents =
  appServerThreadMessagesToDisplayReducerInputEvents(multiGeneratedMessages, {
    threadId,
    sessionId,
  })
assert.equal(multiGeneratedInputEvents[0].sourceIdentity.kind, 'attachment')
assert.equal(multiGeneratedInputEvents[0].blocks.length, 3)
assert.equal(
  multiGeneratedInputEvents[0].blocks.filter(block => block.origin === 'model_output').length,
  2,
)
const multiGeneratedFacts = resolveThreadDisplayFacts(multiGeneratedInputEvents[0])
assert.equal(multiGeneratedFacts[0].factType, 'attachment')
assert.equal(multiGeneratedFacts[0].attachmentBlocks.length, 2)
const multiGeneratedSnapshot = buildThreadDisplaySnapshot({
  threadId,
  sessionId,
  source: 'history',
  messages: multiGeneratedMessages,
})
const multiGeneratedEvent = multiGeneratedSnapshot.items[0].projection?.event
assert.deepEqual(
  multiGeneratedEvent?.attachmentSnapshots?.map(attachment => attachment.path),
  [generatedOutputPath, generatedOutputPath2],
)
assert.equal(
  multiGeneratedEvent?.text.includes(generatedOutputPath),
  false,
  'all generated output paths should be removed after materialization',
)
assert.equal(
  multiGeneratedEvent?.text.includes(generatedOutputPath2),
  false,
  'all generated output paths should be removed after materialization',
)
assert.equal(
  multiGeneratedEvent?.text.includes(ordinaryLocalImagePath),
  true,
  'ordinary local image paths must stay text and must not become attachments',
)

const realtimeGeneratedPatch = coreEventToThreadDisplayPatch({
  type: 'item_completed',
  threadId,
  turnId: 'turn-live-generated-output',
  itemId: 'live-generated-output-item',
  kind: 'assistant_message',
  status: 'completed',
  content: multiGeneratedMessages[0].content,
  completedAt: '2026-05-28T00:00:45.000Z',
})
assert(realtimeGeneratedPatch, 'realtime generated output should produce a patch')
assert.equal(realtimeGeneratedPatch.operations.length, 1)
assert.equal(realtimeGeneratedPatch.operations[0].op, 'complete_item')
const realtimeGeneratedEvent =
  realtimeGeneratedPatch.operations[0].item.projection?.event
assert.deepEqual(
  realtimeGeneratedEvent?.attachmentSnapshots?.map(attachment => attachment.path),
  multiGeneratedEvent?.attachmentSnapshots?.map(attachment => attachment.path),
  'history snapshot and realtime patch should expose the same generated output attachments',
)
assert.equal(realtimeGeneratedEvent?.text, multiGeneratedEvent?.text)

const multiUserAttachmentMessages = [
  {
    id: 'message-user-multi-attachment',
    role: 'user',
    text: '[图片]\n请同时参考说明文件。',
    content: [
      { type: 'text', text: '[图片]\n请同时参考说明文件。' },
      {
        type: 'image',
        attachmentId: 'upload-image-multi-1',
        displayName: 'image.png',
        mimeType: 'image/png',
        path: 'C:\\Users\\luoji\\Pictures\\image.png',
      },
      {
        type: 'file',
        attachmentId: 'upload-file-multi-1',
        displayName: 'notes.txt',
        mimeType: 'text/plain',
        path: 'C:\\Users\\luoji\\Documents\\notes.txt',
      },
    ],
  },
]
const multiUserInputEvents =
  appServerThreadMessagesToDisplayReducerInputEvents(multiUserAttachmentMessages, {
    threadId,
    sessionId,
  })
assert.equal(multiUserInputEvents[0].sourceIdentity.kind, 'attachment')
const multiUserFacts = resolveThreadDisplayFacts(multiUserInputEvents[0])
assert.equal(multiUserFacts[0].factType, 'attachment')
assert.equal(multiUserFacts[0].attachmentBlocks.length, 2)
const multiUserSnapshot = buildThreadDisplaySnapshot({
  threadId,
  sessionId,
  source: 'history',
  messages: multiUserAttachmentMessages,
})
const multiUserEvent = multiUserSnapshot.items[0].projection?.event
assert.equal(multiUserEvent?.attachmentSnapshots?.length, 2)
assert.deepEqual(
  multiUserEvent?.attachmentSnapshots?.map(attachment => attachment.source),
  ['UserUpload', 'UserUpload'],
)
assert.deepEqual(
  multiUserEvent?.attachmentSnapshots?.map(attachment => attachment.previewKind),
  ['image', 'text'],
)
assert.equal(
  multiUserEvent?.text.includes('[图片]'),
  false,
  'user image placeholder should be removed only after confirmed attachment fact',
)

const unknownAttachmentSnapshot = buildThreadDisplaySnapshot({
  threadId,
  sessionId,
  source: 'history',
  messages: [
    {
      id: 'message-unknown-attachment',
      role: 'assistant',
      text: '',
      content: [{ type: 'file' }],
    },
  ],
})
const unknownAttachment = unknownAttachmentSnapshot.items[0].projection?.event
  ?.attachmentSnapshots?.[0]
assert.equal(
  unknownAttachment?.name,
  '附件 1',
  'unknown attachment keeps deterministic fallback name for identity stability',
)
assert.equal(
  unknownAttachment?.diagnostic?.reason,
  '附件块缺少名称和路径，无法判断具体文件。',
  'unknown attachment should explain why it cannot identify the file',
)
assert.deepEqual(
  unknownAttachment?.diagnostic?.missingFields,
  ['displayName/name/filename/file.path', 'savedPath/path/url/source.path'],
)

const snapshotReducer = createThreadDisplayReducer({ threadId, sessionId })
const reducerSnapshotItems = snapshotReducer
  .acceptMany(historyInputEvents)
  .toSnapshotItems()
assert.deepEqual(
  JSON.parse(JSON.stringify(reducerSnapshotItems)),
  JSON.parse(JSON.stringify(snapshot.items)),
  'ThreadDisplayReducer.acceptMany should produce the same snapshot items',
)
const reversedReducerSnapshotItems = createThreadDisplayReducer({
  threadId,
  sessionId,
})
  .acceptMany([...historyInputEvents].reverse())
  .toSnapshotItems()
assert.deepEqual(
  JSON.parse(JSON.stringify(reversedReducerSnapshotItems)),
  JSON.parse(JSON.stringify(snapshot.items)),
  'ThreadDisplayReducer state should derive snapshot order from orderKey',
)

const itemStartedEvent = {
  type: 'item_started',
  item: {
    itemId: 'live-tool-item',
    threadId,
    turnId: 'turn-live-1',
    kind: 'assistant_message',
    status: 'running',
    startedAt: '2026-05-28T00:01:00.000Z',
    content: [
      {
        type: 'tool_use',
        id: 'live-tool-use',
        name: 'Read',
        input: { file_path: 'src/index.ts' },
      },
    ],
  },
}

const realtimeInputEvent = coreTurnEventToDisplayReducerInputEvent(itemStartedEvent)
assert.equal(realtimeInputEvent.source, 'realtime')
assert.equal(realtimeInputEvent.kind, 'item_started')
assert.equal(realtimeInputEvent.threadId, threadId)
assert.equal(realtimeInputEvent.turnId, 'turn-live-1')
assert.equal(realtimeInputEvent.itemId, 'live-tool-item')
assert.equal(realtimeInputEvent.blocks.length, 1)
assert.equal(realtimeInputEvent.orderKey.source, 'realtime')
assert.equal(realtimeInputEvent.orderKey.ordinal, 3)
assert.equal(realtimeInputEvent.orderKey.timestamp, '2026-05-28T00:01:00.000Z')
assert.equal(realtimeInputEvent.sourceIdentity.kind, 'tool')
assert.equal(realtimeInputEvent.sourceIdentity.toolUseId, 'live-tool-use')
assert.equal(realtimeInputEvent.payload.type, 'core_event')
assert.equal(realtimeInputEvent.payload.eventType, 'item_started')
const realtimeStartedFacts = resolveThreadDisplayFacts(realtimeInputEvent)
assert.equal(realtimeStartedFacts.length, 1)
assert.equal(realtimeStartedFacts[0].factType, 'file')
assert.equal(realtimeStartedFacts[0].fileOperation, 'read')
assert.equal(realtimeStartedFacts[0].toolUseId, 'live-tool-use')
assert.deepEqual(
  realtimeInputEvent.diagnostics,
  [],
  'normal realtime input event should carry an explicit diagnostics array',
)

const realtimeControlEvent = coreTurnEventToDisplayReducerInputEvent({
  type: 'turn_started',
  threadId,
  turnId: 'turn-control-1',
  provider: 'smoke-provider',
  model: 'smoke-model',
})
assert.equal(realtimeControlEvent.sourceIdentity.kind, 'control')
assert.equal(realtimeControlEvent.orderKey.source, 'realtime')
assert.equal(realtimeControlEvent.orderKey.ordinal, 1)
const realtimeControlFacts = resolveThreadDisplayFacts(realtimeControlEvent)
assert.equal(realtimeControlFacts.length, 1)
assert.equal(realtimeControlFacts[0].factType, 'control')
assert.equal(realtimeControlFacts[0].controlKind, 'turn_started')
assert.equal(
  realtimeControlFacts[0].shouldRender,
  false,
  'internal turn controls should be explicit facts without timeline rendering',
)

const permissionRequestedEvent = {
  type: 'permission_requested',
  request: {
    permissionRequestId: 'permission-smoke-1',
    threadId,
    turnId: 'turn-permission-1',
    tool: {
      name: 'Bash',
      displayName: 'Shell',
      description: 'Run a shell command',
    },
    input: { command: 'npm.cmd test' },
    toolUseId: 'tool-permission-1',
    createdAt: '2026-05-28T00:00:30.000Z',
  },
}
const permissionInputEvent =
  coreTurnEventToDisplayReducerInputEvent(permissionRequestedEvent)
assert.equal(permissionInputEvent.sourceIdentity.kind, 'control')
assert.equal(permissionInputEvent.kind, 'permission_requested')
const permissionFacts = resolveThreadDisplayFacts(permissionInputEvent)
assert.equal(permissionFacts.length, 1)
assert.equal(permissionFacts[0].factType, 'control')
assert.equal(permissionFacts[0].controlKind, 'permission_requested')
assert.equal(permissionFacts[0].itemId, 'permission-smoke-1')
assert.equal(permissionFacts[0].shouldRender, true)
const permissionReducer = createThreadDisplayReducer({ threadId, sessionId })
const permissionOperations = permissionReducer
  .acceptOne(permissionInputEvent)
  .consumePatchOperations()
assert.equal(permissionOperations.length, 1)
assert.equal(permissionOperations[0].op, 'append_item')
assert.equal(permissionOperations[0].item.type, 'permission_request')
assert.equal(permissionOperations[0].item.text, permissionFacts[0].text)
assert.equal(
  permissionOperations[0].item.metadata.displayFact.controlKind,
  'permission_requested',
)
assert.equal(permissionOperations[0].item.metadata.displayFact.shouldRender, true)
const permissionCancelledEvent = {
  type: 'permission_cancelled',
  permissionRequestId: 'permission-smoke-1',
  threadId,
  turnId: 'turn-permission-1',
  reason: 'smoke_cancelled',
}
const permissionCancelledInputEvent =
  coreTurnEventToDisplayReducerInputEvent(permissionCancelledEvent)
const permissionCancelledFacts = resolveThreadDisplayFacts(
  permissionCancelledInputEvent,
)
assert.equal(permissionCancelledFacts[0].factType, 'control')
assert.equal(permissionCancelledFacts[0].controlKind, 'permission_cancelled')
const permissionCancelledOperations = permissionReducer
  .acceptOne(permissionCancelledInputEvent)
  .consumePatchOperations()
assert.equal(permissionCancelledOperations.length, 1)
assert.equal(permissionCancelledOperations[0].op, 'update_item')
assert.equal(permissionCancelledOperations[0].itemId, 'permission-smoke-1')
assert.equal(permissionCancelledOperations[0].item.status, 'cancelled')
assert.equal(
  permissionCancelledOperations[0].item.metadata.displayFact.controlKind,
  'permission_cancelled',
)
assert.equal(permissionCancelledOperations[0].item.metadata.reason, 'smoke_cancelled')

const compactStartedEvent = {
  type: 'context_compaction_started',
  threadId,
  turnId: 'turn-compact-1',
  startedAt: '2026-05-28T00:00:40.000Z',
  trigger: 'auto',
}
const compactStartedInputEvent =
  coreTurnEventToDisplayReducerInputEvent(compactStartedEvent)
assert.equal(compactStartedInputEvent.sourceIdentity.kind, 'control')
const compactStartedFacts = resolveThreadDisplayFacts(compactStartedInputEvent)
assert.equal(compactStartedFacts[0].factType, 'system')
assert.equal(compactStartedFacts[0].systemKind, 'context_compaction_started')
const compactReducer = createThreadDisplayReducer({ threadId, sessionId })
const compactStartedOperations = compactReducer
  .acceptOne(compactStartedInputEvent)
  .consumePatchOperations()
assert.equal(compactStartedOperations.length, 1)
assert.equal(compactStartedOperations[0].op, 'append_item')
assert.equal(compactStartedOperations[0].item.type, 'system_notice')
assert.equal(
  compactStartedOperations[0].item.metadata.displayFact.systemKind,
  'context_compaction_started',
)
const compactedEvent = {
  type: 'context_compacted',
  threadId,
  compactedAt: '2026-05-28T00:00:41.000Z',
  result: {
    trigger: 'auto',
    preCompactTokenCount: 12000,
    truePostCompactTokenCount: 4200,
    summaryMessageCount: 3,
    attachmentCount: 1,
  },
}
const compactedInputEvent = coreTurnEventToDisplayReducerInputEvent(compactedEvent)
const compactedFacts = resolveThreadDisplayFacts(compactedInputEvent)
assert.equal(compactedFacts[0].factType, 'system')
assert.equal(compactedFacts[0].systemKind, 'context_compacted')
const compactedOperations = compactReducer
  .acceptOne(compactedInputEvent)
  .consumePatchOperations()
assert.equal(compactedOperations.length, 1)
assert.equal(compactedOperations[0].op, 'complete_item')
assert.equal(
  compactedOperations[0].item.metadata.displayFact.systemKind,
  'context_compacted',
)
assert.equal(
  compactedOperations[0].item.metadata.compactSnapshot.summaryMessageCount,
  3,
)

const startedPatch = coreEventToThreadDisplayPatch(itemStartedEvent)
assert(startedPatch, 'item_started should still produce a patch')
assert.equal(startedPatch.threadId, threadId)
assert.equal(startedPatch.operations.length, 1)
assert.equal(startedPatch.operations[0].op, 'append_item')
assert.equal(
  startedPatch.operations[0].item.projection.event.toolSnapshot.identity.toolUseId,
  'live-tool-use',
)

const itemCompletedEvent = {
  type: 'item_completed',
  threadId,
  turnId: 'turn-live-1',
  itemId: 'live-tool-item',
  kind: 'assistant_message',
  status: 'completed',
  content: [
    {
      type: 'tool_result',
      tool_use_id: 'live-tool-use',
      content: 'src/index.ts content',
    },
  ],
  startedAt: '2026-05-28T00:01:00.000Z',
  completedAt: '2026-05-28T00:01:01.000Z',
}

const completedInputEvent =
  coreTurnEventToDisplayReducerInputEvent(itemCompletedEvent)
assert.equal(completedInputEvent.kind, 'item_completed')
assert.equal(completedInputEvent.blocks.length, 1)
assert.equal(completedInputEvent.orderKey.source, 'realtime')
assert.equal(completedInputEvent.orderKey.ordinal, 5)
assert.equal(completedInputEvent.sourceIdentity.kind, 'tool')
assert.equal(completedInputEvent.sourceIdentity.toolUseId, 'live-tool-use')
assert.equal(completedInputEvent.sourceIdentity.parentToolUseId, 'live-tool-use')
const realtimeCompletedFacts = resolveThreadDisplayFacts(completedInputEvent)
assert.equal(realtimeCompletedFacts.length, 1)
assert.equal(realtimeCompletedFacts[0].factType, 'tool_lifecycle')
assert.equal(realtimeCompletedFacts[0].parentToolUseId, 'live-tool-use')

const completedPatch = coreEventToThreadDisplayPatch(itemCompletedEvent)
assert(completedPatch, 'item_completed should still produce a patch')
assert.equal(completedPatch.operations.length, 1)
assert.equal(completedPatch.operations[0].op, 'complete_item')
assert.equal(completedPatch.operations[0].itemId, 'tool:live-tool-use')

const liveReducer = createThreadDisplayReducer({ threadId })
const reducerStartedOperations = liveReducer
  .acceptOne(realtimeInputEvent)
  .consumePatchOperations()
assert.deepEqual(
  JSON.parse(JSON.stringify(reducerStartedOperations)),
  JSON.parse(JSON.stringify(startedPatch.operations)),
  'ThreadDisplayReducer.acceptOne should produce item_started patch operations',
)

const itemProgressEvent = {
  type: 'item_delta',
  threadId,
  turnId: 'turn-live-1',
  itemId: 'live-tool-item',
  delta: {
    type: 'progress',
    tool_use_id: 'live-tool-use',
    data: { message: '读取中', percent: 50 },
    timestamp: '2026-05-28T00:01:00.500Z',
  },
  timestamp: '2026-05-28T00:01:00.500Z',
}
const progressInputEvent =
  coreTurnEventToDisplayReducerInputEvent(itemProgressEvent)
assert.equal(progressInputEvent.sourceIdentity.kind, 'tool')
assert.equal(progressInputEvent.sourceIdentity.toolUseId, 'live-tool-use')
const realtimeProgressFacts = resolveThreadDisplayFacts(progressInputEvent)
assert.equal(realtimeProgressFacts.length, 1)
assert.equal(realtimeProgressFacts[0].factType, 'tool_lifecycle')
assert.equal(realtimeProgressFacts[0].lifecycleKind, 'tool_progress')
assert.equal(realtimeProgressFacts[0].parentToolUseId, 'live-tool-use')
const reducerProgressOperations = liveReducer
  .acceptOne(progressInputEvent)
  .consumePatchOperations()
assert.equal(reducerProgressOperations.length, 1)
assert.equal(reducerProgressOperations[0].op, 'update_item')
assert.equal(reducerProgressOperations[0].itemId, 'tool:live-tool-use')
assert.equal(reducerProgressOperations[0].item.status, 'running')
assert.deepEqual(
  reducerProgressOperations[0].item.metadata.toolLifecycle.progressBlock.data,
  { message: '读取中', percent: 50 },
)
assert.deepEqual(
  reducerProgressOperations[0].item.content[0].progress.data,
  { message: '读取中', percent: 50 },
)
assert.equal(
  reducerProgressOperations[0].item.metadata.displayFact.factType,
  'file',
  'tool progress should update the existing tool item without replacing its file fact',
)

const duplicateCompletedToolUseEvent = {
  type: 'item_completed',
  threadId,
  turnId: 'turn-live-1',
  itemId: 'live-tool-item-duplicate-use',
  kind: 'assistant_message',
  status: 'completed',
  content: [
    {
      type: 'tool_use',
      id: 'live-tool-use',
      name: 'Read',
      input: { file_path: 'src/index.ts' },
    },
  ],
  completedAt: '2026-05-28T00:01:00.750Z',
}
const duplicateToolUseOperations = liveReducer
  .acceptOne(coreTurnEventToDisplayReducerInputEvent(duplicateCompletedToolUseEvent))
  .consumePatchOperations()
assert.equal(
  duplicateToolUseOperations.length,
  0,
  'duplicate completed tool_use should not append a second tool card',
)

const reducerCompletedOperations = liveReducer
  .acceptOne(completedInputEvent)
  .consumePatchOperations()
assert.equal(reducerCompletedOperations.length, 1)
assert.equal(reducerCompletedOperations[0].op, 'complete_item')
assert.equal(reducerCompletedOperations[0].itemId, completedPatch.operations[0].itemId)
assert.equal(reducerCompletedOperations[0].status, 'completed')
assert.equal(
  reducerCompletedOperations[0].item.metadata.toolLifecycle.progressBlock.data.percent,
  50,
  'ThreadDisplayReducer should preserve tool progress state across realtime events',
)
assert.equal(
  reducerCompletedOperations[0].item.projection.event.toolSnapshot.identity.toolUseId,
  completedPatch.operations[0].item.projection.event.toolSnapshot.identity.toolUseId,
)
const liveSnapshotItems = liveReducer.toSnapshotItems()
assert.equal(liveSnapshotItems.length, 1)
assert.equal(liveSnapshotItems[0].id, 'tool:live-tool-use')
assert.equal(liveSnapshotItems[0].status, 'completed')
assert.equal(liveSnapshotItems[0].metadata.displayFact.factType, 'file')
assert.equal(liveSnapshotItems[0].metadata.displayFact.fileOperation, 'read')
assert.equal(
  liveSnapshotItems[0].projection.event.fileToolSnapshot.path,
  'src/index.ts',
)
assert.equal(liveSnapshotItems[0].metadata.toolLifecycle.progressBlock.data.percent, 50)

const failedToolReducer = createThreadDisplayReducer({ threadId })
failedToolReducer.acceptOne(
  coreTurnEventToDisplayReducerInputEvent({
    type: 'item_started',
    item: {
      itemId: 'live-tool-failed-item',
      threadId,
      turnId: 'turn-live-failed',
      kind: 'assistant_message',
      status: 'running',
      startedAt: '2026-05-28T00:03:00.000Z',
      content: [
        {
          type: 'tool_use',
          id: 'live-tool-failed-use',
          name: 'Bash',
          input: { command: 'exit 1' },
        },
      ],
    },
  }),
).consumePatchOperations()
const failedToolOperations = failedToolReducer
  .acceptOne(
    coreTurnEventToDisplayReducerInputEvent({
      type: 'item_completed',
      threadId,
      turnId: 'turn-live-failed',
      itemId: 'live-tool-failed-result',
      kind: 'tool_result',
      status: 'failed',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'live-tool-failed-use',
          is_error: true,
          content: 'command failed',
        },
      ],
      completedAt: '2026-05-28T00:03:01.000Z',
    }),
  )
  .consumePatchOperations()
assert.equal(failedToolOperations.length, 1)
assert.equal(failedToolOperations[0].op, 'complete_item')
assert.equal(failedToolOperations[0].itemId, 'tool:live-tool-failed-use')
assert.equal(failedToolOperations[0].status, 'failed')
assert.equal(failedToolOperations[0].item.status, 'failed')
assert.equal(failedToolOperations[0].item.projection.event.toolSnapshot.status, 'failed')

const interruptedToolReducer = createThreadDisplayReducer({ threadId })
interruptedToolReducer.acceptOne(
  coreTurnEventToDisplayReducerInputEvent({
    type: 'item_started',
    item: {
      itemId: 'live-tool-interrupted-item',
      threadId,
      turnId: 'turn-live-interrupted',
      kind: 'assistant_message',
      status: 'running',
      content: [
        {
          type: 'tool_use',
          id: 'live-tool-interrupted-use',
          name: 'Bash',
          input: { command: 'Start-Sleep -Seconds 30' },
        },
      ],
    },
  }),
).consumePatchOperations()
const interruptedToolOperations = interruptedToolReducer
  .acceptOne(
    coreTurnEventToDisplayReducerInputEvent({
      type: 'item_completed',
      threadId,
      turnId: 'turn-live-interrupted',
      itemId: 'live-tool-interrupted-result',
      kind: 'tool_result',
      status: 'cancelled',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'live-tool-interrupted-use',
          status: 'cancelled',
          content: 'cancelled by user',
        },
      ],
      completedAt: '2026-05-28T00:04:01.000Z',
    }),
  )
  .consumePatchOperations()
assert.equal(interruptedToolOperations.length, 1)
assert.equal(interruptedToolOperations[0].itemId, 'tool:live-tool-interrupted-use')
assert.equal(interruptedToolOperations[0].status, 'interrupted')
assert.equal(interruptedToolOperations[0].item.status, 'interrupted')

const equivalentHistorySnapshot = buildThreadDisplaySnapshot({
  threadId,
  sessionId,
  source: 'history',
  messages: [
    {
      id: 'history-live-equivalent-tool',
      role: 'assistant',
      text: '',
      status: 'completed',
      createdAt: '2026-05-28T00:01:00.000Z',
      content: [
        {
          type: 'tool_use',
          id: 'live-tool-use',
          name: 'Read',
          input: { file_path: 'src/index.ts' },
        },
        {
          type: 'tool_result',
          tool_use_id: 'live-tool-use',
          content: 'src/index.ts content',
        },
      ],
    },
  ],
})
const equivalentHistoryToolItem = equivalentHistorySnapshot.items.find(
  item => item.id === 'tool:live-tool-use',
)
assert(equivalentHistoryToolItem, 'history replay should build the same tool item id')
const pickToolState = item => ({
  id: item.id,
  type: item.type,
  status: item.status,
  toolUseId: item.projection?.event?.toolSnapshot?.identity?.toolUseId,
  filePath: item.projection?.event?.fileToolSnapshot?.path,
  factType: item.metadata?.displayFact?.factType,
  fileOperation: item.metadata?.displayFact?.fileOperation,
})
assert.deepEqual(
  pickToolState(equivalentHistoryToolItem),
  pickToolState(liveSnapshotItems[0]),
  'history snapshot and realtime patch state should converge for the same tool lifecycle',
)

const orphanToolResultEvent = {
  type: 'item_completed',
  threadId,
  turnId: 'turn-live-orphan',
  itemId: 'live-tool-orphan-item',
  kind: 'assistant_message',
  status: 'completed',
  content: [
    {
      type: 'tool_result',
      tool_use_id: 'missing-live-tool-use',
      content: 'orphan result content',
    },
  ],
  completedAt: '2026-05-28T00:02:00.000Z',
}
const orphanReducer = createThreadDisplayReducer({ threadId })
const orphanOperations = orphanReducer
  .acceptOne(coreTurnEventToDisplayReducerInputEvent(orphanToolResultEvent))
  .consumePatchOperations()
assert.equal(orphanOperations.length, 1)
assert.equal(orphanOperations[0].op, 'append_item')
assert.equal(orphanOperations[0].item.status, 'diagnostic')
assert.equal(
  orphanOperations[0].item.metadata.toolLifecycle.diagnostic.code,
  'orphan_tool_result',
)
assert.equal(
  orphanOperations[0].item.projection.event.errorSnapshot.category,
  'protocol_error',
)
assert.equal(orphanReducer.toSnapshotItems().length, 1)

const orphanDeltaEvent = {
  type: 'item_delta',
  threadId,
  turnId: 'turn-live-orphan-delta',
  itemId: 'missing-live-delta-item',
  delta: { type: 'text_delta', text: 'lost streaming text' },
  timestamp: '2026-05-28T00:02:01.000Z',
}
const orphanDeltaReducer = createThreadDisplayReducer({ threadId })
const orphanDeltaOperations = orphanDeltaReducer
  .acceptOne(coreTurnEventToDisplayReducerInputEvent(orphanDeltaEvent))
  .consumePatchOperations()
assert.equal(orphanDeltaOperations.length, 1)
assert.equal(orphanDeltaOperations[0].op, 'update_item')
assert.equal(
  orphanDeltaOperations[0].item.text,
  'lost streaming text',
  'text deltas without a prior item should still seed the streaming state',
)
assert.equal(orphanDeltaReducer.toSnapshotItems()[0].id, 'missing-live-delta-item')

const unsupportedInputEvent = createUnsupportedDisplayReducerInputEvent({
  source: 'history',
  threadId,
  sessionId,
  rawType: 'legacy_raw_display_event',
  reason: 'unknown display input shape',
  ordinal: 99,
})
assert.equal(unsupportedInputEvent.orderKey.source, 'history')
assert.equal(unsupportedInputEvent.orderKey.ordinal, 99)
assert.equal(unsupportedInputEvent.sourceIdentity.kind, 'unsupported')
assert.equal(unsupportedInputEvent.payload.type, 'unsupported')
assert.equal(unsupportedInputEvent.diagnostics[0].code, 'unsupported_thread_display_input')
assert.equal(resolveThreadDisplayFacts(unsupportedInputEvent)[0].factType, 'unsupported')
const unsupportedReducer = createThreadDisplayReducer({ threadId, sessionId })
const unsupportedSnapshotItems = unsupportedReducer
  .acceptMany([unsupportedInputEvent])
  .toSnapshotItems()
assert.equal(unsupportedReducer.getDiagnostics().length, 1)
assert.equal(
  unsupportedReducer.getDiagnostics()[0].code,
  'unsupported_thread_display_input',
)
assert.equal(unsupportedSnapshotItems.length, 1)
assert.equal(unsupportedSnapshotItems[0].type, 'error')
assert.equal(
  unsupportedSnapshotItems[0].sourceKind,
  'thread_display_input_diagnostic',
)
assert.equal(unsupportedSnapshotItems[0].metadata.displayFact.factType, 'unsupported')
assert.equal(
  unsupportedSnapshotItems[0].projection.event.errorSnapshot.category,
  'protocol_error',
)

const invalidInputEvent = {
  ...historyInputEvents[0],
  diagnostics: undefined,
}
assert.throws(
  () => assertThreadDisplayReducerInputEvent(invalidInputEvent),
  /diagnostics must be an array/,
  'input protocol validation should fail fast instead of falling back',
)

console.log('smoke-thread-display-input-event: ok')
