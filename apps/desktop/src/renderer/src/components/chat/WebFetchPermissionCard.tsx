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
  getString,
  type PermissionResponseHandler,
} from './permissionCardHelpers.js'

export function WebFetchPermissionCard(props: {
  permission: PermissionCard
  onRespond: PermissionResponseHandler
}) {
  const permission = props.permission
  const [submitting, setSubmitting] = useState(false)
  const disabled = permission.status !== 'pending' || submitting
  const url = getString(permission.input.url) ?? getString(permission.input.uri)
  const prompt = getString(permission.input.prompt) ?? permission.description
  const hostname = getHostname(url)
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
              'Desktop user denied the web fetch request.',
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
              记住域名并允许
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
      className="web-fetch-permission-card"
      status={formatPermissionStatus(permission.status, submitting)}
      title={hostname ?? permission.displayName ?? permission.toolName}
      typeLabel="联网读取权限"
    >
      <section className="web-fetch-summary">
        <h4>准备访问网页</h4>
        <p title={url}>{url ?? '未提供 URL'}</p>
        {hostname ? <small>域名：{hostname}</small> : null}
      </section>

      {prompt ? (
        <p className="web-fetch-purpose">用途：{prompt}</p>
      ) : (
        <p className="web-fetch-purpose">
          用途未随权限请求提供，建议展开详情确认原始参数。
        </p>
      )}

      <p className="web-fetch-warning">
        WebFetch 会读取外部网页内容。私有页面、登录态页面或公司内部站点应优先使用对应 MCP / 官方工具，不要直接把敏感页面交给普通网页抓取。
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

function getHostname(url: string | undefined): string | undefined {
  if (!url) {
    return undefined
  }
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}
