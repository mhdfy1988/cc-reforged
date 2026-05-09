import { useState } from 'react'
import { InteractionDetails } from './InteractionDetails.js'
import { InteractionCardShell } from './InteractionCardShell.js'
import type { PermissionCard } from '../../domain/displayTypes.js'
import {
  createAllowPayload,
  createDenyPayload,
  extractPermissionSuggestions,
  formatPermissionStatus,
  formatSuggestion,
  getObject,
  getString,
  type PermissionResponseHandler,
} from './permissionCardHelpers.js'

export function SkillPermissionCard(props: {
  permission: PermissionCard
  onRespond: PermissionResponseHandler
}) {
  const permission = props.permission
  const [submitting, setSubmitting] = useState(false)
  const disabled = permission.status !== 'pending' || submitting
  const skill = getString(permission.input.skill) ?? '未知 Skill'
  const args = getString(permission.input.args)
  const command = getObject(permission.input.command)
  const description =
    getString(command?.description) ??
    permission.description ??
    '这个 Skill 可能会注入本地说明、代码片段或工具约束，帮助模型完成特定任务。'
  const suggestions = extractPermissionSuggestions(
    permission.permissionSuggestions,
  )

  async function respond(
    behavior: 'allow' | 'deny',
    remember: boolean,
  ): Promise<void> {
    if (disabled) {
      return
    }

    setSubmitting(true)
    try {
      await props.onRespond(
        permission.permissionRequestId,
        behavior,
        behavior === 'allow'
          ? createAllowPayload(permission, {
              ...(remember && suggestions.length > 0
                ? { updatedPermissions: suggestions }
                : {}),
            })
          : createDenyPayload(
              permission,
              'Desktop user denied the skill request.',
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
            onClick={() => void respond('allow', false)}
            type="button"
          >
            允许一次
          </button>
          {suggestions.length > 0 ? (
            <button
              disabled={disabled}
              onClick={() => void respond('allow', true)}
              type="button"
            >
              保存规则并允许
            </button>
          ) : null}
          <button
            className="danger"
            disabled={disabled}
            onClick={() => void respond('deny', false)}
            type="button"
          >
            拒绝
          </button>
        </>
      }
      className="skill-permission-card"
      status={formatPermissionStatus(permission.status, submitting)}
      title={skill}
      typeLabel="Skill 使用确认"
    >
      <section className="skill-summary">
        <h4>准备启用本地 Skill</h4>
        <p>{description}</p>
        <div>
          <span>Skill：{skill}</span>
          {args ? <span>参数：{args}</span> : null}
        </div>
      </section>

      <p className="skill-scope-hint">
        Skill 是本地能力入口，不是模型自然语言回答本身；允许后，Core 会按原生权限系统把对应 Skill 内容交给模型继续处理。
      </p>

      {suggestions.length > 0 ? (
        <section className="long-tail-permission-suggestions">
          <h4>可保存的权限建议</h4>
          <ul>
            {suggestions.map((suggestion, index) => (
              <li key={index}>{formatSuggestion(suggestion)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <InteractionDetails value={permission.input} />
    </InteractionCardShell>
  )
}
