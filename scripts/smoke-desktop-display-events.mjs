import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { build } from 'esbuild'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = join(
  repoRoot,
  'apps',
  'desktop',
  'src',
  'renderer',
  'src',
  'domain',
  'fixtures',
  'display-events.json',
)

const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
const events = fixture.events

assert(
  fixture.fixtureSchemaVersion === 1,
  'fixture must declare fixtureSchemaVersion 1',
)
assert(Array.isArray(events), 'fixture.events must be an array')
assert(events.length >= 6, 'fixture should cover multiple display event kinds')
assert(
  Array.isArray(fixture.expectedCards) && fixture.expectedCards.length >= 10,
  'fixture.expectedCards must describe expected rendered card coverage',
)

for (const expectedCard of fixture.expectedCards) {
  assertExpectedCard(expectedCard)
}

const eventTypes = new Set(events.map(event => event.type))
for (const type of [
  'user_message',
  'assistant_message',
  'thinking_summary',
  'tool_call',
  'todo_list',
  'file_change',
  'file_reference',
  'attachment',
  'error',
]) {
  assert(eventTypes.has(type), `fixture is missing ${type}`)
}

const orphanToolResults = events.filter(event => event.type === 'tool_result')
assert(
  orphanToolResults.every(
    event => event.toolSnapshot?.displayName === '孤立工具结果',
  ),
  'only orphan tool_result fallback cards may remain standalone in fixtures',
)
assert(
  orphanToolResults.some(event =>
    event.text.includes('缺少 tool_use_id / parent_tool_use_id'),
  ),
  'orphan tool_result fallback must explain why it was not merged',
)

const visibleTimelineEvents = events.filter(
  event => event.type !== 'todo_list' && !event.timelineHidden,
)
assert(
  !visibleTimelineEvents.some(
    event => event.toolSnapshot?.name === 'AskUserQuestion',
  ),
  'AskUserQuestion should be hidden from the main timeline',
)

assert(
  Array.isArray(fixture.hiddenContentBlocks) &&
    fixture.hiddenContentBlocks.some(
      block => block?.attachment?.type === 'todo_reminder',
    ),
  'fixture must include a todo_reminder hidden content block regression case',
)

assert(
  fixture.hiddenContentBlocks.some(
    block => block?.attachment?.name === 'todo_reminder',
  ),
  'fixture must include a named todo_reminder hidden content block regression case',
)

assert(
  !events.some(event => event.text?.includes('todo_reminder')),
  'todo_reminder must not be rendered as a visible attachment event',
)

const todoValidationError = events.find(
  event => event.id === 'fixture-todowrite-validation-error',
)
assert(
  todoValidationError?.type === 'tool_call',
  'invalid TodoWrite input should render as a tool error card',
)
assert(
  !todoValidationError.todoSnapshot,
  'invalid TodoWrite input must not be silently converted into a todo overlay',
)
assert(
  todoValidationError.timelineHidden === false,
  'invalid TodoWrite input should stay visible instead of being hidden as a control tool',
)
assert(
  todoValidationError.toolSnapshot?.name === 'TodoWrite' &&
    todoValidationError.toolSnapshot.status === 'failed' &&
    todoValidationError.toolSnapshot.category === 'control',
  'invalid TodoWrite input should preserve tool identity and failed status',
)
assert(
  String(todoValidationError.toolSnapshot?.errorMessage).includes('content') &&
    String(todoValidationError.toolSnapshot?.errorMessage).includes('activeForm'),
  'invalid TodoWrite input should explain missing schema fields',
)
assert(
  JSON.stringify(todoValidationError.toolSnapshot?.input).includes('"name"') &&
    !JSON.stringify(todoValidationError.toolSnapshot?.result).includes(
      '"content"',
    ),
  'invalid TodoWrite input should remain an error instead of mapping name/description into content',
)

for (const event of events) {
  assert(typeof event.id === 'string' && event.id, 'event.id is required')
  assert(typeof event.text === 'string', `event.text is required for ${event.id}`)

  if (event.toolSnapshot) {
    const isOrphanToolResult =
      event.type === 'tool_result' &&
      event.toolSnapshot.displayName === '孤立工具结果'
    assert(
      event.identity?.turnId,
      `tool event ${event.id} must preserve turnId`,
    )
    assert(
      isOrphanToolResult || event.identity?.toolUseId,
      `tool event ${event.id} must preserve toolUseId`,
    )
    assert(
      typeof event.toolSnapshot.category === 'string' &&
        event.toolSnapshot.category,
      `tool event ${event.id} must classify tool category`,
    )
    assert(
      typeof event.toolSnapshot.statusLabel === 'string' &&
        event.toolSnapshot.statusLabel,
      `tool event ${event.id} must expose a localized status label`,
    )

    if (event.toolSnapshot.kind === 'call') {
      assert(
        'result' in event.toolSnapshot,
        `tool call ${event.id} must carry merged tool result`,
      )
    }
  }

  if (event.todoSnapshot) {
    assert(
      Array.isArray(event.todoSnapshot.items) &&
        event.todoSnapshot.items.length > 0,
      `todo event ${event.id} must contain todo items`,
    )
  }

  if (event.fileSnapshot) {
    assert(
      typeof event.fileSnapshot.path === 'string' &&
        event.fileSnapshot.path,
      `file event ${event.id} must expose a path`,
    )
    assert(
      typeof event.fileSnapshot.source === 'string' &&
        event.fileSnapshot.source,
      `file event ${event.id} must expose source`,
    )
    assert(
      typeof event.fileSnapshot.kind === 'string' &&
        event.fileSnapshot.kind,
      `file event ${event.id} must expose kind`,
    )
    assert(
      typeof event.fileSnapshot.safety === 'string' &&
        event.fileSnapshot.safety,
      `file event ${event.id} must expose safety`,
    )
  }

  if (event.fileToolSnapshot) {
    assert(
      typeof event.fileToolSnapshot.id === 'string' &&
        event.fileToolSnapshot.id,
      `file tool event ${event.id} must expose snapshot id`,
    )
    assert(
      typeof event.fileToolSnapshot.operation === 'string' &&
        event.fileToolSnapshot.operation,
      `file tool event ${event.id} must expose operation`,
    )
    assert(
      typeof event.fileToolSnapshot.status === 'string' &&
        event.fileToolSnapshot.status,
      `file tool event ${event.id} must expose status`,
    )
    assert(
      typeof event.fileToolSnapshot.summary === 'string' &&
        event.fileToolSnapshot.summary,
      `file tool event ${event.id} must expose summary`,
    )
    assert(
      typeof event.fileToolSnapshot.safety === 'string' &&
        event.fileToolSnapshot.safety,
      `file tool event ${event.id} must expose safety`,
    )
    assert(
      Array.isArray(event.fileToolSnapshot.actions),
      `file tool event ${event.id} must expose actions`,
    )
    assert(
      event.fileToolSnapshot.toolUseId === event.identity?.toolUseId,
      `file tool event ${event.id} must keep toolUseId aligned with identity`,
    )
  }

  if (event.attachmentSnapshot) {
    assert(
      typeof event.attachmentSnapshot.name === 'string' &&
        event.attachmentSnapshot.name,
      `attachment event ${event.id} must expose name`,
    )
    assert(
      typeof event.attachmentSnapshot.status === 'string' &&
        event.attachmentSnapshot.status,
      `attachment event ${event.id} must expose status`,
    )
    assert(
      typeof event.attachmentSnapshot.safety === 'string' &&
        event.attachmentSnapshot.safety,
      `attachment event ${event.id} must expose safety`,
    )
  }

  if (event.attachmentSnapshots) {
    assert(
      Array.isArray(event.attachmentSnapshots) &&
        event.attachmentSnapshots.length > 0,
      `message event ${event.id} must expose attachment snapshot list`,
    )
    for (const attachment of event.attachmentSnapshots) {
      assert(
        typeof attachment.name === 'string' && attachment.name,
        `message attachment ${event.id} must expose name`,
      )
      assert(
        typeof attachment.status === 'string' && attachment.status,
        `message attachment ${event.id} must expose status`,
      )
      assert(
        typeof attachment.source === 'string' && attachment.source,
        `message attachment ${event.id} must expose source`,
      )
      assert(
        typeof attachment.safety === 'string' && attachment.safety,
        `message attachment ${event.id} must expose safety`,
      )
    }
    assert(
      !JSON.stringify(event.attachmentSnapshots).includes('base64,'),
      `message attachment ${event.id} must not inline encoded payloads`,
    )
  }

  if (event.referenceSnapshot) {
    assert(
      typeof event.referenceSnapshot.kind === 'string' &&
        event.referenceSnapshot.kind,
      `reference event ${event.id} must expose kind`,
    )
    assert(
      Boolean(event.referenceSnapshot.path || event.referenceSnapshot.url),
      `reference event ${event.id} must expose path or url`,
    )
    assert(
      typeof event.referenceSnapshot.safety === 'string' &&
        event.referenceSnapshot.safety,
      `reference event ${event.id} must expose safety`,
    )
  }
}

const shellError = events.find(
  event => event.toolSnapshot?.errorClass === 'shell_unavailable',
)
assert(
  shellError?.toolSnapshot?.actionableHint,
  'shell unavailable errors must include an actionable hint',
)
assert(
  shellError?.toolSnapshot?.actionableHint?.includes('PowerShell') &&
    shellError.toolSnapshot.actionableHint.includes('不需要为了 ls 强行安装 Bash'),
  'shell unavailable hint should guide Windows users to PowerShell/CMD/file tools',
)

await assertToolErrorClassifications()

assert(
  events.some(event => event.toolSnapshot?.name === 'Write' && event.fileSnapshot),
  'Write tool events should carry a normalized file snapshot',
)

const userAttachmentEvent = events.find(
  event => event.id === 'fixture-user-attachment-1',
)
assert(
  userAttachmentEvent?.attachmentSnapshots?.length >= 2,
  'user messages should carry multiple normalized attachment snapshots',
)
assert(
  userAttachmentEvent.attachmentSnapshots.some(
    attachment => attachment.previewKind === 'image',
  ) &&
    userAttachmentEvent.attachmentSnapshots.some(
      attachment => attachment.previewKind === 'text',
    ),
  'user message attachment snapshots should preserve image and text preview kinds',
)

const toolMediaEvent = events.find(
  event => event.id === 'fixture-tool-media-output',
)
assert(
  toolMediaEvent?.toolSnapshot?.name === 'Browser' &&
    toolMediaEvent.attachmentSnapshots?.some(
      attachment => attachment.source === 'Browser',
    ),
  'tool output media should carry normalized attachment snapshots',
)
assert(
  events.some(
    event =>
      event.toolSnapshot?.name === 'Write' &&
      event.fileToolSnapshot?.operation === 'write',
  ),
  'Write tool events should carry a normalized file tool snapshot',
)

assert(
  events.some(event => event.toolSnapshot?.name === 'Read' && event.fileSnapshot),
  'Read tool events should carry a normalized file snapshot',
)
assert(
  events.some(
    event =>
      event.toolSnapshot?.name === 'Read' &&
      event.fileToolSnapshot?.operation === 'read',
  ),
  'Read tool events should carry a normalized file tool snapshot',
)

const writeToolEvents = events.filter(
  event => event.toolSnapshot?.name === 'Write' && event.type === 'tool_call',
)
const writeToolUseIds = new Set(
  writeToolEvents.map(event => event.identity?.toolUseId).filter(Boolean),
)
assert(
  writeToolEvents.length >= 2 && writeToolUseIds.size >= 2,
  'multiple Write calls must remain separate tool cards with distinct toolUseId values',
)
assert(
  writeToolEvents.every(
    event => event.fileToolSnapshot?.toolUseId === event.identity?.toolUseId,
  ),
  'multiple Write file tool snapshots must stay bound by toolUseId, not by path',
)

assert(
  events.some(
    event => event.toolSnapshot?.name === 'Grep' && event.referenceSnapshot,
  ),
  'Grep tool events should carry a normalized reference snapshot',
)
assert(
  events.some(
    event =>
      event.toolSnapshot?.name === 'Grep' &&
      event.fileToolSnapshot?.operation === 'search',
  ),
  'Grep tool events should carry a normalized search file tool snapshot',
)

assert(
  fixture.permission?.permissionRequestId,
  'permission fixture must include permissionRequestId',
)
assert(fixture.permission?.toolUseId, 'permission fixture must include toolUseId')
assert(
  fixture.permission?.interactionKind === 'shell_permission',
  'Bash permission fixture must be classified as shell_permission',
)
assert(
  typeof fixture.permission?.input?.command === 'string' &&
    fixture.permission.input.command.includes('desktop:build'),
  'Bash permission fixture must include a command',
)
assert(
  Array.isArray(fixture.permission?.permissionSuggestions) &&
    fixture.permission.permissionSuggestions.length > 0,
  'Bash permission fixture should include permission suggestions',
)

assert(
  fixture.askUserQuestionPermission?.interactionKind === 'ask_user_question',
  'AskUserQuestion permission fixture must be classified as ask_user_question',
)
assert(
  Array.isArray(fixture.askUserQuestionPermission?.input?.questions) &&
    fixture.askUserQuestionPermission.input.questions.length > 0,
  'AskUserQuestion permission fixture must include questions',
)

assert(
  fixture.planApprovalPermission?.interactionKind === 'plan_approval',
  'ExitPlanMode permission fixture must be classified as plan_approval',
)
assert(
  typeof fixture.planApprovalPermission?.input?.plan === 'string' &&
    fixture.planApprovalPermission.input.plan.includes('实施计划'),
  'ExitPlanMode permission fixture must include plan content',
)
assert(
  Array.isArray(fixture.planApprovalPermission?.input?.allowedPrompts),
  'ExitPlanMode permission fixture should preserve allowedPrompts',
)
assert(
  fixture.enterPlanModePermission?.interactionKind === 'enter_plan_mode',
  'EnterPlanMode permission fixture must be classified as enter_plan_mode',
)

assert(
  fixture.webFetchPermission?.interactionKind === 'web_fetch',
  'WebFetch permission fixture must be classified as web_fetch',
)
assert(
  typeof fixture.webFetchPermission?.input?.url === 'string' &&
    fixture.webFetchPermission.input.url.includes('example.com'),
  'WebFetch permission fixture must include target url',
)
assert(
  Array.isArray(fixture.webFetchPermission?.permissionSuggestions) &&
    fixture.webFetchPermission.permissionSuggestions.some(suggestion =>
      suggestion?.rules?.some(rule => rule?.ruleContent === 'domain:example.com'),
    ),
  'WebFetch permission fixture should preserve domain allow suggestion',
)

assert(
  fixture.skillPermission?.interactionKind === 'skill',
  'Skill permission fixture must be classified as skill',
)
assert(
  fixture.skillPermission?.input?.skill === 'repo-source-reader',
  'Skill permission fixture must include skill name',
)
assert(
  Array.isArray(fixture.skillPermission?.permissionSuggestions) &&
    fixture.skillPermission.permissionSuggestions.length > 0,
  'Skill permission fixture should include permission suggestions',
)

assert(
  fixture.reviewArtifactPermission?.interactionKind === 'review_artifact',
  'ReviewArtifact permission fixture must be classified as review_artifact',
)
assert(
  fixture.workflowPermission?.interactionKind === 'workflow',
  'Workflow permission fixture must be classified as workflow',
)
assert(
  fixture.monitorPermission?.interactionKind === 'monitor',
  'Monitor permission fixture must be classified as monitor',
)

console.log('smoke-desktop-display-events: ok')

async function assertToolErrorClassifications() {
  const tempDir = join(repoRoot, '.tmp', 'smoke-desktop-display-events')
  const entryPath = join(tempDir, 'entry.ts')
  const outputPath = join(tempDir, 'entry.mjs')

  await rm(tempDir, { recursive: true, force: true })
  await mkdir(tempDir, { recursive: true })
  await writeFile(
    entryPath,
    `
      import assert from 'node:assert/strict'
      import { readFile } from 'node:fs/promises'
      import { createDisplayEventFromCompletedItem, createErrorDisplayEvent } from '../../apps/desktop/src/renderer/src/domain/displayEvents.ts'
      import { resolveMessageAvatar } from '../../apps/desktop/src/renderer/src/domain/avatarEvents.ts'
      import { extractAttachmentSnapshotsFromContentBlocks, isGlobPatternPath } from '../../apps/desktop/src/renderer/src/domain/fileEvents.ts'
      import { routeDesktopEvent } from '../../apps/desktop/src/renderer/src/app/notificationRouter.ts'
      import { getAttachmentActionPath, getAttachmentImagePreviewSrc } from '../../apps/desktop/src/renderer/src/components/chat/AttachmentImagePreview.tsx'
      import { getVisibleTimelineEvents } from '../../apps/desktop/src/renderer/src/components/chat/ChatTimeline.tsx'
      import { getConfirmDialogToneClass } from '../../apps/desktop/src/renderer/src/components/common/ConfirmDialog.tsx'
      import { createToolDetailBlocks, getToolMetaItems } from '../../apps/desktop/src/renderer/src/components/chat/ToolCard.tsx'
      import { createErrorDiagnostics, getErrorActionViewModels, getPolicyBoundaryHint, getPolicyBoundaryLabel, getQuotaHint, getRateLimitHint } from '../../apps/desktop/src/renderer/src/components/chat/ErrorCard.tsx'
      import { formatInstalledRecord, formatManifest, formatMcpScopeLabel, formatServerSubtitle, formatToolAnnotations, getCandidateInstallState, getCandidateKey, getServerStatusLabel, getServerTone, mergeMcpServers, normalizeMcpState } from '../../apps/desktop/src/renderer/src/components/pages/McpPage.tsx'
      import { coreEventToJsonRpcNotification, coreEventToThreadDisplayPatchNotification } from '../../src/app-server/coreEventMapper.ts'
      import { enrichToolResultReplayContentWithGeneratedOutputs } from '../../src/app-server/threadReplayContent.ts'
      import { projectThreadDisplayItem } from '../../src/display/threadDisplayProjection.ts'
      import { collectOpenAiResponsesImageGenerationCalls } from '../../src/services/llm/protocols/openaiResponsesImageGenerationCalls.ts'
      import { createCcrErrorSnapshot } from '../../src/types/errorSnapshot.ts'
      import { persistGeneratedArtifactFromBase64, prepareGeneratedImageCallForModelReplay, sanitizeGeneratedArtifactsForResume, shouldIncludeGeneratedImageResultForReplay } from '../../src/utils/generatedArtifacts.ts'
      import { stripToolTimingMetadataFromContentBlock } from '../../src/utils/toolTimingMetadata.ts'

      const generatedArtifactsHome = ${JSON.stringify(join(tempDir, 'generated-artifacts-home'))}

      assert.equal(getConfirmDialogToneClass('warning'), 'confirm-dialog--warning')
      assert.equal(getConfirmDialogToneClass('danger'), 'confirm-dialog--danger')

      const compactTimelineEvents = getVisibleTimelineEvents([
        {
          id: 'compact-status',
          type: 'system_notice',
          text: '上下文已压缩。',
          sourceKind: 'context_compaction',
        },
        {
          id: 'raw-compact-boundary',
          type: 'system_notice',
          text: 'Conversation compacted',
        },
        {
          id: 'compact-attachment-index',
          type: 'system_notice',
          text: '附件：index.html',
          attachmentSnapshots: [{ id: 'index-html', name: 'index.html' }],
        },
        {
          id: 'compact-attachment-style',
          type: 'system_notice',
          text: 'Attachment: css\\\\style.css',
          attachmentSnapshots: [{ id: 'style-css', name: 'css\\\\style.css' }],
        },
        {
          id: 'next-message',
          type: 'assistant_message',
          text: '继续处理。',
        },
      ])
      assert.deepEqual(
        compactTimelineEvents.map(event => event.id),
        ['compact-status', 'next-message'],
        'compact timeline should keep only the compact status and later conversation',
      )

      const namedTodoReminderEvent = createDisplayEventFromCompletedItem(
        'fixture-named-todo-reminder',
        'assistant_message',
        [
          {
            type: 'attachment',
            attachment: {
              name: 'todo_reminder',
              content: [],
              itemCount: 0,
            },
          },
        ],
        'completed',
      )
      assert.equal(
        namedTodoReminderEvent,
        null,
        'named todo_reminder attachment must not render as a visible assistant message',
      )

      const discoverSkillsEvent = createDisplayEventFromCompletedItem(
        'fixture-discover-skills',
        'tool_call',
        [
          {
            type: 'tool_use',
            name: 'DiscoverSkills',
            id: 'toolu_discover_skills',
            input: {
              query: 'documentation',
            },
          },
        ],
        'completed',
      )
      assert.equal(
        discoverSkillsEvent?.toolSnapshot?.displayName,
        '发现技能',
        'DiscoverSkills should use localized display name',
      )
      assert.equal(
        discoverSkillsEvent?.toolSnapshot?.category,
        'agent',
        'DiscoverSkills should be classified as an agent skill discovery tool',
      )
      const discoverSkillsAvatar = resolveMessageAvatar(discoverSkillsEvent)
      assert.equal(
        discoverSkillsAvatar.icon,
        'search',
        'DiscoverSkills avatar should use a discovery/search icon instead of fallback help',
      )
      assert.equal(discoverSkillsAvatar.label, '技')
      assert.equal(discoverSkillsAvatar.title, '发现技能')

      for (const attachment of [
        {
          type: 'skill_listing',
          content: 'docs-update-helper - update docs',
          skillCount: 1,
          isInitial: false,
        },
        {
          type: 'skill_discovery',
          skills: [{ name: 'docs-update-helper', description: 'update docs' }],
          signal: 'task',
          source: 'native',
        },
        {
          type: 'dynamic_skill',
          skillDir: 'D:/repo/.claude/skills',
          skillNames: ['docs-update-helper'],
          displayPath: '.claude/skills',
        },
      ]) {
        const skillContextAttachments = extractAttachmentSnapshotsFromContentBlocks({
          eventId: 'fixture-skill-context-attachment',
          blocks: [{ type: 'attachment', attachment }],
          source: 'ToolResult',
        })
        assert.deepEqual(
          skillContextAttachments,
          [],
          String(attachment.type) + ' context attachment must not render as a file attachment',
        )
      }

      for (const type of ['image', 'file', 'audio', 'video']) {
        const inlineToolMediaAttachments = extractAttachmentSnapshotsFromContentBlocks({
          eventId: 'fixture-inline-tool-media-' + type,
          blocks: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_inline_media',
              content: [
                {
                  type,
                  source: {
                    type: 'base64',
                    media_type:
                      type === 'image' ? 'image/png' : 'application/octet-stream',
                    data: 'inline-media-data',
                  },
                },
              ],
            },
          ],
          source: 'ToolResult',
        })
        assert.deepEqual(
          inlineToolMediaAttachments,
          [],
          type + ' inline tool media must be supplied by ThreadDisplay projection instead of renderer inference',
        )
      }

      const skillListingProjection = projectThreadDisplayItem({
        id: 'fixture-skill-listing-projection',
        type: 'assistant_message',
        sourceKind: 'assistant_message',
        status: 'completed',
        text: '',
        contentBlocks: [
          {
            type: 'attachment',
            attachment: {
              type: 'skill_listing',
              content: 'docs-update-helper - update docs',
              skillCount: 1,
              isInitial: false,
            },
          },
        ],
      })
      assert.equal(
        skillListingProjection,
        undefined,
        'projected skill_listing attachment must not render as a visible attachment card',
      )

      const namedTodoReminderProjection = projectThreadDisplayItem({
        id: 'fixture-named-todo-reminder-projection',
        type: 'assistant_message',
        sourceKind: 'assistant_message',
        status: 'completed',
        text: '',
        contentBlocks: [
          {
            type: 'attachment',
            attachment: {
              name: 'todo_reminder',
              content: [],
              itemCount: 0,
            },
          },
        ],
      })
      assert.equal(
        namedTodoReminderProjection,
        undefined,
        'named todo_reminder attachment must not produce a thread display projection',
      )

      const reasoningOnlyEvent = createDisplayEventFromCompletedItem(
        'fixture-reasoning-only-assistant',
        'assistant_message',
        [{ type: 'reasoning', text: '内部推理，不应直接展示' }],
        'completed',
      )
      assert.equal(reasoningOnlyEvent?.type, 'system_notice')
      assert.equal(
        reasoningOnlyEvent?.text,
        '模型只返回了推理内容，未返回最终回复。',
      )
      assert.equal(
        reasoningOnlyEvent?.text.includes('内部推理'),
        false,
        'reasoning-only fallback must not expose hidden reasoning content',
      )

      const reasoningOnlyProjection = projectThreadDisplayItem({
        id: 'fixture-reasoning-only-projection',
        type: 'assistant_message',
        sourceKind: 'assistant_message',
        status: 'completed',
        text: '',
        content: [{ type: 'reasoning', text: '内部推理，不应直接展示' }],
      })
      assert.equal(reasoningOnlyProjection?.event.type, 'system_notice')
      assert.equal(
        reasoningOnlyProjection?.event.text,
        '模型只返回了推理内容，未返回最终回复。',
      )
      assert.equal(
        reasoningOnlyProjection?.event.text.includes('内部推理'),
        false,
        'projection fallback must not expose hidden reasoning content',
      )

      const reasoningDeltaPatch = coreEventToThreadDisplayPatchNotification({
        type: 'item_delta',
        threadId: 'thread_fixture',
        turnId: 'turn_reasoning_only',
        itemId: 'item_reasoning_delta',
        delta: {
          type: 'reasoning',
          text: 'DeepSeek streaming reasoning delta',
        },
      })
      assert.equal(
        reasoningDeltaPatch,
        null,
        'reasoning deltas must not be sent to Desktop display patches',
      )

      const reasoningOnlyCompletedPatch = coreEventToThreadDisplayPatchNotification({
        type: 'item_completed',
        threadId: 'thread_fixture',
        turnId: 'turn_reasoning_only',
        itemId: 'item_reasoning_completed',
        kind: 'assistant_message',
        status: 'completed',
        content: [
          {
            type: 'reasoning',
            text: 'DeepSeek completed reasoning content',
          },
        ],
      })
      assert.equal(reasoningOnlyCompletedPatch?.method, 'thread/display/patch')
      const reasoningCompletedItem =
        reasoningOnlyCompletedPatch?.params.operations?.[0]?.item
      assert.equal(reasoningCompletedItem?.type, 'system_notice')
      assert.equal(
        reasoningCompletedItem?.text,
        '模型只返回了推理内容，未返回最终回复。',
      )
      assert.equal(
        JSON.stringify(reasoningCompletedItem).includes(
          'DeepSeek completed reasoning content',
        ),
        false,
        'reasoning-only completed patch must not send hidden reasoning to Desktop',
      )

      const providerError = createErrorDisplayEvent(
        'fixture-provider-auth-error',
        'DeepSeek API key is missing. Set CCR_DEEPSEEK_API_KEY or DEEPSEEK_API_KEY.',
      )
      assert.equal(providerError.errorSnapshot?.category, 'auth_expired')
      assert.equal(providerError.errorSnapshot?.recommendedActions?.includes('reauth'), true)

      const imagePrompt = '一张真实自然的纪实摄影风格图片：中国国内小学操场上的小学生足球比赛'
      const generateImageToolEvent = createDisplayEventFromCompletedItem(
        'fixture-generate-image-tool-call',
        'assistant_message',
        [
          {
            type: 'tool_use',
            id: 'toolu_generate_image',
            name: 'GenerateImage',
            input: {
              prompt: imagePrompt,
            },
          },
        ],
        'running',
        {
          itemId: 'fixture-generate-image-tool-call',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          toolUseId: 'toolu_generate_image',
        },
      )
      assert.equal(generateImageToolEvent?.toolSnapshot?.summary, \`生成图片：\${imagePrompt}\`)
      assert.equal(generateImageToolEvent?.toolSnapshot?.category, 'media')
      assert.equal(generateImageToolEvent?.toolSnapshot?.target, imagePrompt)
      assert.equal(
        getToolMetaItems(generateImageToolEvent.toolSnapshot).some(item => item.label === '目标'),
        false,
      )

      const taskOutputToolEvent = createDisplayEventFromCompletedItem(
        'fixture-task-output-tool-call',
        'assistant_message',
        [
          {
            type: 'tool_use',
            id: 'toolu_task_output',
            name: 'TaskOutput',
            input: {
              task_id: 'task_123',
            },
          },
        ],
        'running',
        {
          itemId: 'fixture-task-output-tool-call',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          toolUseId: 'toolu_task_output',
        },
      )
      assert.equal(taskOutputToolEvent?.toolSnapshot?.displayName, '后台任务输出')
      assert.equal(taskOutputToolEvent?.toolSnapshot?.category, 'agent')
      assert.equal(taskOutputToolEvent?.toolSnapshot?.summary, '后台任务输出：任务=task_123')
      const taskOutputSnapshot = taskOutputToolEvent?.toolSnapshot
      assert.ok(taskOutputToolEvent)
      assert.ok(taskOutputSnapshot)
      const taskOutputDetails = createToolDetailBlocks(taskOutputSnapshot, taskOutputToolEvent)
      const taskOutputInputDetail = taskOutputDetails.find(block => block.kind === 'input')
      assert.equal(taskOutputInputDetail?.title, '关键参数')
      assert.deepEqual(taskOutputInputDetail?.value, { task_id: 'task_123' })

      const mcpToolEvent = createDisplayEventFromCompletedItem(
        'fixture-mcp-tool-call',
        'assistant_message',
        [
          {
            type: 'tool_use',
            id: 'toolu_mcp_demo_search',
            name: 'mcp__demo__search',
            durationMs: 1234,
            input: {
              query: 'release notes',
            },
          },
        ],
        'running',
        {
          itemId: 'fixture-mcp-tool-call',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          toolUseId: 'toolu_mcp_demo_search',
        },
      )
      assert.equal(mcpToolEvent?.toolSnapshot?.displayName, 'MCP demo / search')
      assert.equal(mcpToolEvent?.toolSnapshot?.category, 'mcp')
      assert.equal(mcpToolEvent?.toolSnapshot?.summary, 'MCP demo / search：release notes')
      assert.equal(mcpToolEvent?.toolSnapshot?.durationMs, 1234)

      const mcpProgressEvent = createDisplayEventFromCompletedItem(
        'fixture-mcp-progress',
        'assistant_message',
        [
          {
            type: 'progress',
            data: {
              type: 'mcp_progress',
              status: 'failed',
              serverName: 'demo',
              toolName: 'search',
              elapsedTimeMs: 3800,
            },
          },
        ],
        'running',
        {
          itemId: 'fixture-mcp-progress',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
        },
      )
      assert.equal(mcpProgressEvent?.toolSnapshot?.displayName, 'MCP demo / search')
      assert.equal(mcpProgressEvent?.toolSnapshot?.category, 'mcp')
      assert.equal(mcpProgressEvent?.toolSnapshot?.summary, 'MCP demo / search：failed')
      assert.equal(mcpProgressEvent?.toolSnapshot?.durationMs, 3800)

      assert.equal(isGlobPatternPath('**/*'), true)
      const globPatternEvent = createDisplayEventFromCompletedItem(
        'fixture-glob-pattern-tool-call',
        'assistant_message',
        [
          {
            type: 'tool_use',
            id: 'toolu_glob_pattern',
            name: 'Glob',
            input: {
              glob: '**/*',
            },
          },
        ],
        'completed',
        {
          itemId: 'fixture-glob-pattern-tool-call',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          toolUseId: 'toolu_glob_pattern',
        },
      )
      assert.deepEqual(globPatternEvent?.fileToolSnapshot?.actions, ['copyReference'])
      assert.equal(globPatternEvent?.referenceSnapshot?.path, '**/*')

      const legacyCompletedNotification = coreEventToJsonRpcNotification({
        type: 'item_completed',
        threadId: 'thread_fixture',
        turnId: 'turn_fixture',
        itemId: 'fixture-mapped-timed-item',
        status: 'completed',
        content: [{ type: 'text', text: 'ok' }],
        startedAt: '2026-05-22T08:20:00.000Z',
        completedAt: '2026-05-22T08:20:01.250Z',
        durationMs: 1250,
      })
      assert.equal(legacyCompletedNotification, null)

      const mappedCompletedPatch = coreEventToThreadDisplayPatchNotification({
        type: 'item_completed',
        threadId: 'thread_fixture',
        turnId: 'turn_fixture',
        itemId: 'fixture-routed-timed-read',
        status: 'completed',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_routed_timed_read',
            name: 'Read',
            input: { file_path: 'README.md' },
          },
        ],
        startedAt: '2026-05-22T08:10:00.000Z',
        completedAt: '2026-05-22T08:10:02.500Z',
        durationMs: 2500,
      })
      assert.equal(mappedCompletedPatch?.method, 'thread/display/patch')
      const routedToolCompleted = routeDesktopEvent(
        {
          type: 'notification',
          at: '2026-05-22T08:10:02.500Z',
          status: null,
          payload: mappedCompletedPatch,
        },
        new Map(),
      )
      const routedToolAction = routedToolCompleted.sessionActions[0]
      assert.equal(routedToolAction.context?.item?.metadata?.completedAt, '2026-05-22T08:10:02.500Z')
      const routedTimedToolEvent = createDisplayEventFromCompletedItem(
        routedToolAction.itemId,
        routedToolAction.kind,
        routedToolAction.content,
        routedToolAction.statusText,
        routedToolAction.context,
      )
      assert.equal(routedTimedToolEvent?.toolSnapshot?.durationMs, 2500)

      const compactStartedPatch = coreEventToThreadDisplayPatchNotification({
        type: 'context_compaction_started',
        threadId: 'thread_fixture',
        turnId: 'turn_fixture',
        startedAt: '2026-05-22T08:30:00.000Z',
        trigger: 'auto',
      })
      assert.equal(compactStartedPatch?.method, 'thread/display/patch')
      const routedCompactStarted = routeDesktopEvent(
        {
          type: 'notification',
          at: '2026-05-22T08:30:00.000Z',
          status: null,
          payload: compactStartedPatch,
        },
        new Map(),
      )
      const compactStartedAction = routedCompactStarted.sessionActions[0]
      const compactStartedEvent = createDisplayEventFromCompletedItem(
        compactStartedAction.itemId,
        compactStartedAction.kind,
        compactStartedAction.content,
        compactStartedAction.statusText,
        compactStartedAction.context,
      )
      assert.equal(compactStartedEvent?.sourceKind, 'context_compaction')
      assert.equal(compactStartedEvent?.status, 'running')
      assert.equal(compactStartedEvent?.compactSnapshot?.status, 'running')
      assert.equal(compactStartedEvent?.compactSnapshot?.trigger, 'auto')

      const compactedPatch = coreEventToThreadDisplayPatchNotification({
        type: 'context_compacted',
        threadId: 'thread_fixture',
        compactedAt: '2026-05-22T08:30:05.000Z',
        result: {
          preCompactTokenCount: 163820,
          postCompactTokenCount: 152840,
          truePostCompactTokenCount: 7680,
          summaryMessageCount: 1,
          attachmentCount: 5,
          hookResultCount: 0,
        },
      })
      assert.equal(compactedPatch?.method, 'thread/display/patch')
      const routedCompacted = routeDesktopEvent(
        {
          type: 'notification',
          at: '2026-05-22T08:30:05.000Z',
          status: null,
          payload: compactedPatch,
        },
        new Map(),
      )
      const compactedAction = routedCompacted.sessionActions[0]
      const compactedEvent = createDisplayEventFromCompletedItem(
        compactedAction.itemId,
        compactedAction.kind,
        compactedAction.content,
        compactedAction.statusText,
        compactedAction.context,
      )
      assert.equal(compactedEvent?.sourceKind, 'context_compaction')
      assert.equal(compactedEvent?.status, 'completed')
      assert.equal(compactedEvent?.compactSnapshot?.truePostCompactTokenCount, 7680)
      assert.equal(compactedEvent?.text.includes('preCompactTokenCount'), false)
      assert.equal(compactedEvent?.text.includes('{'), false)

      const todoWritePatch = coreEventToThreadDisplayPatchNotification({
        type: 'item_completed',
        threadId: 'thread_fixture',
        turnId: 'turn_fixture_todo_overlay',
        itemId: 'fixture-todowrite-live',
        kind: 'assistant_message',
        status: 'completed',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_todowrite_live',
            name: 'TodoWrite',
            input: {
              todos: [
                {
                  content: '修复一个问题',
                  status: 'in_progress',
                  activeForm: '正在修复一个问题',
                },
              ],
            },
          },
        ],
      })
      const routedTodoWrite = routeDesktopEvent(
        {
          type: 'notification',
          at: '2026-05-22T09:20:00.000Z',
          status: null,
          payload: todoWritePatch,
        },
        new Map(),
      )
      const todoWriteAction = routedTodoWrite.sessionActions[0]
      const todoWriteEvent = createDisplayEventFromCompletedItem(
        todoWriteAction.itemId,
        todoWriteAction.kind,
        todoWriteAction.content,
        todoWriteAction.statusText,
        todoWriteAction.context,
      )
      assert.equal(todoWriteEvent?.type, 'todo_list')
      assert.equal(todoWriteEvent?.todoSnapshot?.identity?.turnId, 'turn_fixture_todo_overlay')

      const timedToolResultEvent = createDisplayEventFromCompletedItem(
        'fixture-timed-tool-result',
        'tool_result',
        [
          {
            type: 'tool_result',
            name: 'Read',
            tool_use_id: 'toolu_timed_result',
            content: 'ok',
            durationMs: 2150,
            startedAt: '2026-05-22T08:00:00.000Z',
            completedAt: '2026-05-22T08:00:02.150Z',
          },
        ],
        'completed',
        {
          itemId: 'fixture-timed-tool-result',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          toolUseId: 'toolu_timed_result',
        },
      )
      assert.equal(timedToolResultEvent?.toolSnapshot?.durationMs, 2150)
      assert.equal(timedToolResultEvent?.toolSnapshot?.startedAt, '2026-05-22T08:00:00.000Z')
      assert.equal(timedToolResultEvent?.toolSnapshot?.completedAt, '2026-05-22T08:00:02.150Z')

      const sanitizedToolResultBlock = stripToolTimingMetadataFromContentBlock({
        type: 'tool_result',
        tool_use_id: 'toolu_timed_result',
        content: 'ok',
        durationMs: 2150,
        startedAt: '2026-05-22T08:00:00.000Z',
        completedAt: '2026-05-22T08:00:02.150Z',
      })
      const sanitizedToolResultJson = JSON.stringify(sanitizedToolResultBlock)
      assert.equal(sanitizedToolResultJson.includes('tool_result'), true)
      assert.equal(sanitizedToolResultJson.includes('durationMs'), false)
      assert.equal(sanitizedToolResultJson.includes('startedAt'), false)
      assert.equal(sanitizedToolResultJson.includes('completedAt'), false)

      const normalizedMcpState = normalizeMcpState(null)
      assert.deepEqual(normalizedMcpState.servers, [])
      assert.deepEqual(normalizedMcpState.errors, [])

      const mergedMcpServers = mergeMcpServers(
        {
          servers: [
            {
              name: 'browser',
              scope: 'user',
              transport: 'stdio',
              source: 'user',
              enabled: true,
              command: 'node',
              args: ['server.js'],
              tools: [
                {
                  name: 'click',
                  description: 'Click a locator',
                  annotations: { readOnly: false, destructive: true },
                },
              ],
            },
            {
              name: 'aaa_disabled',
              scope: 'user',
              transport: 'stdio',
              source: 'user',
              enabled: false,
              command: 'node',
              args: ['disabled.js'],
              tools: [],
            },
          ],
          inventory: {
            servers: [
              {
                name: 'browser',
                sourceId: 'user-file',
                scope: 'user',
                transport: 'stdio',
                installKind: 'stdio-npm-package',
                configPath: 'C:/tmp/mcp.json',
                writePath: 'C:/tmp/mcp.json',
                enabled: true,
                active: true,
                suppressed: false,
              },
              {
                name: 'shadowed',
                sourceId: 'project',
                scope: 'project',
                transport: 'stdio',
                installKind: 'manual-config',
                configPath: 'C:/tmp/.mcp.json',
                writePath: 'C:/tmp/.mcp.json',
                enabled: true,
                active: false,
                suppressed: true,
                suppressionReason: 'shadowed_by_local',
              },
            ],
          },
          errors: [],
        },
        {
          installed: [
            {
              name: 'browser',
              scope: 'user',
              updatedAt: '2026-05-21T00:00:00.000Z',
              manifest: {
                name: 'browser',
                kind: 'stdio-npm-package',
                transport: 'stdio',
              },
              packageDir: 'C:/tmp/pkg',
              packageOwnerMarkerPath: 'C:/tmp/pkg/.ccr-mcp-install.json',
              lockKey: 'browser',
            },
          ],
        },
      )
      const browserMcpServer = mergedMcpServers.find(server => server.name === 'browser')
      const disabledMcpServer = mergedMcpServers.find(server => server.name === 'aaa_disabled')
      const shadowedMcpServer = mergedMcpServers.find(server => server.name === 'shadowed')
      assert.ok(browserMcpServer)
      assert.ok(disabledMcpServer)
      assert.ok(shadowedMcpServer)
      assert.ok(
        mergedMcpServers.findIndex(server => server.name === 'browser') <
          mergedMcpServers.findIndex(server => server.name === 'aaa_disabled'),
      )
      assert.equal(browserMcpServer?.installed?.packageOwnerMarkerPath, 'C:/tmp/pkg/.ccr-mcp-install.json')
      assert.equal(browserMcpServer?.installKind, 'stdio-npm-package')
      assert.equal(formatMcpScopeLabel('user'), '用户全局')
      assert.equal(formatMcpScopeLabel('project'), '项目共享')
      assert.equal(formatServerSubtitle(browserMcpServer!), '用户全局 · stdio · user')
      assert.equal(getServerStatusLabel(browserMcpServer!), 'active')
      assert.equal(getServerTone(browserMcpServer!), 'success')
      assert.equal(getServerStatusLabel(shadowedMcpServer!), '被覆盖')
      assert.equal(getServerTone(shadowedMcpServer!), 'warning')
      assert.equal(formatToolAnnotations(browserMcpServer?.tools?.[0] ?? {}), '破坏性')
      assert.equal(
        formatInstalledRecord(browserMcpServer!.installed!),
        '用户全局 · stdio-npm-package · stdio · 2026-05-21T00:00:00.000Z',
      )
      assert.equal(
        formatManifest({
          name: 'browser',
          kind: 'stdio-npm-package',
          transport: 'stdio',
          version: '1.2.3',
        }),
        'stdio-npm-package · stdio · 1.2.3',
      )
      assert.equal(
        getCandidateKey({
          displayName: 'Browser MCP',
          manifest: {
            name: 'browser',
            kind: 'stdio-npm-package',
            transport: 'stdio',
            version: '1.2.3',
          },
        }),
        'browser:stdio-npm-package:1.2.3:Browser MCP',
      )
      assert.deepEqual(
        getCandidateInstallState(
          {
            displayName: 'Browser MCP',
            manifest: {
              name: 'browser',
              kind: 'stdio-npm-package',
              transport: 'stdio',
            },
            manifestInput: {
              name: 'browser',
            },
          },
          mergedMcpServers,
          {
            installed: [
              {
                name: 'browser',
                scope: 'user',
              },
            ],
          },
        ),
        {
          blocked: true,
          label: '已安装',
          message: '已由 CCR 安装在 用户全局。',
          name: 'browser',
        },
      )
      assert.deepEqual(
        getCandidateInstallState(
          {
            displayName: 'Shadowed MCP',
            manifest: {
              name: 'shadowed',
              kind: 'manual-config',
              transport: 'stdio',
            },
            manifestInput: {
              name: 'shadowed',
            },
          },
          mergedMcpServers,
          { installed: [] },
        ),
        {
          blocked: true,
          label: '已配置',
          message: '已在 项目共享 配置。',
          name: 'shadowed',
        },
      )
      assert.deepEqual(
        getCandidateInstallState(
          {
            displayName: 'New MCP',
            manifest: {
              name: 'new-mcp',
              kind: 'stdio-npm-package',
              transport: 'stdio',
            },
            manifestInput: {
              name: 'new-mcp',
            },
          },
          mergedMcpServers,
          { installed: [] },
        ),
        {
          blocked: false,
          label: '安装',
          message: '',
          name: 'new-mcp',
        },
      )

      const webFetchToolEvent = createDisplayEventFromCompletedItem(
        'fixture-web-fetch-tool-call',
        'assistant_message',
        [
          {
            type: 'tool_use',
            id: 'toolu_web_fetch',
            name: 'WebFetch',
            input: {
              url: 'https://example.com/docs',
              prompt: '摘要这个页面',
            },
          },
        ],
        'running',
        {
          itemId: 'fixture-web-fetch-tool-call',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          toolUseId: 'toolu_web_fetch',
        },
      )
      assert.equal(webFetchToolEvent?.toolSnapshot?.displayName, '读取网页')
      assert.equal(webFetchToolEvent?.toolSnapshot?.category, 'web')
      assert.equal(
        webFetchToolEvent?.toolSnapshot?.summary,
        '读取网页：网址=https://example.com/docs · 提示=摘要这个页面',
      )

      const toolSearchToolEvent = createDisplayEventFromCompletedItem(
        'fixture-tool-search-tool-call',
        'assistant_message',
        [
          {
            type: 'tool_use',
            id: 'toolu_tool_search',
            name: 'ToolSearch',
            input: {
              query: '网页读取工具',
              limit: 3,
            },
          },
        ],
        'running',
        {
          itemId: 'fixture-tool-search-tool-call',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          toolUseId: 'toolu_tool_search',
        },
      )
      assert.equal(toolSearchToolEvent?.toolSnapshot?.displayName, '工具搜索')
      assert.equal(toolSearchToolEvent?.toolSnapshot?.showInMainTimeline, false)
      assert.equal(toolSearchToolEvent?.timelineHidden, true)

      const failedToolSearchToolEvent = createDisplayEventFromCompletedItem(
        'fixture-failed-tool-search-tool-call',
        'assistant_message',
        [
          {
            type: 'tool_use',
            id: 'toolu_failed_tool_search',
            name: 'ToolSearch',
            status: 'failed',
            input: {
              query: '失败时仍应可见',
              limit: 3,
            },
          },
        ],
        'failed',
        {
          itemId: 'fixture-failed-tool-search-tool-call',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          toolUseId: 'toolu_failed_tool_search',
        },
      )
      assert.equal(failedToolSearchToolEvent?.toolSnapshot?.status, 'failed')
      assert.equal(failedToolSearchToolEvent?.toolSnapshot?.showInMainTimeline, false)
      assert.equal(failedToolSearchToolEvent?.timelineHidden, false)

      const sanitizedError = createCcrErrorSnapshot({
        message: 'Provider API request failed: Bearer sk-secretvalue123456',
        source: 'provider',
        safeDetails: {
          authorization: 'Bearer sk-secretvalue123456',
          nested: {
            apiKey: 'sk-secretvalue123456',
          },
        },
      })
      assert.equal(sanitizedError.safeDetails?.authorization, '[REDACTED]')
      assert.equal(sanitizedError.safeDetails?.nested?.apiKey, '[REDACTED]')
      assert.equal(sanitizedError.message.includes('sk-secretvalue123456'), true)

      const rateLimitError = createCcrErrorSnapshot({
        message: 'Provider request failed.',
        error: {
          status: 429,
          error: { type: 'rate_limit_error', message: 'Too many requests.' },
          retry_after: '12',
        },
      })
      assert.equal(rateLimitError.category, 'rate_limited')
      assert.equal(rateLimitError.source, 'provider')
      assert.equal(rateLimitError.retryable, true)
      assert.equal(rateLimitError.retryAfterMs, 12000)
      assert.match(getRateLimitHint(rateLimitError) ?? '', /12s/)

      const quotaError = createCcrErrorSnapshot({
        message: 'Provider request failed.',
        safeDetails: {
          status: 402,
          error: { type: 'insufficient_quota', message: 'Credit balance is too low.' },
          remainingCredits: 0,
          billingState: 'past_due',
        },
      })
      assert.equal(quotaError.category, 'quota_exceeded')
      assert.equal(quotaError.source, 'provider')
      assert.match(getQuotaHint(quotaError) ?? '', /剩余额度 0/)
      assert.match(getQuotaHint(quotaError) ?? '', /账单状态 past_due/)

      const refusalError = createCcrErrorSnapshot({
        message: 'Assistant stopped without normal text.',
        safeDetails: { stopReason: 'refusal' },
      })
      assert.equal(refusalError.category, 'model_refusal')
      assert.equal(getPolicyBoundaryLabel(refusalError), '模型拒答')
      assert.match(getPolicyBoundaryHint(refusalError) ?? '', /模型主动返回拒答信号/)

      const safetyError = createCcrErrorSnapshot({
        message: 'Provider request failed.',
        safeDetails: {
          error: { type: 'content_filter', code: 'safety_blocked' },
        },
      })
      assert.equal(safetyError.category, 'safety_blocked')
      assert.equal(getPolicyBoundaryLabel(safetyError), 'Provider 安全策略')
      assert.match(getPolicyBoundaryHint(safetyError) ?? '', /provider 的内容安全策略/)

      const localSafetyError = createCcrErrorSnapshot({
        message: 'Blocked by CCR local safety policy.',
        source: 'core',
        safeDetails: {
          policySource: 'ccr_local',
          reason: 'workspace boundary',
        },
      })
      assert.equal(localSafetyError.category, 'safety_blocked')
      assert.equal(localSafetyError.source, 'core')
      assert.equal(getPolicyBoundaryLabel(localSafetyError), 'CCR 本地安全策略')
      assert.match(getPolicyBoundaryHint(localSafetyError) ?? '', /本地安全策略/)

      const permissionDeniedError = createCcrErrorSnapshot({
        message: 'Permission denied by user.',
        source: 'tool',
        permissionRequestId: 'perm_fixture',
        safeDetails: {
          errorClass: 'permission_denied',
          status: 'denied',
        },
      })
      assert.equal(permissionDeniedError.category, 'tool_error')
      assert.equal(getPolicyBoundaryLabel(permissionDeniedError), '工具权限拒绝')
      assert.match(getPolicyBoundaryHint(permissionDeniedError) ?? '', /工具没有拿到执行权限/)

      const networkCause = Object.assign(new Error('fetch failed'), {
        code: 'ENOTFOUND',
      })
      const networkError = createCcrErrorSnapshot({
        error: Object.assign(new Error('Connection error.'), {
          cause: networkCause,
        }),
      })
      assert.equal(networkError.category, 'network_error')
      assert.equal(networkError.source, 'network')

      const protocolError = createCcrErrorSnapshot({
        message: 'JSON-RPC request failed.',
        safeDetails: {
          code: -32602,
          kind: 'invalid_params',
          errorType: 'invalid_request_error',
        },
      })
      assert.equal(protocolError.category, 'protocol_error')
      assert.equal(protocolError.source, 'app_server')

      const appServerAuthError = createCcrErrorSnapshot({
        message: 'Authentication is required.',
        source: 'app_server',
        safeDetails: {
          code: -32006,
          kind: 'auth_required',
        },
      })
      assert.equal(appServerAuthError.category, 'auth_expired')
      assert.equal(appServerAuthError.source, 'app_server')

      const unknownError = createCcrErrorSnapshot({
        message: 'Something odd happened without a known code.',
      })
      assert.equal(unknownError.category, 'unknown_error')
      assert.equal(
        unknownError.recommendedActions.includes('open_logs'),
        true,
      )

      const p24ErrorFixtures = [
        {
          name: 'auth',
          snapshot: appServerAuthError,
          category: 'auth_expired',
          source: 'app_server',
        },
        {
          name: 'rate limit',
          snapshot: rateLimitError,
          category: 'rate_limited',
          source: 'provider',
        },
        {
          name: 'quota',
          snapshot: quotaError,
          category: 'quota_exceeded',
          source: 'provider',
        },
        {
          name: 'tool permission',
          snapshot: permissionDeniedError,
          category: 'tool_error',
          source: 'tool',
        },
        {
          name: 'network',
          snapshot: networkError,
          category: 'network_error',
          source: 'network',
        },
        {
          name: 'protocol',
          snapshot: protocolError,
          category: 'protocol_error',
          source: 'app_server',
        },
        {
          name: 'safety',
          snapshot: safetyError,
          category: 'safety_blocked',
          source: 'provider',
        },
        {
          name: 'unknown',
          snapshot: unknownError,
          category: 'unknown_error',
          source: 'unknown',
        },
      ]
      for (const fixture of p24ErrorFixtures) {
        assert.equal(fixture.snapshot?.category, fixture.category, fixture.name)
        assert.equal(fixture.snapshot?.source, fixture.source, fixture.name)
      }

      const authActionViews = getErrorActionViewModels(appServerAuthError, {
        canOpenLogs: true,
        canOpenModels: true,
      })
      assert.equal(
        authActionViews.find(action => action.action === 'reauth')?.disabledReason,
        undefined,
      )
      assert.equal(
        authActionViews.find(action => action.action === 'copy_diagnostics')?.disabledReason,
        undefined,
      )

      const retryActionViews = getErrorActionViewModels(rateLimitError, {
        canOpenLogs: true,
      })
      assert.match(
        retryActionViews.find(action => action.action === 'retry')?.disabledReason ?? '',
        /可重放输入快照/,
      )

      const modelActionViews = getErrorActionViewModels(quotaError, {
        canOpenLogs: true,
        canOpenModels: true,
      })
      assert.equal(
        modelActionViews.find(action => action.action === 'switch_model')?.disabledReason,
        undefined,
      )

      const diagnosticSnapshot = {
        ...sanitizedError,
        message:
          'Provider API request failed: Bearer sk-secretvalue123456 refresh_token=refresh_secret at C:\\\\Users\\\\luoji\\\\.ccr\\\\tokens.json',
        rawRef:
          'C:\\\\Users\\\\luoji\\\\.ccr\\\\logs\\\\error.log?access_token=raw_access_secret',
        safeDetails: {
          authorization: 'Bearer sk-secretvalue123456',
          cookie: 'session_cookie=abc',
          homePath: 'C:\\\\Users\\\\luoji\\\\.ccr\\\\tokens.json',
          nested: {
            apiKey: 'sk-secretvalue123456',
            refresh_token: 'refresh_secret',
            raw: '{"access_token":"raw_access_secret","cookie":"raw_cookie_secret"}',
            unixHome: '/home/luoji/.config/ccr/tokens.json',
          },
        },
      }
      const diagnostics = createErrorDiagnostics(
        {
          id: 'fixture-secret-error',
          type: 'error',
          text: 'Provider API request failed: Bearer sk-secretvalue123456',
          identity: {
            threadId: 'thread_fixture',
            turnId: 'turn_fixture',
          },
        },
        diagnosticSnapshot,
      )
      const diagnosticsJson = JSON.stringify(diagnostics)
      assert.equal(
        diagnosticsJson.includes('sk-secretvalue123456'),
        false,
      )
      assert.equal(
        diagnosticsJson.includes('refresh_secret'),
        false,
      )
      assert.equal(
        diagnosticsJson.includes('session_cookie'),
        false,
      )
      assert.equal(
        diagnosticsJson.includes('raw_access_secret'),
        false,
      )
      assert.equal(
        diagnosticsJson.includes('luoji'),
        false,
      )
      assert.equal(diagnosticsJson.includes('C:\\\\\\\\Users\\\\\\\\[USER]'), true)
      assert.equal(diagnosticsJson.includes('/home/[USER]'), true)
      assert.equal(diagnosticsJson.includes('[REDACTED]'), true)
      assert.equal(diagnostics.threadId, 'thread_fixture')

      const event = createDisplayEventFromCompletedItem(
        'fixture-read-too-large',
        'tool_result',
        [
          {
            type: 'tool_result',
            name: 'Read',
            is_error: true,
            content: 'File content (256.1KB) exceeds maximum allowed size (256KB). Use offset and limit parameters to read specific portions of the file, or search for specific content instead of reading the whole file.',
          },
        ],
        'failed',
        {
          itemId: 'fixture-read-too-large',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          params: {
            threadId: 'thread_fixture',
            turnId: 'turn_fixture',
            toolUseId: 'toolu_fixture_read_too_large',
          },
        },
      )

      assert.equal(event?.type, 'tool_result')
      assert.equal(event?.toolSnapshot?.category, 'file')
      assert.equal(event?.toolSnapshot?.status, 'failed')
      assert.equal(event?.toolSnapshot?.errorClass, 'file_too_large')
      assert.equal(event?.errorSnapshot?.category, 'tool_error')
      assert.equal(event?.errorSnapshot?.source, 'tool')
      assert.equal(event?.errorSnapshot?.toolUseId, 'toolu_fixture_read_too_large')
      assert.match(event?.toolSnapshot?.actionableHint ?? '', /offset\\/limit|搜索/)
      assert.equal(event?.contentBlocks?.[0]?.type, 'tool_result')
      assert.equal(
        event?.contentBlocks?.[0]?.toolName,
        'Read',
        'tool_result events should expose normalized CcrContentBlock metadata',
      )

      const missingHelperEvent = createDisplayEventFromCompletedItem(
        'fixture-grep-missing-helper',
        'tool_result',
        [
          {
            type: 'tool_result',
            name: 'Grep',
            is_error: true,
            content: 'spawn D:\\\\agent_project\\\\claude-code-reforged\\\\dist\\\\src\\\\utils\\\\vendor\\\\ripgrep\\\\x64-win32\\\\rg.exe ENOENT',
          },
        ],
        'failed',
        {
          itemId: 'fixture-grep-missing-helper',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          toolUseId: 'toolu_fixture_grep_missing_helper',
        },
      )

      assert.equal(missingHelperEvent?.type, 'tool_result')
      assert.equal(missingHelperEvent?.toolSnapshot?.category, 'file')
      assert.equal(missingHelperEvent?.toolSnapshot?.status, 'failed')
      assert.equal(missingHelperEvent?.toolSnapshot?.errorClass, 'command_not_found')
      assert.notEqual(missingHelperEvent?.toolSnapshot?.errorClass, 'path_not_found')
      assert.match(missingHelperEvent?.toolSnapshot?.actionableHint ?? '', /工具依赖|PATH/)

      const userEvent = createDisplayEventFromCompletedItem(
        'fixture-history-user-image',
        'user_message',
        [
          {
            type: 'text',
            text: '识别这张图片',
          },
          {
            type: 'image',
            displayName: 'image.png',
            mimeType: 'image/png',
            source: { kind: 'file', path: 'C:\\\\tmp\\\\image.png' },
          },
        ],
        'completed',
        {
          itemId: 'fixture-history-user-image',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          params: { source: 'history' },
        },
      )

      assert.equal(userEvent?.type, 'user_message')
      assert.equal(userEvent?.contentBlocks?.[0]?.type, 'text')
      assert.equal(userEvent?.contentBlocks?.[1]?.type, 'image')
      assert.equal(userEvent?.attachmentSnapshots?.[0]?.previewKind, 'image')

      const userImagePlaceholderEvent = createDisplayEventFromCompletedItem(
        'fixture-history-user-image-placeholder',
        'user_message',
        [
          {
            type: 'text',
            text: '[图片]',
          },
          {
            type: 'image',
            displayName: 'image.png',
            mimeType: 'image/png',
            source: { kind: 'file', path: 'C:\\\\tmp\\\\image.png' },
          },
        ],
        'completed',
        {
          itemId: 'fixture-history-user-image-placeholder',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          params: { source: 'history' },
        },
      )
      assert.equal(userImagePlaceholderEvent?.type, 'user_message')
      assert.equal(userImagePlaceholderEvent?.text, '')
      assert.equal(
        userImagePlaceholderEvent?.attachmentSnapshots?.[0]?.previewKind,
        'image',
      )

      const userImagePlaceholderProjection = projectThreadDisplayItem({
        itemId: 'fixture-user-image-placeholder-projection',
        id: 'fixture-user-image-placeholder-projection',
        type: 'user_message',
        sourceKind: 'user_message',
        text: '[图片]',
        status: 'completed',
        identity: {
          threadId: 'thread_fixture',
          turnId: 'turn_fixture_user_image_placeholder',
          itemId: 'fixture-user-image-placeholder-projection',
        },
        content: [
          {
            type: 'text',
            text: '[图片]',
          },
          {
            type: 'image',
            displayName: 'image.png',
            mimeType: 'image/png',
            source: { kind: 'file', path: 'C:\\\\tmp\\\\image.png' },
          },
        ],
      })
      const userImagePlaceholderProjectionEvent = createDisplayEventFromCompletedItem(
        'fixture-user-image-placeholder-projection',
        'user_message',
        [],
        'completed',
        {
          itemId: 'fixture-user-image-placeholder-projection',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture_user_image_placeholder',
          item: { projection: userImagePlaceholderProjection },
          params: { source: 'live' },
        },
      )
      assert.equal(userImagePlaceholderProjectionEvent?.type, 'user_message')
      assert.equal(userImagePlaceholderProjectionEvent?.text, '')
      assert.equal(
        userImagePlaceholderProjectionEvent?.attachmentSnapshots?.[0]?.previewKind,
        'image',
      )

      const thinkingProjection = projectThreadDisplayItem({
        id: 'fixture-thinking-summary-projection',
        type: 'thinking_summary',
        text: '分析中',
        status: 'completed',
        identity: {
          threadId: 'thread_fixture',
          turnId: 'turn_fixture_thinking_summary',
          itemId: 'fixture-thinking-summary-projection',
        },
        content: [
          {
            type: 'thinking',
            thinking: '先理解用户问题，再给出答案。',
          },
        ],
      })
      assert.equal(thinkingProjection?.event?.type, 'thinking_summary')
      assert.match(thinkingProjection?.event?.text ?? '', /思考/)
      assert.match(
        thinkingProjection?.event?.text ?? '',
        /先理解用户问题/,
      )

      const legacyMissingProjectionThinkingEvent = createDisplayEventFromCompletedItem(
        'fixture-legacy-thinking-missing-projection',
        'assistant_message',
        [
          {
            type: 'thinking',
            thinking: '',
            signature: '{"summary":[]}',
          },
        ],
        'completed',
        {
          itemId: 'fixture-legacy-thinking-missing-projection',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture_legacy_thinking',
          item: {
            id: 'fixture-legacy-thinking-missing-projection',
            type: 'thinking_summary',
            text: '',
            status: 'completed',
            content: [
              {
                type: 'thinking',
                thinking: '',
                signature: '{"summary":[]}',
              },
            ],
          },
          params: { source: 'history' },
        },
      )
      assert.equal(legacyMissingProjectionThinkingEvent?.type, 'error')
      assert.equal(
        legacyMissingProjectionThinkingEvent?.id,
        'fixture-legacy-thinking-missing-projection:projection-protocol-error',
      )
      assert.equal(
        legacyMissingProjectionThinkingEvent?.text.includes(
          'ThreadDisplayItem.projection',
        ),
        true,
        'missing thinking projection should render a protocol error instead of using raw fallback',
      )

      const persistedArtifact = await persistGeneratedArtifactFromBase64({
        ccrHome: generatedArtifactsHome,
        sessionId: 'thread_fixture',
        outputId: 'out_img_1',
        mimeType: 'image/png',
        artifactType: 'image',
        base64Data: 'aGVsbG8=',
        provider: 'openai',
        model: 'gpt-image-1',
        prompt: '画一张日出图片',
        revisedPrompt: 'A clean sunrise over water.',
      })
      assert.match(persistedArtifact.savedPath ?? '', /generated_outputs/)
      assert.equal(await readFile(persistedArtifact.savedPath, 'utf8'), 'hello')

      const generatedImageEvent = createDisplayEventFromCompletedItem(
        'fixture-model-generated-image',
        'assistant_message',
        [
          {
            type: 'text',
            text: '已生成一张图片。',
          },
          {
            type: 'image',
            origin: 'model_output',
            lifecycle: 'temporary',
            safety: 'needs_review',
            attachmentId: 'generated-image-1',
            displayName: 'sunrise.png',
            mimeType: 'image/png',
            sizeBytes: 2048,
            provider: 'openai',
            model: 'gpt-image-1',
            outputId: 'out_img_1',
            savedPath: persistedArtifact.savedPath,
            prompt: '画一张日出图片',
            revisedPrompt: 'A clean sunrise over water.',
            expiresAt: '2026-05-18T12:00:00Z',
            generatedArtifact: persistedArtifact,
            source: {
              kind: 'file',
              path: persistedArtifact.savedPath,
            },
          },
        ],
        'completed',
        {
          itemId: 'fixture-model-generated-image',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
        },
      )

      assert.equal(generatedImageEvent?.type, 'assistant_message')
      assert.equal(generatedImageEvent?.text, '已生成一张图片。')
      assert.equal((generatedImageEvent?.text ?? '').includes('已保存'), false)
      assert.equal(generatedImageEvent?.contentBlocks?.[1]?.type, 'image')
      assert.equal(generatedImageEvent?.contentBlocks?.[1]?.origin, 'model_output')
      assert.equal(generatedImageEvent?.contentBlocks?.[1]?.lifecycle, 'temporary')
      assert.equal(generatedImageEvent?.contentBlocks?.[1]?.safety, 'needs_review')
      assert.equal(generatedImageEvent?.contentBlocks?.[1]?.source?.kind, 'file')
      assert.equal(generatedImageEvent?.contentBlocks?.[1]?.savedPath, persistedArtifact.savedPath)
      assert.equal(generatedImageEvent?.contentBlocks?.[1]?.prompt, '画一张日出图片')
      assert.equal(generatedImageEvent?.contentBlocks?.[1]?.generatedArtifact?.status, 'saved')
      const generatedAttachment = generatedImageEvent?.attachmentSnapshots?.[0]
      assert.equal(generatedAttachment?.source, 'ModelOutput')
      assert.equal(generatedAttachment?.status, 'generated')
      assert.equal(generatedAttachment?.previewKind, 'image')
      assert.equal(generatedAttachment?.origin, 'model_output')
      assert.equal(generatedAttachment?.outputLifecycle, 'temporary')
      assert.equal(generatedAttachment?.outputSafety, 'needs_review')
      assert.equal(generatedAttachment?.provider, 'openai')
      assert.equal(generatedAttachment?.model, 'gpt-image-1')
      assert.equal(generatedAttachment?.outputId, 'out_img_1')
      assert.equal(generatedAttachment?.savedPath, persistedArtifact.savedPath)
      assert.equal(generatedAttachment?.path, persistedArtifact.savedPath)
      assert.equal(generatedAttachment?.prompt, '画一张日出图片')
      assert.equal(generatedAttachment?.generatedArtifact?.savedPath, persistedArtifact.savedPath)

      const generatedImageUrl = 'https://example.com/generated/sunrise.png'
      const generatedUrlImageEvent = createDisplayEventFromCompletedItem(
        'fixture-model-generated-image-url',
        'assistant_message',
        [
          {
            type: 'image',
            origin: 'model_output',
            lifecycle: 'temporary',
            safety: 'needs_review',
            attachmentId: 'generated-image-url',
            displayName: 'remote-sunrise.png',
            mimeType: 'image/png',
            provider: 'glm-api',
            model: 'glm-image',
            outputId: 'out_img_url',
            prompt: '画一张远程 URL 图片',
            source: {
              kind: 'url',
              url: generatedImageUrl,
            },
          },
        ],
        'completed',
        {
          itemId: 'fixture-model-generated-image-url',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
        },
      )
      assert.equal(generatedUrlImageEvent?.type, 'assistant_message')
      assert.equal(generatedUrlImageEvent?.text, '')
      const generatedUrlAttachment = generatedUrlImageEvent?.attachmentSnapshots?.[0]
      assert.equal(generatedUrlAttachment?.source, 'ModelOutput')
      assert.equal(generatedUrlAttachment?.previewKind, 'image')
      assert.equal(generatedUrlAttachment?.safety, 'remote')
      assert.equal(generatedUrlAttachment?.path, generatedImageUrl)
      assert.equal(getAttachmentActionPath(generatedUrlAttachment), generatedImageUrl)
      assert.equal(getAttachmentImagePreviewSrc(generatedUrlAttachment), '')

      const assistantGeneratedOutputPath =
        'C:\\\\Users\\\\luoji\\\\.ccr\\\\generated_outputs\\\\thread_fixture\\\\out_img_1.png'
      const assistantGeneratedPathPatch = coreEventToThreadDisplayPatchNotification({
        type: 'item_completed',
        threadId: 'thread_fixture',
        turnId: 'turn_fixture_generated_path_text',
        itemId: 'fixture-assistant-generated-image-path-text',
        kind: 'assistant_message',
        status: 'completed',
        content: [
          {
            type: 'text',
            text: '已生成一张图片：\\n\\n' + assistantGeneratedOutputPath,
          },
        ],
      })
      assert.equal(assistantGeneratedPathPatch?.method, 'thread/display/patch')
      const assistantGeneratedPathAction = routeDesktopEvent(
        {
          type: 'notification',
          at: '2026-05-22T09:10:00.000Z',
          status: null,
          payload: assistantGeneratedPathPatch,
        },
        new Map(),
      ).sessionActions[0]
      const assistantGeneratedPathEvent = createDisplayEventFromCompletedItem(
        assistantGeneratedPathAction.itemId,
        assistantGeneratedPathAction.kind,
        assistantGeneratedPathAction.content,
        assistantGeneratedPathAction.statusText,
        assistantGeneratedPathAction.context,
      )
      const assistantGeneratedPathAttachment =
        assistantGeneratedPathEvent?.attachmentSnapshots?.[0]
      assert.equal(assistantGeneratedPathEvent?.type, 'assistant_message')
      assert.equal(
        assistantGeneratedPathEvent?.text.includes(assistantGeneratedOutputPath),
        false,
      )
      assert.equal(assistantGeneratedPathEvent?.text, '已生成一张图片')
      assert.equal(assistantGeneratedPathAttachment?.source, 'ModelOutput')
      assert.equal(assistantGeneratedPathAttachment?.previewKind, 'image')
      assert.equal(assistantGeneratedPathAttachment?.origin, 'model_output')
      assert.equal(assistantGeneratedPathAttachment?.savedPath, assistantGeneratedOutputPath)
      assert.equal(assistantGeneratedPathAttachment?.path, assistantGeneratedOutputPath)

      const assistantGeneratedPathUnmaterializedEvent = createDisplayEventFromCompletedItem(
        'fixture-assistant-generated-image-path-text-unmaterialized',
        'assistant_message',
        [
          {
            type: 'text',
            text: '已生成图片：\\n' + assistantGeneratedOutputPath,
          },
        ],
        'completed',
      )
      assert.equal(assistantGeneratedPathUnmaterializedEvent?.text.startsWith('已生成图片'), true)
      assert.equal(
        assistantGeneratedPathUnmaterializedEvent?.attachmentSnapshots,
        undefined,
      )

      const codexOauthToolReplayContent = enrichToolResultReplayContentWithGeneratedOutputs(
        [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_generate_image',
            content: 'Generated 1 image(s) with codex-oauth/gpt-5.5.\\n- out_codex_oauth: ' + persistedArtifact.savedPath,
          },
        ],
        {
          provider: 'codex-oauth',
          model: 'gpt-5.5',
          output: [
            {
              type: 'image',
              attachmentId: 'out_codex_oauth',
              displayName: 'out_codex_oauth.png',
              mimeType: 'image/png',
              origin: 'model_output',
              lifecycle: 'persisted',
              safety: 'needs_review',
              provider: 'codex-oauth',
              model: 'gpt-5.5',
              outputId: 'out_codex_oauth',
              savedPath: persistedArtifact.savedPath,
              prompt: '白色中华田园猫',
              generatedArtifact: persistedArtifact,
              source: {
                kind: 'file',
                path: persistedArtifact.savedPath,
              },
            },
          ],
        },
      )
      assert.equal(Array.isArray(codexOauthToolReplayContent), true)
      assert.equal(codexOauthToolReplayContent[0].content[1].type, 'image')

      const codexOauthToolEvent = createDisplayEventFromCompletedItem(
        'fixture-codex-oauth-image-tool-result',
        'tool_result',
        codexOauthToolReplayContent,
        'completed',
        {
          itemId: 'fixture-codex-oauth-image-tool-result',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture',
          toolUseId: 'toolu_generate_image',
        },
      )
      assert.equal(
        codexOauthToolEvent?.attachmentSnapshots,
        undefined,
        'renderer raw tool fallback must not infer generated attachments without ThreadDisplay projection',
      )

      const liveGenerateToolUseId = 'toolu_live_generate_image'
      const liveGenerateStartedPatch = coreEventToThreadDisplayPatchNotification({
        type: 'item_started',
        item: {
          itemId: 'fixture-live-generate-image-tool',
          threadId: 'thread_fixture',
          turnId: 'turn_fixture_live_image',
          kind: 'assistant_message',
          status: 'running',
          content: [
            {
              type: 'tool_use',
              id: liveGenerateToolUseId,
              name: 'GenerateImage',
              input: { prompt: '一只美短加白' },
            },
          ],
          startedAt: '2026-05-22T09:00:00.000Z',
        },
      })
      assert.equal(liveGenerateStartedPatch?.method, 'thread/display/patch')
      routeDesktopEvent(
        {
          type: 'notification',
          at: '2026-05-22T09:00:00.000Z',
          status: null,
          payload: liveGenerateStartedPatch,
        },
        new Map(),
      )

      const liveGenerateCompletedPatch = coreEventToThreadDisplayPatchNotification({
        type: 'item_completed',
        threadId: 'thread_fixture',
        turnId: 'turn_fixture_live_image',
        itemId: 'fixture-live-generate-image-tool-result',
        kind: 'tool_result',
        status: 'completed',
        content: [
          {
            type: 'tool_result',
            toolUseId: liveGenerateToolUseId,
            content:
              'Generated 1 image(s) with codex-oauth/gpt-5.5.\\n- out_live_generate_image: ' +
              persistedArtifact.savedPath,
            result: {
              provider: 'codex-oauth',
              model: 'gpt-5.5',
              output: [
                {
                  type: 'image',
                  attachmentId: 'out_live_generate_image',
                  displayName: 'out_live_generate_image.png',
                  mimeType: 'image/png',
                  origin: 'model_output',
                  lifecycle: 'persisted',
                  safety: 'needs_review',
                  provider: 'codex-oauth',
                  model: 'gpt-5.5',
                  outputId: 'out_live_generate_image',
                  savedPath: persistedArtifact.savedPath,
                  prompt: '一只美短加白',
                  generatedArtifact: persistedArtifact,
                  source: {
                    kind: 'file',
                    path: persistedArtifact.savedPath,
                  },
                },
              ],
            },
          },
        ],
        startedAt: '2026-05-22T09:00:00.000Z',
        completedAt: '2026-05-22T09:00:50.000Z',
        durationMs: 50000,
      })
      assert.equal(liveGenerateCompletedPatch?.method, 'thread/display/patch')
      const liveGenerateCompleted = routeDesktopEvent(
        {
          type: 'notification',
          at: '2026-05-22T09:00:50.000Z',
          status: null,
          payload: liveGenerateCompletedPatch,
        },
        new Map(),
      )
      const liveGenerateAction = liveGenerateCompleted.sessionActions[0]
      const liveGenerateEvent = createDisplayEventFromCompletedItem(
        liveGenerateAction.itemId,
        liveGenerateAction.kind,
        liveGenerateAction.content,
        liveGenerateAction.statusText,
        liveGenerateAction.context,
      )
      assert.equal(liveGenerateEvent?.toolSnapshot?.name, 'GenerateImage')
      assert.equal(liveGenerateEvent?.toolSnapshot?.durationMs, 50000)
      assert.equal(liveGenerateEvent?.toolSnapshot?.result?.[1]?.type, 'image')
      assert.equal(liveGenerateEvent?.attachmentSnapshots?.[0]?.source, 'ModelOutput')
      assert.equal(liveGenerateEvent?.attachmentSnapshots?.[0]?.previewKind, 'image')
      assert.equal(liveGenerateEvent?.attachmentSnapshots?.[0]?.provider, 'codex-oauth')
      assert.equal(liveGenerateEvent?.attachmentSnapshots?.[0]?.savedPath, persistedArtifact.savedPath)

      const codexSseCalls = collectOpenAiResponsesImageGenerationCalls(
        {
          raw: {
            output: [],
          },
          events: [
            {
              type: 'response.output_item.added',
              item: {
                type: 'image_generation_call',
                id: 'ig_codex_duplicate',
                status: 'in_progress',
              },
            },
            {
              type: 'response.output_item.done',
              item: {
                type: 'image_generation_call',
                id: 'ig_codex_duplicate',
                status: 'generating',
                result: 'aGVsbG8=',
                revised_prompt: 'A classroom scene.',
              },
            },
          ],
        },
      )
      assert.equal(codexSseCalls.length, 1)
      assert.equal(codexSseCalls[0]?.id, 'ig_codex_duplicate')
      assert.equal(codexSseCalls[0]?.status, 'generating')
      assert.equal(codexSseCalls[0]?.result, 'aGVsbG8=')

      const resumePayload = sanitizeGeneratedArtifactsForResume({
        image: {
          type: 'image',
          origin: 'model_output',
          previewDataUrl: 'data:image/png;base64,AAAA',
          data: 'data:image/png;base64,BBBB',
          savedPath: persistedArtifact.savedPath,
          generatedArtifact: persistedArtifact,
        },
        call: {
          type: 'image_generation_call',
          id: 'ig_fixture',
          result: 'data:image/png;base64,CCCC',
        },
      })
      const resumePayloadJson = JSON.stringify(resumePayload)
      assert.equal(resumePayloadJson.includes('base64,'), false)
      assert.equal(resumePayload.image.savedPath, persistedArtifact.savedPath)
      assert.equal(resumePayload.image.previewDataUrl, undefined)
      assert.equal(resumePayload.image.data, undefined)
      assert.equal(resumePayload.call.id, 'ig_fixture')
      assert.equal(resumePayload.call.result, '')

      const replayForTextModel = prepareGeneratedImageCallForModelReplay(
        {
          type: 'image_generation_call',
          id: 'ig_fixture',
          result: 'data:image/png;base64,DDDD',
        },
        { includeResult: false },
      )
      assert.equal(replayForTextModel.id, 'ig_fixture')
      assert.equal(replayForTextModel.result, '')
      assert.equal(
        shouldIncludeGeneratedImageResultForReplay({ outputModalities: ['text'] }),
        false,
      )
      assert.equal(
        shouldIncludeGeneratedImageResultForReplay({ outputModalities: ['text', 'image'] }),
        true,
      )
    `,
    'utf8',
  )

  await build({
    entryPoints: [entryPath],
    outfile: outputPath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    logLevel: 'silent',
  })

  try {
    await import(pathToFileURL(outputPath).href)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertExpectedCard(expectedCard) {
  assert(
    typeof expectedCard.cardType === 'string' && expectedCard.cardType,
    'expected card must include cardType',
  )

  if (expectedCard.source === 'event') {
    const event = events.find(item => item.id === expectedCard.fixtureId)
    assert(event, `expected event card missing fixture ${expectedCard.fixtureId}`)
    if (expectedCard.eventType) {
      assert(
        event.type === expectedCard.eventType,
        `event ${expectedCard.fixtureId} should render as ${expectedCard.eventType}`,
      )
    }
    if (expectedCard.toolName) {
      assert(
        event.toolSnapshot?.name === expectedCard.toolName,
        `event ${expectedCard.fixtureId} should use tool ${expectedCard.toolName}`,
      )
    }
    if (expectedCard.category) {
      assert(
        event.toolSnapshot?.category === expectedCard.category,
        `event ${expectedCard.fixtureId} should classify as ${expectedCard.category}`,
      )
    }
    if (expectedCard.operation) {
      assert(
        event.fileToolSnapshot?.operation === expectedCard.operation,
        `event ${expectedCard.fixtureId} should expose operation ${expectedCard.operation}`,
      )
    }
    if (expectedCard.status) {
      assert(
        (event.toolSnapshot?.status ?? event.status) === expectedCard.status,
        `event ${expectedCard.fixtureId} should expose status ${expectedCard.status}`,
      )
    }
    if (expectedCard.hidden === true) {
      assert(
        event.timelineHidden === true,
        `event ${expectedCard.fixtureId} should be hidden from main timeline`,
      )
    }
    return
  }

  if (expectedCard.source === 'permission') {
    const permission = fixture[expectedCard.fixtureKey]
    assert(
      permission,
      `expected permission card missing fixture ${expectedCard.fixtureKey}`,
    )
    if (expectedCard.toolName) {
      assert(
        permission.toolName === expectedCard.toolName,
        `permission ${expectedCard.fixtureKey} should use tool ${expectedCard.toolName}`,
      )
    }
    if (expectedCard.interactionKind) {
      assert(
        permission.interactionKind === expectedCard.interactionKind,
        `permission ${expectedCard.fixtureKey} should classify as ${expectedCard.interactionKind}`,
      )
    }
    if (expectedCard.status) {
      assert(
        permission.status === expectedCard.status,
        `permission ${expectedCard.fixtureKey} should expose status ${expectedCard.status}`,
      )
    }
    return
  }

  throw new Error(`unknown expected card source: ${expectedCard.source}`)
}
