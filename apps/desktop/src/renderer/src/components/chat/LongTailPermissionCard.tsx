import { useState } from 'react'
import { InteractionDetails } from './InteractionDetails.js'
import { InteractionCardShell } from './InteractionCardShell.js'
import type { PermissionCard } from '../../domain/displayTypes.js'
import {
  createAllowPayload,
  createDenyPayload,
  formatPermissionStatus,
  type PermissionResponseHandler,
} from './permissionCardHelpers.js'

export function LongTailPermissionCard(props: {
  permission: PermissionCard
  onRespond: PermissionResponseHandler
}) {
  const permission = props.permission
  const [submitting, setSubmitting] = useState(false)
  const disabled = permission.status !== 'pending' || submitting
  const descriptor = getLongTailDescriptor(permission)

  async function respond(behavior: 'allow' | 'deny'): Promise<void> {
    if (disabled) {
      return
    }

    setSubmitting(true)
    try {
      await props.onRespond(
        permission.permissionRequestId,
        behavior,
        behavior === 'allow'
          ? createAllowPayload(permission)
          : createDenyPayload(
              permission,
              `Desktop user denied ${permission.toolName}.`,
            ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <InteractionCardShell
      actions={
        <>
          <button
            disabled={disabled}
            onClick={() => void respond('allow')}
            type="button"
          >
            允许一次
          </button>
          <button
            className="danger"
            disabled={disabled}
            onClick={() => void respond('deny')}
            type="button"
          >
            拒绝
          </button>
        </>
      }
      className="long-tail-permission-card"
      status={formatPermissionStatus(permission.status, submitting)}
      title={permission.displayName ?? permission.toolName}
      typeLabel={descriptor.title}
    >
      <section className="long-tail-permission-summary">
        <h4>{descriptor.summary}</h4>
        <p>{descriptor.message}</p>
        {permission.description ? <p>{permission.description}</p> : null}
        {permission.toolUseId ? <small>关联工具：{permission.toolUseId}</small> : null}
      </section>

      <InteractionDetails value={permission.input} />
    </InteractionCardShell>
  )
}

function getLongTailDescriptor(permission: PermissionCard): {
  title: string
  summary: string
  message: string
} {
  switch (permission.interactionKind) {
    case 'file_permission':
      return {
        title: '文件权限',
        summary: '需要确认文件操作',
        message:
          '该工具会读取、写入或修改本地文件。若没有匹配到上方工具卡，Desktop 会保留这张兜底权限卡供你确认。',
      }
    case 'review_artifact':
      return {
        title: '产物评审权限',
        summary: '评审能力当前按安全兜底展示',
        message:
          'ReviewArtifact 在当前恢复源码里仍是 feature-gated / placeholder。Desktop 保留原始参数和允许/拒绝入口，但不展示误导性的完整评审 UI。',
      }
    case 'workflow':
      return {
        title: '工作流权限',
        summary: '工作流能力当前按安全兜底展示',
        message:
          'Workflow 可能涉及多步骤执行和外部副作用。当前 Desktop 只做一次性权限确认，不自动保存长期允许规则。',
      }
    case 'monitor':
      return {
        title: '监控权限',
        summary: '监控能力当前按安全兜底展示',
        message:
          'Monitor 可能代表长期后台行为或持续观察任务。当前 Desktop 先保守展示为一次性确认，后续再补专用生命周期卡。',
      }
    default:
      return {
        title: '权限请求',
        summary: '未知交互按兜底卡处理',
        message:
          'Desktop 还没有这个工具的专用交互卡；当前保留工具名、参数和权限决策，避免事件静默消失。',
      }
  }
}
