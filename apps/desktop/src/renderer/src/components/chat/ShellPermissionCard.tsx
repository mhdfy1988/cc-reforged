import { useState } from 'react'
import { InteractionDetails } from './InteractionDetails.js'
import type {
  JsonObject,
  PermissionCard,
  PermissionRespondPayload,
} from '../../domain/displayTypes.js'

type PermissionSuggestion = {
  type?: string
  behavior?: string
  destination?: string
  rules?: Array<{
    toolName?: string
    ruleContent?: string
  }>
}

export function ShellPermissionCard(props: {
  permission: PermissionCard
  onRespond: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
    payload?: PermissionRespondPayload,
  ) => Promise<void>
}) {
  const permission = props.permission
  const command = getShellCommand(permission.input)
  const shell = getShellName(permission.toolName, permission.input)
  const cwd = getString(permission.input.cwd) ?? getString(permission.input.workdir)

  return (
    <div className="permission-card shell-permission-card">
      <div>
        <b>命令权限</b>
        <strong>{permission.displayName ?? permission.toolName}</strong>
        <span>{formatPermissionStatus(permission.status, false)}</span>
      </div>

      <section className="shell-command-panel">
        <h4>准备执行命令</h4>
        <code title={command}>{command}</code>
      </section>

      <div className="shell-permission-meta">
        <span>Shell：{shell}</span>
        {cwd ? <span>工作目录：{cwd}</span> : null}
        {permission.blockedPath ? <span>阻塞路径：{permission.blockedPath}</span> : null}
        {permission.decisionReason ? <span>原因：{permission.decisionReason}</span> : null}
      </div>

      <ShellPermissionInlinePanel
        permission={permission}
        onRespond={props.onRespond}
      />
    </div>
  )
}

export function ShellPermissionInlinePanel(props: {
  compact?: boolean
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
  const description =
    getString(permission.input.description) ?? permission.description
  const command = getShellCommand(permission.input)
  const shell = getShellName(permission.toolName, permission.input)
  const hints = getShellPermissionHints(permission.toolName, shell, command)
  const suggestions = extractPermissionSuggestions(
    permission.permissionSuggestions,
  )

  async function allowOnce(): Promise<void> {
    if (disabled) {
      return
    }
    await respond('allow')
  }

  async function allowWithSuggestions(): Promise<void> {
    if (disabled || suggestions.length === 0) {
      return
    }
    await respond('allow', {
      updatedPermissions: suggestions,
    })
  }

  async function deny(): Promise<void> {
    if (disabled) {
      return
    }
    await respond('deny')
  }

  async function respond(
    behavior: 'allow' | 'deny',
    extraPayload: PermissionRespondPayload = {},
  ): Promise<void> {
    const trimmedFeedback = feedback.trim()
    setSubmitting(true)
    try {
      await props.onRespond(permission.permissionRequestId, behavior, {
        ...extraPayload,
        ...(behavior === 'allow'
          ? {
              updatedInput: permission.input,
              ...(trimmedFeedback ? { acceptFeedback: trimmedFeedback } : {}),
            }
          : {
              message:
                trimmedFeedback || 'Desktop user denied the shell command.',
              interrupt: false,
            }),
        toolUseID: permission.toolUseId,
        decisionClassification:
          behavior === 'allow' ? 'user_temporary' : 'user_reject',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (props.compact) {
    return (
      <section className="shell-permission-inline is-compact">
        <div className="shell-permission-compact-row">
          <div className="shell-permission-compact-main">
            <strong>需要授权</strong>
            <span>{description ?? '允许执行这条命令'}</span>
          </div>
          <span className="shell-permission-compact-status">
            {formatPermissionStatus(permission.status, submitting)}
          </span>
        </div>

        {hints.map(hint => (
          <p className="shell-permission-hint" key={hint}>
            {hint}
          </p>
        ))}

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
              onClick={() => void allowOnce()}
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
              onClick={() => void deny()}
              type="button"
            >
              拒绝
            </button>
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <section
      className={`shell-permission-inline ${
        props.compact ? 'is-compact' : ''
      }`}
    >
      {props.compact ? (
        <p className="shell-permission-inline-title">
          等待命令权限确认
          <span>{formatPermissionStatus(permission.status, submitting)}</span>
        </p>
      ) : null}

      {description ? <p className="shell-permission-desc">{description}</p> : null}

      {hints.map(hint => (
        <p className="shell-permission-hint" key={hint}>
          {hint}
        </p>
      ))}

      {suggestions.length > 0 ? (
        <section className="shell-permission-suggestions">
          <h4>可保存的权限建议</h4>
          <ul>
            {suggestions.map((suggestion, index) => (
              <li key={index}>{formatSuggestion(suggestion)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <label className="shell-permission-feedback">
        <span>反馈 / 附加说明（可选）</span>
        <textarea
          disabled={disabled}
          onChange={event => setFeedback(event.currentTarget.value)}
          placeholder="允许时这里会作为执行提示；拒绝时这里会作为拒绝原因。"
          rows={2}
          value={feedback}
        />
      </label>

      <InteractionDetails value={permission.input} />

      <div className="permission-actions shell-permission-actions">
        <button disabled={disabled} onClick={() => void allowOnce()} type="button">
          允许一次
        </button>
        {suggestions.length > 0 ? (
          <button
            disabled={disabled}
            onClick={() => void allowWithSuggestions()}
            type="button"
          >
            保存建议并允许
          </button>
        ) : null}
        <button
          className="danger"
          disabled={disabled}
          onClick={() => void deny()}
          type="button"
        >
          拒绝
        </button>
      </div>
    </section>
  )
}

function getShellCommand(input: JsonObject): string {
  return (
    getString(input.command) ??
    getString(input.cmd) ??
    getString(input.script) ??
    '未提供命令'
  )
}

function getShellName(toolName: string, input: JsonObject): string {
  return (
    getString(input.shell) ??
    getString(input.shellName) ??
    (toolName === 'PowerShell'
      ? 'powershell'
      : toolName === 'Bash'
        ? 'bash/posix'
        : toolName)
  )
}

function getShellPermissionHints(
  toolName: string,
  shell: string,
  command: string,
): string[] {
  const normalizedToolName = toolName.toLowerCase()
  const normalizedShell = shell.toLowerCase()
  const isBashLike =
    normalizedToolName === 'bash' ||
    normalizedShell.includes('bash') ||
    normalizedShell.includes('posix')

  if (!isBashLike) {
    return []
  }

  const hints = [
    '当前工具是 Bash/POSIX。Windows 下如果没有 POSIX shell，应优先改用 PowerShell、CMD、Node 原生文件能力或高层文件工具。',
  ]

  if (looksLikePowerShellCommand(command)) {
    hints.push(
      '检测到命令更像 PowerShell 语法，但当前会按 Bash/POSIX 请求授权；建议改用 PowerShell 工具后再执行。',
    )
  }

  return hints
}

function looksLikePowerShellCommand(command: string): boolean {
  const normalized = command.trim()
  return (
    /^(Get|Set|New|Remove|Test|Select|Where|ForEach)-[A-Z]/.test(normalized) ||
    normalized.includes('ForEach-Object') ||
    normalized.includes('Select-Object') ||
    normalized.includes('$_.') ||
    normalized.startsWith('$')
  )
}

function extractPermissionSuggestions(
  value: unknown,
): PermissionSuggestion[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap(item =>
    item && typeof item === 'object'
      ? [item as PermissionSuggestion]
      : [],
  )
}

function formatSuggestion(suggestion: PermissionSuggestion): string {
  const rules = suggestion.rules ?? []
  const firstRule = rules[0]
  const ruleText = [firstRule?.toolName, firstRule?.ruleContent]
    .filter(Boolean)
    .join(':')
  const behavior = suggestion.behavior ?? 'allow'
  const destination = suggestion.destination ?? 'session'
  return [behavior, ruleText, destination].filter(Boolean).join(' · ')
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
    return '等待授权'
  }
  if (status === 'allowed') {
    return '已允许'
  }
  if (status === 'denied') {
    return '已拒绝'
  }
  return '已取消'
}
