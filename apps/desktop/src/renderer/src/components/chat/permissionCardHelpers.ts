import type {
  JsonObject,
  PermissionCard,
  PermissionRespondPayload,
} from '../../domain/displayTypes.js'

export type PermissionSuggestion = {
  type?: string
  behavior?: string
  destination?: string
  rules?: Array<{
    toolName?: string
    ruleContent?: string
  }>
}

export type PermissionResponseHandler = (
  permissionRequestId: string,
  behavior: 'allow' | 'deny',
  payload?: PermissionRespondPayload,
) => Promise<void>

export function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function getObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' ? (value as JsonObject) : undefined
}

export function extractPermissionSuggestions(
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

export function formatPermissionStatus(
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
    return '已允许'
  }
  if (status === 'denied') {
    return '已拒绝'
  }
  return '已取消'
}

export function formatSuggestion(suggestion: PermissionSuggestion): string {
  const rules = suggestion.rules ?? []
  const firstRule = rules[0]
  const ruleText = [firstRule?.toolName, firstRule?.ruleContent]
    .filter(Boolean)
    .join(':')
  const behavior = suggestion.behavior ?? 'allow'
  const destination = suggestion.destination ?? 'session'
  return [behavior, ruleText, destination].filter(Boolean).join(' · ')
}

export function createAllowPayload(
  permission: PermissionCard,
  extraPayload: PermissionRespondPayload = {},
): PermissionRespondPayload {
  return {
    ...extraPayload,
    updatedInput: permission.input,
    toolUseID: permission.toolUseId,
    decisionClassification: extraPayload.updatedPermissions
      ? 'user_permanent'
      : 'user_temporary',
  }
}

export function createDenyPayload(
  permission: PermissionCard,
  message: string,
): PermissionRespondPayload {
  return {
    message,
    interrupt: false,
    toolUseID: permission.toolUseId,
    decisionClassification: 'user_reject',
  }
}

export function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
