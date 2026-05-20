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
      import { getAttachmentActionPath, getAttachmentImagePreviewSrc } from '../../apps/desktop/src/renderer/src/components/chat/AttachmentImagePreview.tsx'
      import { getToolMetaItems } from '../../apps/desktop/src/renderer/src/components/chat/ToolCard.tsx'
      import { createErrorDiagnostics, getErrorActionViewModels, getPolicyBoundaryHint, getPolicyBoundaryLabel, getQuotaHint, getRateLimitHint } from '../../apps/desktop/src/renderer/src/components/chat/ErrorCard.tsx'
      import { createCcrErrorSnapshot } from '../../src/types/errorSnapshot.ts'
      import { persistGeneratedArtifactFromBase64, prepareGeneratedImageCallForModelReplay, sanitizeGeneratedArtifactsForResume, shouldIncludeGeneratedImageResultForReplay } from '../../src/utils/generatedArtifacts.ts'

      const generatedArtifactsHome = ${JSON.stringify(join(tempDir, 'generated-artifacts-home'))}

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
      assert.equal(generateImageToolEvent?.toolSnapshot?.target, imagePrompt)
      assert.equal(
        getToolMetaItems(generateImageToolEvent.toolSnapshot).some(item => item.label === '目标'),
        false,
      )

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
