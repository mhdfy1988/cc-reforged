import type {
  JsonRpcNotification,
  JsonRpcParams,
  JsonRpcResponse,
} from '../protocol.js'
import type { AppServerClientError } from './errors.js'

export type Unsubscribe = () => void

export type TransportCloseEvent = {
  code: number | null
  signal: NodeJS.Signals | null
  stderr?: string
  error?: unknown
  failed?: boolean
  isMaxBuffer?: boolean
}

export type JsonRpcLineTransport = {
  sendLine: (line: string) => void
  close: () => void
  onLine: (listener: (line: string) => void) => Unsubscribe
  onClose: (listener: (event: TransportCloseEvent) => void) => Unsubscribe
}

export type RequestOptions = {
  timeoutMs?: number
}

export type JsonRpcClientOptions = {
  defaultTimeoutMs?: number
}

export type JsonRpcNotificationListener = (
  notification: JsonRpcNotification,
) => void

export type JsonRpcResponseListener = (response: JsonRpcResponse) => void

export type JsonRpcErrorListener = (error: AppServerClientError) => void

export type JsonRpcRequestPayload = {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: JsonRpcParams
}
