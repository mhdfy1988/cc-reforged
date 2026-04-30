export type CoreErrorKind =
  | 'invalid_params'
  | 'workspace_not_open'
  | 'auth_required'
  | 'operation_in_progress'
  | 'thread_not_found'
  | 'turn_not_found'
  | 'turn_not_active'
  | 'permission_not_found'
  | 'permission_not_pending'
  | 'internal_error'

export class CoreError extends Error {
  readonly kind: CoreErrorKind
  readonly details?: unknown

  constructor(kind: CoreErrorKind, message: string, details?: unknown) {
    super(message)
    this.name = 'CoreError'
    this.kind = kind
    this.details = details
  }
}
