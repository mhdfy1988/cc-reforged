import { useState } from 'react'
import { InteractionDetails } from './InteractionDetails.js'
import { InteractionCardShell } from './InteractionCardShell.js'
import { PathActionLink } from './PathActionLink.js'
import { renderMessageBlocks } from '../../domain/contentBlocks.js'
import type {
  JsonObject,
  PermissionCard,
  PermissionRespondPayload,
} from '../../domain/displayTypes.js'

type PlanExitMode = 'default' | 'acceptEdits'

type AllowedPrompt = {
  tool: string
  prompt: string
}

export function PlanApprovalCard(props: {
  permission: PermissionCard
  compact?: boolean
  inline?: boolean
  onRespond: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
    payload?: PermissionRespondPayload,
  ) => Promise<void>
}) {
  const permission = props.permission
  const compact = props.compact ?? false
  const inline = props.inline ?? false
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const disabled = permission.status !== 'pending' || submitting
  const isEnterPlanMode =
    permission.interactionKind === 'enter_plan_mode' ||
    permission.toolName === 'EnterPlanMode'

  async function approveEnterPlanMode(): Promise<void> {
    if (disabled) {
      return
    }

    setSubmitting(true)
    try {
      const payload = withToolUseId(permission, {
        updatedInput: {},
        updatedPermissions: [
          { type: 'setMode', mode: 'plan', destination: 'session' },
        ],
        message: 'Desktop user approved entering plan mode.',
        decisionClassification: 'user_temporary',
      })
      await props.onRespond(permission.permissionRequestId, 'allow', payload)
    } finally {
      setSubmitting(false)
    }
  }

  async function approveExitPlanMode(mode: PlanExitMode): Promise<void> {
    if (disabled) {
      return
    }

    const trimmedFeedback = feedback.trim()
    setSubmitting(true)
    try {
      const payload = withToolUseId(permission, {
        updatedInput: getPlanUpdatedInput(permission.input),
        updatedPermissions: [{ type: 'setMode', mode, destination: 'session' }],
        ...(trimmedFeedback ? { acceptFeedback: trimmedFeedback } : {}),
        message:
          mode === 'acceptEdits'
            ? 'Desktop user approved the plan and enabled auto-accept edits.'
            : 'Desktop user approved the plan and will manually approve edits.',
        decisionClassification: 'user_temporary',
      })
      await props.onRespond(permission.permissionRequestId, 'allow', payload)
    } finally {
      setSubmitting(false)
    }
  }

  async function rejectPlanMode(): Promise<void> {
    if (disabled) {
      return
    }

    const trimmedFeedback = feedback.trim()
    setSubmitting(true)
    try {
      const payload = withToolUseId(permission, {
        message:
          trimmedFeedback ||
          (isEnterPlanMode
            ? 'Desktop user declined entering plan mode.'
            : 'Desktop user rejected the plan and requested more planning.'),
        interrupt: false,
        decisionClassification: 'user_reject',
      })
      await props.onRespond(permission.permissionRequestId, 'deny', payload)
    } finally {
      setSubmitting(false)
    }
  }

  if (isEnterPlanMode) {
    return (
      <InteractionCardShell
        actions={
          <>
            <button
              disabled={disabled}
              onClick={() => void approveEnterPlanMode()}
              type="button"
            >
              进入计划模式
            </button>
            <button
              className="danger"
              disabled={disabled}
              onClick={() => void rejectPlanMode()}
              type="button"
            >
              拒绝
            </button>
          </>
        }
        className={`plan-approval-card enter-plan-card ${inline ? 'is-inline' : ''}`}
        status={formatPermissionStatus(permission.status, submitting)}
        title="进入计划模式？"
        typeLabel="计划模式"
      >
        {compact ? (
          <p className="plan-card-lead">
            模型申请进入计划模式。批准后将先做方案与风险梳理，再进入编码阶段。
          </p>
        ) : (
          <>
            <p className="plan-card-lead">
              模型想先探索代码、梳理方案，再把计划交给你确认。进入计划模式后，在你批准计划前不会直接修改代码。
            </p>
            <ul className="plan-card-points">
              <li>先阅读项目和现有实现。</li>
              <li>识别风险、依赖和改动边界。</li>
              <li>输出计划后再等待你批准执行。</li>
            </ul>
            <InteractionDetails value={permission.input} />
          </>
        )}
      </InteractionCardShell>
    )
  }

  const title = resolveExitPlanModeTitle(permission)
  const planFilePath = extractPlanFilePath(permission.input)
  const internalPlanDraft = extractInternalPlanDraft(permission.input)
  const planDraft =
    internalPlanDraft ??
    (planFilePath
      ? {
          path: planFilePath,
          seriesId: extractPlanSeriesId(permission.input, planFilePath),
          status: undefined,
        }
      : null)
  const plan = extractPlanText(
    permission.input,
    planDraft
      ? '计划正文在草稿文件中，点击上方路径查看。'
      : resolvePlanTextFallback(permission),
  )
  const allowedPrompts = extractAllowedPrompts(permission.input)

  return (
    <InteractionCardShell
      actions={
        <>
          <button
            disabled={disabled}
            onClick={() => void approveExitPlanMode('default')}
            type="button"
          >
            批准并手动确认
          </button>
          <button
            disabled={disabled}
            onClick={() => void approveExitPlanMode('acceptEdits')}
            type="button"
          >
            批准并自动接受编辑
          </button>
          <button
            className="danger"
            disabled={disabled}
            onClick={() => void rejectPlanMode()}
            type="button"
          >
            拒绝继续规划
          </button>
        </>
      }
      className={`plan-approval-card exit-plan-card ${inline ? 'is-inline' : ''}`}
      meta={
        internalPlanDraft
          ? null
          : planFilePath
            ? `计划文件：${planFilePath}`
            : null
      }
      status={formatPermissionStatus(permission.status, submitting)}
      title={title}
      typeLabel="计划确认"
    >
      {compact ? (
        <section className="plan-card-preview">
          {inline ? null : <h4>计划确认</h4>}
          <div className="plan-card-markdown">
            {renderMessageBlocks('计划文本已在上方助手消息展示，请直接在这里确认。')}
          </div>
        </section>
      ) : (
        <>
          <section className="plan-card-preview">
            <div className="plan-card-section-line">
              <h4>计划内容</h4>
              {planDraft ? (
                <span
                  className={`plan-card-draft-status ${getPlanDraftStatusClass(
                    planDraft.status,
                  )}`}
                >
                  {formatPlanDraftStatus(planDraft.status)}
                </span>
              ) : null}
            </div>
            {planDraft ? (
              <div className="plan-card-source-line">
                <span>{internalPlanDraft ? '内部草稿' : '计划文件'}</span>
                {planDraft.seriesId ? (
                  <b title={planDraft.seriesId}>{planDraft.seriesId}</b>
                ) : null}
                <span className="plan-card-source-spacer" />
                <span className="plan-card-path-slot">
                  <PathActionLink
                    className="plan-card-path-link"
                    path={planDraft.path}
                    statusClassName="plan-card-path-status"
                    title={planDraft.path}
                  >
                    {getFilenameFromPath(planDraft.path)}
                  </PathActionLink>
                </span>
              </div>
            ) : null}
            <div className="plan-card-markdown">{renderMessageBlocks(plan)}</div>
          </section>

          {allowedPrompts.length > 0 ? (
            <section className="plan-card-prompts">
              <div className="plan-card-prompts-line">
                <h4>计划申请的语义权限</h4>
                <div className="plan-card-prompt-chip-list">
                  {allowedPrompts.map((prompt, index) => (
                    <span
                      aria-label={`${prompt.tool}: ${prompt.prompt}`}
                      className="plan-card-prompt-chip"
                      key={`${prompt.tool}:${index}`}
                      title={prompt.prompt}
                    >
                      {prompt.tool}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      <label className="plan-card-feedback">
        <span>反馈 / 补充要求（可选）</span>
        <textarea
          disabled={disabled}
          onChange={event => setFeedback(event.currentTarget.value)}
          placeholder="如果批准计划时还想补一句要求，可以写在这里；拒绝时这里会作为继续规划反馈。"
          rows={3}
          value={feedback}
        />
      </label>

      {compact ? null : <InteractionDetails value={permission.input} />}
    </InteractionCardShell>
  )
}

function withToolUseId(
  permission: PermissionCard,
  payload: PermissionRespondPayload,
): PermissionRespondPayload {
  if (!permission.toolUseId) {
    return payload
  }
  return { ...payload, toolUseID: permission.toolUseId }
}

function getPlanUpdatedInput(input: JsonObject): JsonObject {
  if (
    getString(input.plan) ||
    getString(input.planContent) ||
    getString(input.content)
  ) {
    return input
  }
  return {}
}

function extractPlanText(input: JsonObject, fallbackText?: string): string {
  return (
    getString(input.plan) ??
    getString(input.planContent) ??
    getString(input.content) ??
    fallbackText ??
    '计划内容由原生计划文件提供。若这里没有展示完整计划，请展开原始 JSON 或回到计划文件查看。'
  )
}

function resolveExitPlanModeTitle(permission: PermissionCard): string {
  const displayName = getString(permission.displayName)
  if (displayName) {
    return displayName
  }

  const decisionReason = normalizePlanTitleHint(permission.decisionReason)
  if (decisionReason) {
    return decisionReason
  }

  const description = normalizePlanTitleHint(permission.description)
  if (description) {
    return description
  }

  return '退出计划模式并开始编码？'
}

function normalizePlanTitleHint(value: unknown): string | undefined {
  const text = getString(value)
  if (!text) {
    return undefined
  }

  const normalized = text.trim().toLowerCase()
  if (normalized === 'exit plan mode?') {
    return '退出计划模式并开始编码？'
  }
  if (isGenericExitPlanDescription(text)) {
    return undefined
  }
  return text
}

function resolvePlanTextFallback(permission: PermissionCard): string | undefined {
  const description = getString(permission.description)
  if (description && !isGenericExitPlanDescription(description)) {
    return description
  }

  const decisionReason = getString(permission.decisionReason)
  if (
    decisionReason &&
    decisionReason.trim().toLowerCase() !== 'exit plan mode?'
  ) {
    return decisionReason
  }
  return undefined
}

function isGenericExitPlanDescription(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized.startsWith('prompts the user to exit plan mode')
}

function extractPlanFilePath(input: JsonObject): string | undefined {
  return (
    getString(input.planFilePath) ??
    getString(input.filePath) ??
    getString(input.path)
  )
}

function extractInternalPlanDraft(
  input: JsonObject,
): { path: string; seriesId?: string; status?: string } | null {
  const path =
    getString(input.internalPlanDraftPath) ?? getString(input.planDraftFilePath)
  if (!path) {
    return null
  }
  return {
    path,
    seriesId: extractPlanSeriesId(input, path),
    status:
      getString(input.internalPlanDraftStatus) ??
      getString(input.planDraftStatus),
  }
}

function extractPlanSeriesId(
  input: JsonObject,
  path?: string,
): string | undefined {
  return (
    getString(input.internalPlanSeriesId) ??
    getString(input.planSeriesId) ??
    getString(input.plan_series_id) ??
    (path ? getPlanSeriesIdFromPath(path) : undefined)
  )
}

function getPlanSeriesIdFromPath(path: string): string | undefined {
  const normalized = path.replace(/\\/g, '/')
  const filename = normalized.split('/').filter(Boolean).at(-1) ?? ''
  const stem = filename.replace(/\.md$/i, '')
  if (!stem || stem === filename) {
    return undefined
  }

  const agentMarker = '-agent-'
  const markerIndex = stem.indexOf(agentMarker)
  if (markerIndex === -1) {
    return stem
  }

  const planSlug = stem.slice(0, markerIndex)
  const agentId = stem.slice(markerIndex + agentMarker.length)
  return planSlug && agentId ? `${planSlug}:agent:${agentId}` : stem
}

function getFilenameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  return normalized.split('/').filter(Boolean).at(-1) ?? path
}

function formatPlanDraftStatus(status: string | undefined): string {
  const normalized = status?.trim().toLowerCase()
  if (
    normalized === 'completed' ||
    normalized === 'success' ||
    normalized === 'succeeded'
  ) {
    return '已保存'
  }
  if (
    normalized === 'running' ||
    normalized === 'streaming' ||
    normalized === 'pending' ||
    normalized === 'waiting_permission'
  ) {
    return '保存中'
  }
  if (
    normalized === 'failed' ||
    normalized === 'error' ||
    normalized === 'timeout'
  ) {
    return '保存失败'
  }
  if (normalized === 'denied' || normalized === 'cancelled') {
    return '未保存'
  }
  return '已记录'
}

function getPlanDraftStatusClass(status: string | undefined): string {
  const normalized = status?.trim().toLowerCase()
  if (
    normalized === 'failed' ||
    normalized === 'error' ||
    normalized === 'timeout' ||
    normalized === 'denied' ||
    normalized === 'cancelled'
  ) {
    return 'is-problem'
  }
  if (
    normalized === 'running' ||
    normalized === 'streaming' ||
    normalized === 'pending' ||
    normalized === 'waiting_permission'
  ) {
    return 'is-saving'
  }
  return 'is-saved'
}

function extractAllowedPrompts(input: JsonObject): AllowedPrompt[] {
  const rawPrompts = input.allowedPrompts
  if (!Array.isArray(rawPrompts)) {
    return []
  }

  return rawPrompts.flatMap(rawPrompt => {
    if (!rawPrompt || typeof rawPrompt !== 'object') {
      return []
    }
    const object = rawPrompt as JsonObject
    const tool = getString(object.tool)
    const prompt = getString(object.prompt)
    return tool && prompt ? [{ tool, prompt }] : []
  })
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function formatPermissionStatus(
  status: PermissionCard['status'],
  submitting: boolean,
): string {
  if (submitting) {
    return '提交中'
  }
  if (status === 'pending') {
    return '等待确认'
  }
  if (status === 'allowed') {
    return '已批准'
  }
  if (status === 'denied') {
    return '已拒绝'
  }
  return '已取消'
}
