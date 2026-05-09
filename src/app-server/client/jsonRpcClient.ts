import {
  JsonRpcNotificationSchema,
  JsonRpcResponseSchema,
  type JsonRpcId,
  type JsonRpcNotification,
  type JsonRpcParams,
  type JsonRpcResponse,
} from '../protocol.js'
import {
  AppServerClientError,
  jsonRpcErrorToClientError,
} from './errors.js'
import type {
  JsonRpcClientOptions,
  JsonRpcErrorListener,
  JsonRpcLineTransport,
  JsonRpcNotificationListener,
  RequestOptions,
  Unsubscribe,
} from './types.js'

type PendingRequest = {
  method: string
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  timer?: ReturnType<typeof setTimeout>
}

type TimedOutRequest = {
  method: string
  timeoutMs: number
  cleanupTimer: ReturnType<typeof setTimeout>
}

const DEFAULT_TIMEOUT_MS = 30_000
const LATE_RESPONSE_RETENTION_MS = 10 * 60_000

export class JsonRpcClient {
  private nextId = 1
  private closed = false
  private readonly pending = new Map<JsonRpcId, PendingRequest>()
  private readonly timedOutRequests = new Map<JsonRpcId, TimedOutRequest>()
  private readonly notifications = new Set<JsonRpcNotificationListener>()
  private readonly errors = new Set<JsonRpcErrorListener>()
  private readonly disposers: Unsubscribe[]
  private readonly defaultTimeoutMs: number

  constructor(
    private readonly transport: JsonRpcLineTransport,
    options: JsonRpcClientOptions = {},
  ) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS
    this.disposers = [
      transport.onLine(line => this.handleLine(line)),
      transport.onClose(event => {
        this.rejectAll(
          new AppServerClientError(
            'process_exited',
            'App Server process exited before all requests completed.',
            event,
          ),
        )
      }),
    ]
  }

  request<T>(
    method: string,
    params?: JsonRpcParams,
    options: RequestOptions = {},
  ): Promise<T> {
    if (this.closed) {
      return Promise.reject(
        new AppServerClientError('closed', 'App Server client is closed.'),
      )
    }

    const id = this.nextId++
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params === undefined ? {} : { params }),
    }

    return new Promise<T>((resolve, reject) => {
      const pending: PendingRequest = {
        method,
        resolve: value => resolve(value as T),
        reject,
      }

      if (timeoutMs > 0) {
        pending.timer = setTimeout(() => {
          this.pending.delete(id)
          this.trackTimedOutRequest(id, method, timeoutMs)
          reject(
            new AppServerClientError(
              'request_timeout',
              `App Server request timed out: ${method}`,
              { method, timeoutMs },
            ),
          )
        }, timeoutMs)
      }

      this.pending.set(id, pending)

      try {
        this.transport.sendLine(JSON.stringify(payload))
      } catch (error) {
        this.pending.delete(id)
        this.clearTimer(pending)
        reject(error)
      }
    })
  }

  notify(method: string, params?: JsonRpcParams): void {
    if (this.closed) {
      throw new AppServerClientError('closed', 'App Server client is closed.')
    }

    this.transport.sendLine(
      JSON.stringify({
        jsonrpc: '2.0',
        method,
        ...(params === undefined ? {} : { params }),
      }),
    )
  }

  onNotification(listener: JsonRpcNotificationListener): Unsubscribe {
    this.notifications.add(listener)
    return () => this.notifications.delete(listener)
  }

  onError(listener: JsonRpcErrorListener): Unsubscribe {
    this.errors.add(listener)
    return () => this.errors.delete(listener)
  }

  close(): void {
    if (this.closed) {
      return
    }

    this.closed = true
    this.disposers.forEach(dispose => dispose())
    this.rejectAll(new AppServerClientError('closed', 'App Server client is closed.'))
    this.clearTimedOutRequests()
    this.transport.close()
  }

  private handleLine(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) {
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch (error) {
      this.emitError(
        new AppServerClientError('parse_error', 'Invalid JSON from App Server.', {
          line: trimmed,
          error,
        }),
      )
      return
    }

    const responseParse = JsonRpcResponseSchema.safeParse(parsed)
    if (responseParse.success) {
      this.handleResponse(responseParse.data as JsonRpcResponse)
      return
    }

    const notificationParse = JsonRpcNotificationSchema.safeParse(parsed)
    if (notificationParse.success) {
      this.emitNotification(notificationParse.data as JsonRpcNotification)
      return
    }

    this.emitError(
      new AppServerClientError(
        'protocol_error',
        'Unknown App Server protocol message.',
        { message: parsed },
      ),
    )
  }

  private handleResponse(response: JsonRpcResponse): void {
    if (response.id === null) {
      this.emitError(
        new AppServerClientError(
          'protocol_error',
          'App Server returned a response without request id.',
          response,
        ),
      )
      return
    }

    const pending = this.pending.get(response.id)
    if (!pending) {
      if (this.timedOutRequests.has(response.id)) {
        this.clearTimedOutRequest(response.id)
        return
      }

      this.emitError(
        new AppServerClientError(
          'protocol_error',
          'App Server returned a response for an unknown request.',
          response,
        ),
      )
      return
    }

    this.pending.delete(response.id)
    this.clearTimer(pending)

    if ('error' in response) {
      pending.reject(jsonRpcErrorToClientError(response))
      return
    }

    pending.resolve(response.result)
  }

  private emitNotification(notification: JsonRpcNotification): void {
    for (const listener of this.notifications) {
      listener(notification)
    }
  }

  private emitError(error: AppServerClientError): void {
    for (const listener of this.errors) {
      listener(error)
    }
  }

  private rejectAll(error: AppServerClientError): void {
    for (const pending of this.pending.values()) {
      this.clearTimer(pending)
      pending.reject(error)
    }
    this.pending.clear()
  }

  private clearTimer(pending: PendingRequest): void {
    if (pending.timer) {
      clearTimeout(pending.timer)
    }
  }

  private trackTimedOutRequest(
    id: JsonRpcId,
    method: string,
    timeoutMs: number,
  ): void {
    this.clearTimedOutRequest(id)
    const cleanupTimer = setTimeout(() => {
      this.timedOutRequests.delete(id)
    }, LATE_RESPONSE_RETENTION_MS)
    this.timedOutRequests.set(id, { method, timeoutMs, cleanupTimer })
  }

  private clearTimedOutRequest(id: JsonRpcId): void {
    const request = this.timedOutRequests.get(id)
    if (!request) {
      return
    }

    clearTimeout(request.cleanupTimer)
    this.timedOutRequests.delete(id)
  }

  private clearTimedOutRequests(): void {
    for (const request of this.timedOutRequests.values()) {
      clearTimeout(request.cleanupTimer)
    }
    this.timedOutRequests.clear()
  }
}
