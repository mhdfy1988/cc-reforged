import { useState } from 'react'
import { InteractionDetails } from './InteractionDetails.js'
import { InteractionCardShell } from './InteractionCardShell.js'
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
  onRespond: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
    payload?: PermissionRespondPayload,
  ) => Promise<void>
}) {
  const permission = props.permission
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
        className="plan-approval-card enter-plan-card"
        status={formatPermissionStatus(permission.status, submitting)}
        title="进入计划模式？"
        typeLabel="计划模式"
      >
        <p className="plan-card-lead">
          模型想先探索代码、梳理方案，再把计划交给你确认。进入计划模式后，
          在你批准计划前不会直接修改代码。
        </p>
        <ul className="plan-card-points">
          <li>先阅读项目和现有实现。</li>
          <li>识别风险、依赖和改动边界。</li>
          <li>输出计划后再等待你批准执行。</li>
        </ul>
        <InteractionDetails value={permission.input} />
      </InteractionCardShell>
    )
  }

  const plan = extractPlanText(permission.input, permission.description)
  const planFilePath = extractPlanFilePath(permission.input)
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
      className="plan-approval-card exit-plan-card"
      meta={planFilePath ? `计划文件：${planFilePath}` : null}
      status={formatPermissionStatus(permission.status, submitting)}
      title={permission.description ?? '模型已准备好退出计划模式'}
      typeLabel="计划确认"
    >
      <section className="plan-card-preview">
        <h4>计划内容</h4>
        <div className="plan-card-markdown">{renderMessageBlocks(plan)}</div>
      </section>

      {allowedPrompts.length > 0 ? (
        <section className="plan-card-prompts">
          <h4>计划申请的语义权限</h4>
          <ul>
            {allowedPrompts.map((prompt, index) => (
              <li key={`${prompt.tool}:${index}`}>
                <strong>{prompt.tool}</strong>
                <span>{prompt.prompt}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

      <InteractionDetails value={permission.input} />
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

function extractPlanText(
  input: JsonObject,
  fallbackDescription?: string,
): string {
  return (
    getString(input.plan) ??
    getString(input.planContent) ??
    getString(input.content) ??
    fallbackDescription ??
    '计划内容由原生计划文件提供。若这里没有展示完整计划，请展开原始 JSON 或回到计划文件查看。'
  )
}

function extractPlanFilePath(input: JsonObject): string | undefined {
  return (
    getString(input.planFilePath) ??
    getString(input.filePath) ??
    getString(input.path)
  )
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
