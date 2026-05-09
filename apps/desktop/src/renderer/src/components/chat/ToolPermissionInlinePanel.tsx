import { useState } from 'react'
import type { PermissionCard } from '../../domain/displayTypes.js'
import {
  createAllowPayload,
  createDenyPayload,
  extractPermissionSuggestions,
  formatPermissionStatus,
  formatSuggestion,
  getString,
  type PermissionResponseHandler,
} from './permissionCardHelpers.js'

export function ToolPermissionInlinePanel(props: {
  permission: PermissionCard
  onRespond: PermissionResponseHandler
}) {
  const permission = props.permission
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const disabled = permission.status !== 'pending' || submitting
  const suggestions = extractPermissionSuggestions(
    permission.permissionSuggestions,
  )
  const description =
    getString(permission.input.description) ??
    permission.description ??
    getPermissionDescription(permission)

  async function respond(behavior: 'allow' | 'deny'): Promise<void> {
    if (disabled) {
      return
    }

    const trimmedFeedback = feedback.trim()
    setSubmitting(true)
    try {
      await props.onRespond(
        permission.permissionRequestId,
        behavior,
        behavior === 'allow'
          ? createAllowPayload(permission, {
              ...(trimmedFeedback ? { acceptFeedback: trimmedFeedback } : {}),
            })
          : createDenyPayload(
              permission,
              trimmedFeedback || `Desktop user denied ${permission.toolName}.`,
            ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function allowWithSuggestions(): Promise<void> {
    if (disabled || suggestions.length === 0) {
      return
    }

    const trimmedFeedback = feedback.trim()
    setSubmitting(true)
    try {
      await props.onRespond(
        permission.permissionRequestId,
        'allow',
        createAllowPayload(permission, {
          updatedPermissions: suggestions,
          ...(trimmedFeedback ? { acceptFeedback: trimmedFeedback } : {}),
        }),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="shell-permission-inline is-compact">
      <div className="shell-permission-compact-row">
        <div className="shell-permission-compact-main">
          <strong>需要授权</strong>
          <span>{description}</span>
        </div>
        <span className="shell-permission-compact-status">
          {formatPermissionStatus(permission.status, submitting)}
        </span>
      </div>

      {permission.status === 'pending' ? (
        <details className="shell-permission-compact-feedback">
          <summary>添加反馈</summary>
          <textarea
            disabled={disabled}
            onChange={event => setFeedback(event.currentTarget.value)}
            placeholder="可选：允许时作为执行提示，拒绝时作为拒绝原因。"
            rows={2}
            value={feedback}
          />
        </details>
      ) : null}

      {suggestions.length > 0 ? (
        <details className="shell-permission-compact-suggestions">
          <summary>权限建议</summary>
          <ul>
            {suggestions.map((suggestion, index) => (
              <li key={index}>{formatSuggestion(suggestion)}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {permission.status === 'pending' ? (
        <div className="permission-actions shell-permission-actions shell-permission-actions-compact">
          <button
            disabled={disabled}
            onClick={() => void respond('allow')}
            type="button"
          >
            允许一次
          </button>
          {suggestions.length > 0 ? (
            <button
              disabled={disabled}
              onClick={() => void allowWithSuggestions()}
              type="button"
            >
              保存并允许
            </button>
          ) : null}
          <button
            className="danger"
            disabled={disabled}
            onClick={() => void respond('deny')}
            type="button"
          >
            拒绝
          </button>
        </div>
      ) : null}
    </section>
  )
}

function getPermissionDescription(permission: PermissionCard): string {
  switch (permission.interactionKind) {
    case 'file_permission':
      return '确认这个文件操作。'
    case 'web_fetch':
      return '确认这次网络访问。'
    case 'skill':
      return '确认使用这个 Skill。'
    default:
      return `确认 ${permission.displayName ?? permission.toolName}。`
  }
}
