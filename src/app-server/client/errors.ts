import type { JsonRpcErrorResponse } from '../protocol.js'

export type AppServerClientErrorKind =
  | 'spawn_failed'
  | 'process_exited'
  | 'request_timeout'
  | 'parse_error'
  | 'protocol_error'
  | 'server_error'
  | 'not_initialized'
  | 'capability_mismatch'
  | 'closed'

export class AppServerClientError extends Error {
  readonly kind: AppServerClientErrorKind
  readonly details?: unknown

  constructor(kind: AppServerClientErrorKind, message: string, details?: unknown) {
    super(message)
    this.name = 'AppServerClientError'
    this.kind = kind
    this.details = details
  }
}

export function jsonRpcErrorToClientError(
  response: JsonRpcErrorResponse,
): AppServerClientError {
  const kind =
    response.error.data.kind === 'not_initialized'
      ? 'not_initialized'
      : 'server_error'

  return new AppServerClientError(kind, response.error.message, {
    code: response.error.code,
    kind: response.error.data.kind,
    details: response.error.data.details,
  })
}
