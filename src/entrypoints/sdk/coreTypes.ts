// SDK Core Types - Common serializable types used by both SDK consumers and SDK builders.
//
// Recovery note:
// This project snapshot does not include the generated `coreTypes.generated`
// file set, so we keep the public SDK surface flowing by deriving the common
// exports directly from the committed Zod schemas.

import { z } from 'zod/v4'
import type { NonNullableUsage } from './sdkUtilityTypes.js'
import {
  ApiKeySourceSchema,
  HookEventSchema,
  McpServerConfigForProcessTransportSchema,
  McpServerStatusSchema,
  ModelInfoSchema,
  ModelUsageSchema,
  NotificationHookInputSchema,
  PermissionDeniedHookInputSchema,
  PermissionResultSchema,
  PermissionRequestHookInputSchema,
  PermissionUpdateSchema,
  PermissionModeSchema,
  PostCompactHookInputSchema,
  PostToolUseFailureHookInputSchema,
  PostToolUseHookInputSchema,
  PreCompactHookInputSchema,
  PreToolUseHookInputSchema,
  RewindFilesResultSchema,
  SDKAssistantMessageErrorSchema,
  SDKAssistantMessageSchema,
  SDKCompactBoundaryMessageSchema,
  SDKHookProgressMessageSchema,
  SDKHookResponseMessageSchema,
  SDKHookStartedMessageSchema,
  SDKPermissionDenialSchema,
  SDKMessageSchema,
  SDKPartialAssistantMessageSchema,
  SDKResultMessageSchema,
  SDKResultErrorSchema,
  SDKResultSuccessSchema,
  SDKSessionInfoSchema,
  SDKStatusSchema,
  SDKStatusMessageSchema,
  SDKRateLimitInfoSchema,
  SDKStreamlinedTextMessageSchema,
  SDKStreamlinedToolUseSummaryMessageSchema,
  SDKSystemMessageSchema,
  SDKToolProgressMessageSchema,
  SDKToolUseSummaryMessageSchema,
  SDKUserMessageReplaySchema,
  SDKUserMessageSchema,
  SessionStartHookInputSchema,
  SessionEndHookInputSchema,
  SetupHookInputSchema,
  StopFailureHookInputSchema,
  StopHookInputSchema,
  SubagentStartHookInputSchema,
  SubagentStopHookInputSchema,
  TaskCompletedHookInputSchema,
  TaskCreatedHookInputSchema,
  TeammateIdleHookInputSchema,
  ConfigChangeHookInputSchema,
  CwdChangedHookInputSchema,
  ElicitationHookInputSchema,
  ElicitationResultHookInputSchema,
  FileChangedHookInputSchema,
  InstructionsLoadedHookInputSchema,
  UserPromptSubmitHookInputSchema,
  WorktreeCreateHookInputSchema,
  WorktreeRemoveHookInputSchema,
  PreToolUseHookSpecificOutputSchema,
  UserPromptSubmitHookSpecificOutputSchema,
  SessionStartHookSpecificOutputSchema,
  SetupHookSpecificOutputSchema,
  SubagentStartHookSpecificOutputSchema,
  PostToolUseHookSpecificOutputSchema,
  PostToolUseFailureHookSpecificOutputSchema,
  PermissionDeniedHookSpecificOutputSchema,
  NotificationHookSpecificOutputSchema,
  PermissionRequestHookSpecificOutputSchema,
  ElicitationHookSpecificOutputSchema,
  ElicitationResultHookSpecificOutputSchema,
  CwdChangedHookSpecificOutputSchema,
  FileChangedHookSpecificOutputSchema,
  WorktreeCreateHookSpecificOutputSchema,
} from './coreSchemas.js'

// Re-export sandbox types for SDK consumers.
export type {
  SandboxFilesystemConfig,
  SandboxIgnoreViolations,
  SandboxNetworkConfig,
  SandboxSettings,
} from '../sandboxTypes.js'

// Re-export utility types that can't be expressed as Zod schemas.
export type { NonNullableUsage }
export type Settings = Record<string, unknown>

export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'StopFailure',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
  'PermissionRequest',
  'PermissionDenied',
  'Setup',
  'TeammateIdle',
  'TaskCreated',
  'TaskCompleted',
  'Elicitation',
  'ElicitationResult',
  'ConfigChange',
  'WorktreeCreate',
  'WorktreeRemove',
  'InstructionsLoaded',
  'CwdChanged',
  'FileChanged',
] as const

export const EXIT_REASONS = [
  'clear',
  'resume',
  'logout',
  'prompt_input_exit',
  'other',
  'bypass_permissions_disabled',
] as const

export type HookEvent = z.infer<ReturnType<typeof HookEventSchema>>
export type PermissionMode = z.infer<ReturnType<typeof PermissionModeSchema>>
export type ApiKeySource = z.infer<ReturnType<typeof ApiKeySourceSchema>>
export type McpServerConfigForProcessTransport = z.infer<
  ReturnType<typeof McpServerConfigForProcessTransportSchema>
>
export type McpServerStatus = z.infer<ReturnType<typeof McpServerStatusSchema>>
export type ModelInfo = z.infer<ReturnType<typeof ModelInfoSchema>>
export type ModelUsage = z.infer<ReturnType<typeof ModelUsageSchema>>
export type SDKAssistantMessageError = z.infer<
  ReturnType<typeof SDKAssistantMessageErrorSchema>
>
export type PermissionResult = z.infer<ReturnType<typeof PermissionResultSchema>>
export type SDKPermissionDenial = z.infer<
  ReturnType<typeof SDKPermissionDenialSchema>
>
export type PermissionUpdate = z.infer<ReturnType<typeof PermissionUpdateSchema>>
export type RewindFilesResult = z.infer<ReturnType<typeof RewindFilesResultSchema>>
export type SDKAssistantMessage = z.infer<ReturnType<typeof SDKAssistantMessageSchema>>
export type SDKCompactBoundaryMessage = z.infer<
  ReturnType<typeof SDKCompactBoundaryMessageSchema>
>
export type SDKHookProgressMessage = z.infer<ReturnType<typeof SDKHookProgressMessageSchema>>
export type SDKHookResponseMessage = z.infer<ReturnType<typeof SDKHookResponseMessageSchema>>
export type SDKHookStartedMessage = z.infer<ReturnType<typeof SDKHookStartedMessageSchema>>
export type SDKMessage = z.infer<ReturnType<typeof SDKMessageSchema>>
export type SDKPartialAssistantMessage = z.infer<
  ReturnType<typeof SDKPartialAssistantMessageSchema>
>
export type SDKResultMessage = z.infer<ReturnType<typeof SDKResultMessageSchema>>
export type SDKResultError = z.infer<ReturnType<typeof SDKResultErrorSchema>>
export type SDKResultSuccess = z.infer<ReturnType<typeof SDKResultSuccessSchema>>
export type SDKSessionInfo = z.infer<ReturnType<typeof SDKSessionInfoSchema>>
export type SDKStatus = z.infer<ReturnType<typeof SDKStatusSchema>>
export type SDKStatusMessage = z.infer<ReturnType<typeof SDKStatusMessageSchema>>
export type SDKRateLimitInfo = z.infer<ReturnType<typeof SDKRateLimitInfoSchema>>
export type SDKStreamlinedTextMessage = z.infer<
  ReturnType<typeof SDKStreamlinedTextMessageSchema>
>
export type SDKStreamlinedToolUseSummaryMessage = z.infer<
  ReturnType<typeof SDKStreamlinedToolUseSummaryMessageSchema>
>
export type SDKSystemMessage = z.infer<ReturnType<typeof SDKSystemMessageSchema>>
export type SDKToolProgressMessage = z.infer<ReturnType<typeof SDKToolProgressMessageSchema>>
export type SDKToolUseSummaryMessage = z.infer<ReturnType<typeof SDKToolUseSummaryMessageSchema>>
export type SDKUserMessage = z.infer<ReturnType<typeof SDKUserMessageSchema>>
export type SDKUserMessageReplay = z.infer<ReturnType<typeof SDKUserMessageReplaySchema>>
export type ExitReason = (typeof EXIT_REASONS)[number]
export type PreToolUseHookInput = z.infer<
  ReturnType<typeof PreToolUseHookInputSchema>
>
export type PostToolUseHookInput = z.infer<
  ReturnType<typeof PostToolUseHookInputSchema>
>
export type PostToolUseFailureHookInput = z.infer<
  ReturnType<typeof PostToolUseFailureHookInputSchema>
>
export type PermissionDeniedHookInput = z.infer<
  ReturnType<typeof PermissionDeniedHookInputSchema>
>
export type NotificationHookInput = z.infer<
  ReturnType<typeof NotificationHookInputSchema>
>
export type PermissionRequestHookInput = z.infer<
  ReturnType<typeof PermissionRequestHookInputSchema>
>
export type UserPromptSubmitHookInput = z.infer<
  ReturnType<typeof UserPromptSubmitHookInputSchema>
>
export type SessionStartHookInput = z.infer<
  ReturnType<typeof SessionStartHookInputSchema>
>
export type SessionEndHookInput = z.infer<
  ReturnType<typeof SessionEndHookInputSchema>
>
export type StopHookInput = z.infer<ReturnType<typeof StopHookInputSchema>>
export type StopFailureHookInput = z.infer<
  ReturnType<typeof StopFailureHookInputSchema>
>
export type SubagentStartHookInput = z.infer<
  ReturnType<typeof SubagentStartHookInputSchema>
>
export type SubagentStopHookInput = z.infer<
  ReturnType<typeof SubagentStopHookInputSchema>
>
export type PostCompactHookInput = z.infer<
  ReturnType<typeof PostCompactHookInputSchema>
>
export type PreCompactHookInput = z.infer<
  ReturnType<typeof PreCompactHookInputSchema>
>
export type SetupHookInput = z.infer<ReturnType<typeof SetupHookInputSchema>>
export type TaskCompletedHookInput = z.infer<
  ReturnType<typeof TaskCompletedHookInputSchema>
>
export type TaskCreatedHookInput = z.infer<
  ReturnType<typeof TaskCreatedHookInputSchema>
>
export type TeammateIdleHookInput = z.infer<
  ReturnType<typeof TeammateIdleHookInputSchema>
>
export type ConfigChangeHookInput = z.infer<
  ReturnType<typeof ConfigChangeHookInputSchema>
>
export type CwdChangedHookInput = z.infer<
  ReturnType<typeof CwdChangedHookInputSchema>
>
export type ElicitationHookInput = z.infer<
  ReturnType<typeof ElicitationHookInputSchema>
>
export type ElicitationResultHookInput = z.infer<
  ReturnType<typeof ElicitationResultHookInputSchema>
>
export type FileChangedHookInput = z.infer<
  ReturnType<typeof FileChangedHookInputSchema>
>
export type InstructionsLoadedHookInput = z.infer<
  ReturnType<typeof InstructionsLoadedHookInputSchema>
>
export type WorktreeCreateHookInput = z.infer<
  ReturnType<typeof WorktreeCreateHookInputSchema>
>
export type WorktreeRemoveHookInput = z.infer<
  ReturnType<typeof WorktreeRemoveHookInputSchema>
>
export type HookInput =
  | PreToolUseHookInput
  | PostToolUseHookInput
  | PostToolUseFailureHookInput
  | PermissionDeniedHookInput
  | NotificationHookInput
  | UserPromptSubmitHookInput
  | SessionStartHookInput
  | SessionEndHookInput
  | StopHookInput
  | StopFailureHookInput
  | SubagentStartHookInput
  | SubagentStopHookInput
  | PreCompactHookInput
  | PostCompactHookInput
  | PermissionRequestHookInput
  | SetupHookInput
  | TeammateIdleHookInput
  | TaskCreatedHookInput
  | TaskCompletedHookInput
  | ElicitationHookInput
  | ElicitationResultHookInput
  | ConfigChangeHookInput
  | InstructionsLoadedHookInput
  | WorktreeCreateHookInput
  | WorktreeRemoveHookInput
  | CwdChangedHookInput
  | FileChangedHookInput

export type PreToolUseHookSpecificOutput =
  z.infer<ReturnType<typeof PreToolUseHookSpecificOutputSchema>>
export type UserPromptSubmitHookSpecificOutput =
  z.infer<ReturnType<typeof UserPromptSubmitHookSpecificOutputSchema>>
export type SessionStartHookSpecificOutput =
  z.infer<ReturnType<typeof SessionStartHookSpecificOutputSchema>>
export type SetupHookSpecificOutput =
  z.infer<ReturnType<typeof SetupHookSpecificOutputSchema>>
export type SubagentStartHookSpecificOutput =
  z.infer<ReturnType<typeof SubagentStartHookSpecificOutputSchema>>
export type PostToolUseHookSpecificOutput =
  z.infer<ReturnType<typeof PostToolUseHookSpecificOutputSchema>>
export type PostToolUseFailureHookSpecificOutput =
  z.infer<ReturnType<typeof PostToolUseFailureHookSpecificOutputSchema>>
export type PermissionDeniedHookSpecificOutput =
  z.infer<ReturnType<typeof PermissionDeniedHookSpecificOutputSchema>>
export type NotificationHookSpecificOutput =
  z.infer<ReturnType<typeof NotificationHookSpecificOutputSchema>>
export type PermissionRequestHookSpecificOutput =
  z.infer<ReturnType<typeof PermissionRequestHookSpecificOutputSchema>>
export type ElicitationHookSpecificOutput =
  z.infer<ReturnType<typeof ElicitationHookSpecificOutputSchema>>
export type ElicitationResultHookSpecificOutput =
  z.infer<ReturnType<typeof ElicitationResultHookSpecificOutputSchema>>
export type CwdChangedHookSpecificOutput =
  z.infer<ReturnType<typeof CwdChangedHookSpecificOutputSchema>>
export type FileChangedHookSpecificOutput =
  z.infer<ReturnType<typeof FileChangedHookSpecificOutputSchema>>
export type WorktreeCreateHookSpecificOutput =
  z.infer<ReturnType<typeof WorktreeCreateHookSpecificOutputSchema>>

export type HookSpecificOutput =
  | PreToolUseHookSpecificOutput
  | UserPromptSubmitHookSpecificOutput
  | SessionStartHookSpecificOutput
  | SetupHookSpecificOutput
  | SubagentStartHookSpecificOutput
  | PostToolUseHookSpecificOutput
  | PostToolUseFailureHookSpecificOutput
  | PermissionDeniedHookSpecificOutput
  | NotificationHookSpecificOutput
  | PermissionRequestHookSpecificOutput
  | ElicitationHookSpecificOutput
  | ElicitationResultHookSpecificOutput
  | CwdChangedHookSpecificOutput
  | FileChangedHookSpecificOutput
  | WorktreeCreateHookSpecificOutput

export type AsyncHookJSONOutput = {
  async: true
  asyncTimeout?: number
}

export type SyncHookJSONOutput = {
  continue?: boolean
  suppressOutput?: boolean
  stopReason?: string
  decision?: 'approve' | 'block'
  systemMessage?: string
  reason?: string
  hookSpecificOutput?: HookSpecificOutput
}

export type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput
