// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { z } from 'zod/v4'
import {
  type HookEvent,
  HOOK_EVENTS,
  type HookInput,
  type PermissionUpdate,
} from 'src/entrypoints/agentSdkTypes.js'
import type {
  HookJSONOutput,
  AsyncHookJSONOutput,
  SyncHookJSONOutput,
} from 'src/entrypoints/sdk/coreTypes.js'
import {
  HookJSONOutputSchema,
  PromptRequestSchema,
  PromptResponseSchema,
} from 'src/entrypoints/sdk/coreSchemas.js'
import type { Message } from 'src/types/message.js'
import type { PermissionResult } from 'src/utils/permissions/PermissionResult.js'
import type { AppState } from '../state/AppState.js'
import type { AttributionState } from '../utils/commitAttribution.js'

export function isHookEvent(value: string): value is HookEvent {
  return HOOK_EVENTS.includes(value as HookEvent)
}

// Prompt elicitation protocol types. The `prompt` key acts as discriminator
// (mirroring the {async:true} pattern), with the id as its value.
export const promptRequestSchema = PromptRequestSchema

export type PromptRequest = z.infer<ReturnType<typeof promptRequestSchema>>

export const promptResponseSchema = PromptResponseSchema

export type PromptResponse = z.infer<ReturnType<typeof promptResponseSchema>>

// Zod schema for hook JSON output validation
export const hookJSONOutputSchema = HookJSONOutputSchema

// Infer the TypeScript type from the schema
type SchemaHookJSONOutput = z.infer<ReturnType<typeof hookJSONOutputSchema>>

// Type guard function to check if response is sync
export function isSyncHookJSONOutput(
  json: HookJSONOutput,
): json is SyncHookJSONOutput {
  return !('async' in json && json.async === true)
}

// Type guard function to check if response is async
export function isAsyncHookJSONOutput(
  json: HookJSONOutput,
): json is AsyncHookJSONOutput {
  return 'async' in json && json.async === true
}

// Compile-time assertion that SDK and Zod types match
import type { IsEqual } from 'type-fest'
type Assert<T extends true> = T
type _assertSDKTypesMatch = Assert<
  IsEqual<SchemaHookJSONOutput, HookJSONOutput>
>

/** Context passed to callback hooks for state access */
export type HookCallbackContext = {
  getAppState: () => AppState
  updateAttributionState: (
    updater: (prev: AttributionState) => AttributionState,
  ) => void
}

/** Hook that is a callback. */
export type HookCallback = {
  type: 'callback'
  callback: (
    input: HookInput,
    toolUseID: string | null,
    abort: AbortSignal | undefined,
    /** Hook index for SessionStart hooks to compute CLAUDE_ENV_FILE path */
    hookIndex?: number,
    /** Optional context for accessing app state */
    context?: HookCallbackContext,
  ) => Promise<HookJSONOutput>
  /** Timeout in seconds for this hook */
  timeout?: number
  /** Internal hooks (e.g. session file access analytics) are excluded from tengu_run_hook metrics */
  internal?: boolean
}

export type HookCallbackMatcher = {
  matcher?: string
  hooks: HookCallback[]
  pluginName?: string
}

export type HookProgress = {
  type: 'hook_progress'
  hookEvent: HookEvent
  hookName: string
  command: string
  promptText?: string
  statusMessage?: string
}

export type HookBlockingError = {
  blockingError: string
  command: string
}

export type PermissionRequestResult =
  | {
      behavior: 'allow'
      updatedInput?: Record<string, unknown>
      updatedPermissions?: PermissionUpdate[]
    }
  | {
      behavior: 'deny'
      message?: string
      interrupt?: boolean
    }

export type HookResult = {
  message?: Message
  systemMessage?: Message
  blockingError?: HookBlockingError
  outcome: 'success' | 'blocking' | 'non_blocking_error' | 'cancelled'
  preventContinuation?: boolean
  stopReason?: string
  permissionBehavior?: 'ask' | 'deny' | 'allow' | 'passthrough'
  hookPermissionDecisionReason?: string
  additionalContext?: string
  initialUserMessage?: string
  updatedInput?: Record<string, unknown>
  updatedMCPToolOutput?: unknown
  permissionRequestResult?: PermissionRequestResult
  retry?: boolean
}

export type AggregatedHookResult = {
  message?: Message
  blockingErrors?: HookBlockingError[]
  preventContinuation?: boolean
  stopReason?: string
  hookPermissionDecisionReason?: string
  permissionBehavior?: PermissionResult['behavior']
  additionalContexts?: string[]
  initialUserMessage?: string
  updatedInput?: Record<string, unknown>
  updatedMCPToolOutput?: unknown
  permissionRequestResult?: PermissionRequestResult
  retry?: boolean
}
