import type { JsonRpcErrorResponse, JsonRpcResponseId } from './protocol.js'
import { ZodError } from 'zod'

export type AppServerErrorKind =
  | 'parse_error'
  | 'invalid_request'
  | 'method_not_found'
  | 'invalid_params'
  | 'internal_error'
  | 'not_initialized'
  | 'already_initialized'
  | 'unsupported_transport'
  | 'workspace_not_open'
  | 'auth_required'
  | 'operation_in_progress'
  | 'thread_not_found'
  | 'turn_not_found'
  | 'turn_not_active'
  | 'permission_not_found'
  | 'permission_not_pending'

type ErrorDescriptor = {
  code: number
  message: string
}

const ERROR_DESCRIPTORS: Record<AppServerErrorKind, ErrorDescriptor> = {
  parse_error: {
    code: -32700,
    message: 'Parse error.',
  },
  invalid_request: {
    code: -32600,
    message: 'Invalid request.',
  },
  method_not_found: {
    code: -32601,
    message: 'Method not found.',
  },
  invalid_params: {
    code: -32602,
    message: 'Invalid params.',
  },
  internal_error: {
    code: -32603,
    message: 'Internal error.',
  },
  not_initialized: {
    code: -32001,
    message: 'App Server is not initialized.',
  },
  already_initialized: {
    code: -32002,
    message: 'App Server is already initialized.',
  },
  unsupported_transport: {
    code: -32003,
    message: 'Unsupported App Server transport.',
  },
  workspace_not_open: {
    code: -32005,
    message: 'Workspace is not open.',
  },
  auth_required: {
    code: -32006,
    message: 'Authentication is required.',
  },
  operation_in_progress: {
    code: -32008,
    message: 'Operation is already in progress.',
  },
  thread_not_found: {
    code: -32011,
    message: 'Thread not found.',
  },
  turn_not_found: {
    code: -32012,
    message: 'Turn not found.',
  },
  turn_not_active: {
    code: -32013,
    message: 'Turn is not active.',
  },
  permission_not_found: {
    code: -32021,
    message: 'Permission request not found.',
  },
  permission_not_pending: {
    code: -32022,
    message: 'Permission request is no longer pending.',
  },
}

export class AppServerError extends Error {
  readonly kind: AppServerErrorKind
  readonly code: number
  readonly details?: unknown

  constructor(kind: AppServerErrorKind, message?: string, details?: unknown) {
    const descriptor = ERROR_DESCRIPTORS[kind]
    super(message ?? descriptor.message)
    this.name = 'AppServerError'
    this.kind = kind
    this.code = descriptor.code
    this.details = details
  }
}

export function toAppServerError(error: unknown): AppServerError {
  if (error instanceof AppServerError) {
    return error
  }

  if (error instanceof ZodError) {
    return new AppServerError('invalid_params', undefined, error.issues)
  }

  if (isCoreErrorLike(error)) {
    return new AppServerError(error.kind, error.message, error.details)
  }

  if (error instanceof Error) {
    return new AppServerError('internal_error', error.message)
  }

  return new AppServerError('internal_error')
}

function isCoreErrorLike(
  error: unknown,
): error is Error & { kind: AppServerErrorKind; details?: unknown } {
  return (
    error instanceof Error &&
    'kind' in error &&
    typeof error.kind === 'string' &&
    error.kind in ERROR_DESCRIPTORS
  )
}

export function errorResponse(
  id: JsonRpcResponseId,
  error: unknown,
): JsonRpcErrorResponse {
  const appError = toAppServerError(error)
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: appError.code,
      message: appError.message,
      data: {
        kind: appError.kind,
        ...(appError.details === undefined ? {} : { details: appError.details }),
      },
    },
  }
}
