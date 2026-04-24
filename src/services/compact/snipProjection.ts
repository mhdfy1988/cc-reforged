export type SnipBoundaryMessage = {
  subtype?: string
  type?: string
  [key: string]: unknown
}

export function isSnipBoundaryMessage(value: unknown): value is SnipBoundaryMessage {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return record.subtype === 'snip_boundary' || record.type === 'snip_boundary'
}

export function projectView<T>(value: T): T {
  return value
}
