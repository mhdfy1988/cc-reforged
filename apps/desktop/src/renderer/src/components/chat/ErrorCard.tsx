import { useEffect, useMemo, useState } from 'react'
import { MessageAvatar } from './MessageAvatar.js'
import { RawDataBlock } from '../common/RawDataBlock.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'
import type {
  CcrErrorAction,
  CcrErrorSnapshot,
} from '../../../../../../../src/types/errorSnapshot.js'

type ErrorActionStatus = {
  action: CcrErrorAction
  kind: 'success' | 'error' | 'running'
  text: string
}

export type ErrorActionCapabilities = {
  canOpenLogs?: boolean
  canOpenModels?: boolean
  hasRetrySnapshot?: boolean
}

export type ErrorActionViewModel = {
  action: CcrErrorAction
  label: string
  title: string
  disabledReason?: string
}

export function ErrorCard(props: {
  event: DisplayEvent
  onOpenLogs?: () => void
  onOpenModels?: () => void
}) {
  const snapshot = props.event.errorSnapshot
  const [actionStatus, setActionStatus] = useState<ErrorActionStatus | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const diagnostics = useMemo(
    () => (snapshot ? createErrorDiagnostics(props.event, snapshot) : null),
    [props.event, snapshot],
  )

  useEffect(() => {
    if (!actionStatus || actionStatus.kind === 'running') {
      return
    }
    const timer = window.setTimeout(() => setActionStatus(null), 2200)
    return () => window.clearTimeout(timer)
  }, [actionStatus])

  if (!snapshot) {
    return (
      <div className="message error error-card">
        <MessageAvatar event={props.event} />
        <div className="error-card-body">
          <p>{props.event.text}</p>
        </div>
      </div>
    )
  }

  const actionViews = getErrorActionViewModels(snapshot, {
    canOpenLogs: true,
    canOpenModels: Boolean(props.onOpenModels),
    hasRetrySnapshot: false,
  })
  const metaItems = getErrorMetaItems(snapshot)
  const limitHint = getRateLimitHint(snapshot)
  const quotaHint = getQuotaHint(snapshot)
  const boundaryHint = getPolicyBoundaryHint(snapshot)

  async function runAction(view: ErrorActionViewModel): Promise<void> {
    if (view.disabledReason) {
      setActionStatus({
        action: view.action,
        kind: 'error',
        text: view.disabledReason,
      })
      return
    }

    setActionStatus({ action: view.action, kind: 'running', text: '处理中...' })
    try {
      if (view.action === 'copy_diagnostics') {
        await window.ccr.copyText(JSON.stringify(diagnostics, null, 2))
        setActionStatus({
          action: view.action,
          kind: 'success',
          text: '已复制诊断信息',
        })
        return
      }

      if (view.action === 'open_logs') {
        if (props.onOpenLogs) {
          props.onOpenLogs()
        } else {
          const logs = await window.ccr.getLogs()
          if (typeof logs?.logDir === 'string' && logs.logDir) {
            await window.ccr.openPath(logs.logDir)
          }
        }
        setActionStatus({
          action: view.action,
          kind: 'success',
          text: '已打开日志入口',
        })
        return
      }

      if (view.action === 'switch_model') {
        props.onOpenModels?.()
        setActionStatus({
          action: view.action,
          kind: 'success',
          text: '已打开模型页',
        })
        return
      }

      if (view.action === 'reauth') {
        const status = await window.ccr.getStatus()
        await window.ccr.loginAuth({
          ...(status?.config?.llm?.profileId
            ? { profileId: status.config.llm.profileId }
            : {}),
          ...(status?.config?.llm?.provider
            ? { provider: status.config.llm.provider }
            : {}),
        })
        setActionStatus({
          action: view.action,
          kind: 'success',
          text: '已发起重新登录',
        })
        return
      }
    } catch (error) {
      setActionStatus({
        action: view.action,
        kind: 'error',
        text: error instanceof Error ? error.message : '操作失败',
      })
    }
  }

  return (
    <div className={`message error error-card ${getCategoryClass(snapshot)}`}>
      <MessageAvatar event={props.event} />
      <div className="error-card-body">
        <div className="error-card-head">
          <strong>{snapshot.title}</strong>
          <span>{getCategoryText(snapshot.category)}</span>
          <span>{getSourceText(snapshot.source)}</span>
        </div>
        <p className="error-card-message">{snapshot.message}</p>
        {boundaryHint ? (
          <p className="error-card-hint">{boundaryHint}</p>
        ) : null}
        {limitHint ? <p className="error-card-hint">{limitHint}</p> : null}
        {quotaHint ? <p className="error-card-hint">{quotaHint}</p> : null}
        {metaItems.length ? (
          <div className="error-card-meta">
            {metaItems.map(item => (
              <span key={item.label}>
                {item.label}：{item.value}
              </span>
            ))}
          </div>
        ) : null}
        <div className="error-card-actions">
          {actionViews.map(view => (
            <button
              disabled={Boolean(view.disabledReason)}
              key={view.action}
              onClick={() => void runAction(view)}
              title={view.disabledReason ?? view.title}
              type="button"
            >
              {view.label}
            </button>
          ))}
        </div>
        {actionStatus ? (
          <p className={`error-card-action-status is-${actionStatus.kind}`}>
            {actionStatus.text}
          </p>
        ) : null}
        <details
          className="error-card-details"
          open={detailsOpen}
          onToggle={event => setDetailsOpen(event.currentTarget.open)}
        >
          <summary>诊断信息</summary>
          <RawDataBlock value={diagnostics} />
        </details>
      </div>
    </div>
  )
}

export function getErrorActionViewModels(
  snapshot: CcrErrorSnapshot,
  capabilities: ErrorActionCapabilities = {},
): ErrorActionViewModel[] {
  return Array.from(new Set(snapshot.recommendedActions)).map(action => ({
    action,
    label: getActionLabel(action),
    title: getActionTitle(action),
    disabledReason: getActionDisabledReason(action, snapshot, capabilities),
  }))
}

export function createErrorDiagnostics(
  event: DisplayEvent,
  snapshot: CcrErrorSnapshot,
): Record<string, unknown> {
  return sanitizeDiagnosticPayload(compactDiagnostics({
    errorId: snapshot.errorId,
    category: snapshot.category,
    severity: snapshot.severity,
    source: snapshot.source,
    title: snapshot.title,
    message: snapshot.message,
    retryable: snapshot.retryable,
    retryAfterMs: snapshot.retryAfterMs,
    requestId: snapshot.requestId,
    threadId: event.identity?.threadId,
    turnId: snapshot.turnId ?? event.identity?.turnId,
    toolUseId: snapshot.toolUseId ?? event.identity?.toolUseId,
    permissionRequestId: snapshot.permissionRequestId,
    event: {
      id: event.id,
      type: event.type,
      status: event.status,
      sourceKind: event.sourceKind,
    },
    safeDetails: snapshot.safeDetails,
    rawRef: snapshot.rawRef,
  })) as Record<string, unknown>
}

function getErrorMetaItems(snapshot: CcrErrorSnapshot) {
  const boundaryLabel = getPolicyBoundaryLabel(snapshot)
  return [
    { label: '错误 ID', value: snapshot.errorId },
    { label: '严重级别', value: getSeverityText(snapshot.severity) },
    boundaryLabel ? { label: '边界', value: boundaryLabel } : null,
    { label: '可重试', value: getRetryableText(snapshot.retryable) },
    snapshot.retryAfterMs !== undefined
      ? { label: '建议等待', value: formatDuration(snapshot.retryAfterMs) }
      : null,
    snapshot.requestId ? { label: '请求 ID', value: snapshot.requestId } : null,
    snapshot.turnId ? { label: 'Turn', value: snapshot.turnId } : null,
    snapshot.toolUseId ? { label: '工具', value: snapshot.toolUseId } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>
}

function getActionDisabledReason(
  action: CcrErrorAction,
  snapshot: CcrErrorSnapshot,
  capabilities: ErrorActionCapabilities,
): string | undefined {
  if (action === 'retry') {
    if (snapshot.retryable === false) {
      return '该错误不适合直接重试。'
    }
    if (!capabilities.hasRetrySnapshot) {
      return '当前错误缺少可重放输入快照，先在输入框重新发送。'
    }
  }
  if (action === 'switch_model' && !capabilities.canOpenModels) {
    return '当前界面没有模型切换入口。'
  }
  if (action === 'open_logs' && !capabilities.canOpenLogs) {
    return '当前界面没有日志入口。'
  }
  return undefined
}

function getActionLabel(action: CcrErrorAction): string {
  switch (action) {
    case 'retry':
      return '重试'
    case 'switch_model':
      return '切换模型'
    case 'reauth':
      return '重新登录'
    case 'open_logs':
      return '打开日志'
    case 'copy_diagnostics':
      return '复制诊断'
  }
}

function getActionTitle(action: CcrErrorAction): string {
  switch (action) {
    case 'retry':
      return '重新执行上一轮请求'
    case 'switch_model':
      return '打开模型页选择其他模型'
    case 'reauth':
      return '使用当前 provider 重新登录'
    case 'open_logs':
      return '打开日志页查看最近事件'
    case 'copy_diagnostics':
      return '复制已脱敏的诊断信息'
  }
}

function getCategoryText(category: CcrErrorSnapshot['category']): string {
  switch (category) {
    case 'auth_expired':
      return '认证'
    case 'rate_limited':
      return '限流'
    case 'quota_exceeded':
      return '额度'
    case 'model_refusal':
      return '拒答'
    case 'safety_blocked':
      return '安全'
    case 'tool_error':
      return '工具'
    case 'network_error':
      return '网络'
    case 'protocol_error':
      return '协议'
    case 'unknown_error':
      return '未知'
  }
}

function getSourceText(source: CcrErrorSnapshot['source']): string {
  switch (source) {
    case 'desktop':
      return 'Desktop'
    case 'app_server':
      return 'App Server'
    case 'core':
      return 'Core'
    case 'provider':
      return 'Provider'
    case 'tool':
      return 'Tool'
    case 'mcp':
      return 'MCP'
    case 'network':
      return 'Network'
    case 'unknown':
      return 'Unknown'
  }
}

function getSeverityText(severity: CcrErrorSnapshot['severity']): string {
  switch (severity) {
    case 'info':
      return '提示'
    case 'warning':
      return '警告'
    case 'error':
      return '错误'
    case 'fatal':
      return '严重'
  }
}

function getRetryableText(value: CcrErrorSnapshot['retryable']): string {
  if (value === true) {
    return '是'
  }
  if (value === false) {
    return '否'
  }
  return '未知'
}

function getCategoryClass(snapshot: CcrErrorSnapshot): string {
  return `is-${snapshot.category}`
}

export function getRateLimitHint(
  snapshot: CcrErrorSnapshot,
): string | undefined {
  if (snapshot.category !== 'rate_limited') {
    return undefined
  }
  if (snapshot.retryAfterMs !== undefined) {
    return `建议等待 ${formatDuration(snapshot.retryAfterMs)} 后重试。`
  }
  const resetValue = pickHintValue(snapshot.safeDetails, [
    'resetAt',
    'rateLimitReset',
    'x-ratelimit-reset',
  ])
  return resetValue ? `限流窗口重置时间：${resetValue}` : undefined
}

export function getQuotaHint(
  snapshot: CcrErrorSnapshot,
): string | undefined {
  if (snapshot.category !== 'quota_exceeded') {
    return undefined
  }
  const remaining = pickHintValue(snapshot.safeDetails, [
    'remaining',
    'remainingQuota',
    'remainingCredits',
    'creditBalance',
  ])
  const used = pickHintValue(snapshot.safeDetails, [
    'used',
    'usedQuota',
    'spentCredits',
  ])
  const limit = pickHintValue(snapshot.safeDetails, ['limit', 'quotaLimit'])
  const billing = pickHintValue(snapshot.safeDetails, [
    'billing',
    'billingState',
    'paymentState',
  ])
  const parts = [
    remaining ? `剩余额度 ${remaining}` : undefined,
    used ? `已用 ${used}` : undefined,
    limit ? `总额度 ${limit}` : undefined,
    billing ? `账单状态 ${billing}` : undefined,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join('，') : undefined
}

export function getPolicyBoundaryLabel(
  snapshot: CcrErrorSnapshot,
): string | undefined {
  if (snapshot.category === 'model_refusal') {
    return '模型拒答'
  }
  if (snapshot.category === 'safety_blocked') {
    return isLocalSafetySnapshot(snapshot)
      ? 'CCR 本地安全策略'
      : 'Provider 安全策略'
  }
  if (isToolPermissionDeniedSnapshot(snapshot)) {
    return '工具权限拒绝'
  }
  return undefined
}

export function getPolicyBoundaryHint(
  snapshot: CcrErrorSnapshot,
): string | undefined {
  const label = getPolicyBoundaryLabel(snapshot)
  if (label === '模型拒答') {
    return '模型主动返回拒答信号，不是网络或工具失败；可以调整问题表述、补充上下文，或切换模型。'
  }
  if (label === 'Provider 安全策略') {
    return '请求被 provider 的内容安全策略拦截；CCR 已保留脱敏诊断，原始响应不直接铺到界面。'
  }
  if (label === 'CCR 本地安全策略') {
    return '请求被 CCR 本地安全策略拦截；请检查权限设置、工作区边界或本地策略配置。'
  }
  if (label === '工具权限拒绝') {
    return '工具没有拿到执行权限，或文件系统拒绝访问；这和模型拒答不同，需要检查授权或路径权限。'
  }
  return undefined
}

function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '现在'
  }
  if (value < 1000) {
    return `${value}ms`
  }
  const seconds = Math.round(value / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60
  return restSeconds ? `${minutes}m ${restSeconds}s` : `${minutes}m`
}

function compactDiagnostics(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => {
      if (nestedValue === undefined || nestedValue === null) {
        return false
      }
      if (typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
        return Object.keys(nestedValue as Record<string, unknown>).length > 0
      }
      return true
    }),
  )
}

function redactDiagnosticText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gu, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gu, 'sk-[REDACTED]')
    .replace(/(api[_-]?key=)[^&\s]+/giu, '$1[REDACTED]')
    .replace(
      /\b(refresh_token|access_token|id_token|authorization|cookie)=([^&\s]+)/giu,
      '$1=[REDACTED]',
    )
    .replace(
      /"(refresh_token|access_token|id_token|authorization|cookie)"\s*:\s*"[^"]*"/giu,
      '"$1":"[REDACTED]"',
    )
    .replace(/\b([A-Za-z]:\\Users\\)[^\\\s]+/gu, '$1[USER]')
    .replace(/\/Users\/[^/\s]+/gu, '/Users/[USER]')
    .replace(/\/home\/[^/\s]+/gu, '/home/[USER]')
}

function pickHintValue(
  details: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!details) {
    return undefined
  }
  const normalizedMap = new Map<string, unknown>()
  collectHintValues(details, normalizedMap, 0)
  for (const key of keys) {
    const value = normalizedMap.get(normalizeHintKey(key))
    if (value === undefined || value === null) {
      continue
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim()
      if (text) {
        return text
      }
    }
  }
  return undefined
}

function normalizeHintKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/gu, '')
}

function collectHintValues(
  value: unknown,
  output: Map<string, unknown>,
  depth: number,
): void {
  if (!value || typeof value !== 'object' || depth > 4) {
    return
  }
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeHintKey(key)
    if (!output.has(normalizedKey)) {
      output.set(normalizedKey, child)
    }
    collectHintValues(child, output, depth + 1)
  }
}

export function sanitizeDiagnosticPayload(value: unknown): unknown {
  return sanitizeDiagnosticValue(value, 0)
}

function sanitizeDiagnosticValue(value: unknown, depth: number): unknown {
  if (depth > 8) {
    return '[DEPTH_LIMIT]'
  }
  if (typeof value === 'string') {
    return redactDiagnosticText(value)
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeDiagnosticValue(item, depth + 1))
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  const output: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    output[key] = isSensitiveDiagnosticKey(key)
      ? '[REDACTED]'
      : sanitizeDiagnosticValue(child, depth + 1)
  }
  return output
}

function isSensitiveDiagnosticKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return [
    'authorization',
    'api_key',
    'apikey',
    'access_token',
    'refresh_token',
    'id_token',
    'cookie',
    'set-cookie',
    'password',
    'secret',
    'token',
    'credential',
  ].some(part => normalized.includes(part))
}

function isLocalSafetySnapshot(snapshot: CcrErrorSnapshot): boolean {
  if (
    snapshot.source === 'desktop' ||
    snapshot.source === 'app_server' ||
    snapshot.source === 'core'
  ) {
    return true
  }
  const policySource = pickHintValue(snapshot.safeDetails, [
    'policySource',
    'safetySource',
    'source',
  ])
  if (!policySource) {
    return false
  }
  const normalized = policySource.toLowerCase()
  return (
    normalized.includes('ccr') ||
    normalized.includes('local') ||
    normalized.includes('desktop') ||
    normalized.includes('app_server') ||
    normalized.includes('core')
  )
}

function isToolPermissionDeniedSnapshot(snapshot: CcrErrorSnapshot): boolean {
  if (snapshot.category !== 'tool_error' && snapshot.source !== 'tool') {
    return false
  }
  const errorClass = pickHintValue(snapshot.safeDetails, ['errorClass'])
  const status = pickHintValue(snapshot.safeDetails, ['status'])
  return (
    snapshot.permissionRequestId !== undefined ||
    errorClass === 'permission_denied' ||
    status === 'denied'
  )
}
