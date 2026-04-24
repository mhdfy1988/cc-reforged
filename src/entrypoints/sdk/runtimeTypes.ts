import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { z } from 'zod/v4'
import type {
  SDKMessage,
  SDKResultMessage,
  SDKUserMessage,
} from './coreTypes.js'

export type EffortLevel = 'low' | 'medium' | 'high' | 'max'

export type AnyZodRawShape = Record<string, z.ZodTypeAny>

export type InferShape<Schema extends AnyZodRawShape> = {
  [Key in keyof Schema]: z.infer<Schema[Key]>
}

export type ForkSessionOptions = {
  dir?: string
  upToMessageId?: string
  title?: string
}

export type ForkSessionResult = {
  sessionId: string
}

export type GetSessionInfoOptions = {
  dir?: string
}

export type GetSessionMessagesOptions = {
  dir?: string
  limit?: number
  offset?: number
  includeSystemMessages?: boolean
}

export type InternalOptions = Record<string, unknown>

export type InternalQuery = AsyncGenerator<SDKMessage, void, unknown>

export type ListSessionsOptions = {
  dir?: string
  limit?: number
  offset?: number
}

export type McpSdkServerConfigWithInstance = {
  name: string
  version?: string
  tools?: Array<SdkMcpToolDefinition<any>>
  server?: unknown
}

export type Options = Record<string, unknown>

export type Query = AsyncGenerator<SDKMessage, void, unknown>

export type SDKSession = {
  sessionId?: string
  close?(): Promise<void> | void
  query?(prompt: string | AsyncIterable<SDKUserMessage>): AsyncGenerator<
    SDKMessage,
    void,
    unknown
  >
  resume?(sessionId: string): Promise<SDKSession | void> | SDKSession | void
  send?(message: SDKUserMessage): Promise<void> | void
}

export type SDKSessionOptions = Record<string, unknown>

export type SessionMessage = SDKMessage | SDKUserMessage | SDKResultMessage

export type SessionMutationOptions = {
  dir?: string
}

export type SdkMcpToolDefinition<Schema extends AnyZodRawShape> = {
  name: string
  description: string
  inputSchema: Schema
  call: (
    args: InferShape<Schema>,
    extra: unknown,
  ) => Promise<CallToolResult>
  annotations?: ToolAnnotations
  searchHint?: string
  alwaysLoad?: boolean
}
