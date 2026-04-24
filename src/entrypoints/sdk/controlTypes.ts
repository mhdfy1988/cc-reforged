import { z } from 'zod/v4'
import {
  SDKControlApplyFlagSettingsRequestSchema,
  SDKControlCancelAsyncMessageRequestSchema,
  SDKControlCancelAsyncMessageResponseSchema,
  SDKControlCancelRequestSchema,
  SDKControlElicitationRequestSchema,
  SDKControlElicitationResponseSchema,
  SDKControlGetContextUsageRequestSchema,
  SDKControlGetContextUsageResponseSchema,
  SDKControlGetSettingsRequestSchema,
  SDKControlGetSettingsResponseSchema,
  SDKControlInitializeRequestSchema,
  SDKControlInitializeResponseSchema,
  SDKControlInterruptRequestSchema,
  SDKControlMcpMessageRequestSchema,
  SDKControlMcpReconnectRequestSchema,
  SDKControlMcpSetServersRequestSchema,
  SDKControlMcpSetServersResponseSchema,
  SDKControlMcpStatusRequestSchema,
  SDKControlMcpStatusResponseSchema,
  SDKControlMcpToggleRequestSchema,
  SDKControlPermissionRequestSchema,
  SDKControlReloadPluginsRequestSchema,
  SDKControlReloadPluginsResponseSchema,
  SDKControlRequestInnerSchema,
  SDKControlRequestSchema,
  SDKControlResponseSchema,
  SDKControlRewindFilesRequestSchema,
  SDKControlRewindFilesResponseSchema,
  SDKControlSeedReadStateRequestSchema,
  SDKControlSetMaxThinkingTokensRequestSchema,
  SDKControlSetModelRequestSchema,
  SDKControlSetPermissionModeRequestSchema,
  SDKControlStopTaskRequestSchema,
  StdinMessageSchema,
  StdoutMessageSchema,
} from './controlSchemas.js'
import {
  SDKAssistantMessageSchema as CoreSDKAssistantMessageSchema,
  SDKCompactBoundaryMessageSchema as CoreSDKCompactBoundaryMessageSchema,
  SDKHookProgressMessageSchema as CoreSDKHookProgressMessageSchema,
  SDKHookResponseMessageSchema as CoreSDKHookResponseMessageSchema,
  SDKHookStartedMessageSchema as CoreSDKHookStartedMessageSchema,
  SDKMessageSchema as CoreSDKMessageSchema,
  SDKPartialAssistantMessageSchema as CoreSDKPartialAssistantMessageSchema,
  SDKStatusMessageSchema as CoreSDKStatusMessageSchema,
  SDKStreamlinedTextMessageSchema as CoreSDKStreamlinedTextMessageSchema,
  SDKStreamlinedToolUseSummaryMessageSchema as CoreSDKStreamlinedToolUseSummaryMessageSchema,
  SDKSystemMessageSchema as CoreSDKSystemMessageSchema,
  SDKToolProgressMessageSchema as CoreSDKToolProgressMessageSchema,
  SDKToolUseSummaryMessageSchema as CoreSDKToolUseSummaryMessageSchema,
  SDKUserMessageSchema as CoreSDKUserMessageSchema,
} from './coreSchemas.js'

// Recovery bridge: keep the public surface as thin type aliases over the
// canonical schemas so existing `.js` imports continue to resolve.

export type SDKAssistantMessage = z.infer<ReturnType<typeof CoreSDKAssistantMessageSchema>>
export type SDKCompactBoundaryMessage = z.infer<ReturnType<typeof CoreSDKCompactBoundaryMessageSchema>>
export type SDKControlApplyFlagSettingsRequest = z.infer<
  ReturnType<typeof SDKControlApplyFlagSettingsRequestSchema>
>
export type SDKControlCancelAsyncMessageRequest = z.infer<
  ReturnType<typeof SDKControlCancelAsyncMessageRequestSchema>
>
export type SDKControlCancelAsyncMessageResponse = z.infer<
  ReturnType<typeof SDKControlCancelAsyncMessageResponseSchema>
>
export type SDKControlCancelRequest = z.infer<ReturnType<typeof SDKControlCancelRequestSchema>>
export type SDKControlElicitationRequest = z.infer<ReturnType<typeof SDKControlElicitationRequestSchema>>
export type SDKControlElicitationResponse = z.infer<ReturnType<typeof SDKControlElicitationResponseSchema>>
export type SDKControlGetContextUsageRequest = z.infer<
  ReturnType<typeof SDKControlGetContextUsageRequestSchema>
>
export type SDKControlGetContextUsageResponse = z.infer<
  ReturnType<typeof SDKControlGetContextUsageResponseSchema>
>
export type SDKControlGetSettingsRequest = z.infer<ReturnType<typeof SDKControlGetSettingsRequestSchema>>
export type SDKControlGetSettingsResponse = z.infer<ReturnType<typeof SDKControlGetSettingsResponseSchema>>
export type SDKControlInitializeRequest = z.infer<ReturnType<typeof SDKControlInitializeRequestSchema>>
export type SDKControlInitializeResponse = z.infer<ReturnType<typeof SDKControlInitializeResponseSchema>>
export type SDKControlInterruptRequest = z.infer<ReturnType<typeof SDKControlInterruptRequestSchema>>
export type SDKControlMcpMessageRequest = z.infer<ReturnType<typeof SDKControlMcpMessageRequestSchema>>
export type SDKControlMcpReconnectRequest = z.infer<ReturnType<typeof SDKControlMcpReconnectRequestSchema>>
export type SDKControlMcpSetServersRequest = z.infer<ReturnType<typeof SDKControlMcpSetServersRequestSchema>>
export type SDKControlMcpSetServersResponse = z.infer<ReturnType<typeof SDKControlMcpSetServersResponseSchema>>
export type SDKControlMcpStatusRequest = z.infer<ReturnType<typeof SDKControlMcpStatusRequestSchema>>
export type SDKControlMcpStatusResponse = z.infer<ReturnType<typeof SDKControlMcpStatusResponseSchema>>
export type SDKControlMcpToggleRequest = z.infer<ReturnType<typeof SDKControlMcpToggleRequestSchema>>
export type SDKControlPermissionRequest = z.infer<ReturnType<typeof SDKControlPermissionRequestSchema>>
export type SDKControlReloadPluginsRequest = z.infer<ReturnType<typeof SDKControlReloadPluginsRequestSchema>>
export type SDKControlReloadPluginsResponse = z.infer<ReturnType<typeof SDKControlReloadPluginsResponseSchema>>
export type SDKControlRequestInner = z.infer<ReturnType<typeof SDKControlRequestInnerSchema>>
export type SDKControlRequest = z.infer<ReturnType<typeof SDKControlRequestSchema>>
export type SDKControlResponse = z.infer<ReturnType<typeof SDKControlResponseSchema>>
export type SDKControlRewindFilesRequest = z.infer<ReturnType<typeof SDKControlRewindFilesRequestSchema>>
export type SDKControlRewindFilesResponse = z.infer<ReturnType<typeof SDKControlRewindFilesResponseSchema>>
export type SDKControlSeedReadStateRequest = z.infer<ReturnType<typeof SDKControlSeedReadStateRequestSchema>>
export type SDKControlSetMaxThinkingTokensRequest = z.infer<
  ReturnType<typeof SDKControlSetMaxThinkingTokensRequestSchema>
>
export type SDKControlSetModelRequest = z.infer<ReturnType<typeof SDKControlSetModelRequestSchema>>
export type SDKControlSetPermissionModeRequest = z.infer<
  ReturnType<typeof SDKControlSetPermissionModeRequestSchema>
>
export type SDKControlStopTaskRequest = z.infer<ReturnType<typeof SDKControlStopTaskRequestSchema>>
export type SDKHookProgressMessage = z.infer<ReturnType<typeof CoreSDKHookProgressMessageSchema>>
export type SDKHookResponseMessage = z.infer<ReturnType<typeof CoreSDKHookResponseMessageSchema>>
export type SDKHookStartedMessage = z.infer<ReturnType<typeof CoreSDKHookStartedMessageSchema>>
export type SDKMessage = z.infer<ReturnType<typeof CoreSDKMessageSchema>>
export type SDKPartialAssistantMessage = z.infer<ReturnType<typeof CoreSDKPartialAssistantMessageSchema>>
export type SDKStatusMessage = z.infer<ReturnType<typeof CoreSDKStatusMessageSchema>>
export type SDKStreamlinedTextMessage = z.infer<
  ReturnType<typeof CoreSDKStreamlinedTextMessageSchema>
>
export type SDKStreamlinedToolUseSummaryMessage = z.infer<
  ReturnType<typeof CoreSDKStreamlinedToolUseSummaryMessageSchema>
>
export type SDKSystemMessage = z.infer<ReturnType<typeof CoreSDKSystemMessageSchema>>
export type SDKToolProgressMessage = z.infer<ReturnType<typeof CoreSDKToolProgressMessageSchema>>
export type SDKToolUseSummaryMessage = z.infer<ReturnType<typeof CoreSDKToolUseSummaryMessageSchema>>
export type SDKUserMessage = z.infer<ReturnType<typeof CoreSDKUserMessageSchema>>
export type StdinMessage = z.infer<ReturnType<typeof StdinMessageSchema>>
export type StdoutMessage = z.infer<ReturnType<typeof StdoutMessageSchema>>

// Re-export the canonical schema-backed aliases used by the bridge layer.
export type CoreSDKAssistantMessage = z.infer<ReturnType<typeof CoreSDKAssistantMessageSchema>>
export type CoreSDKCompactBoundaryMessage = z.infer<
  ReturnType<typeof CoreSDKCompactBoundaryMessageSchema>
>
export type CoreSDKHookProgressMessage = z.infer<ReturnType<typeof CoreSDKHookProgressMessageSchema>>
export type CoreSDKHookResponseMessage = z.infer<ReturnType<typeof CoreSDKHookResponseMessageSchema>>
export type CoreSDKHookStartedMessage = z.infer<ReturnType<typeof CoreSDKHookStartedMessageSchema>>
export type CoreSDKMessage = z.infer<ReturnType<typeof CoreSDKMessageSchema>>
export type CoreSDKPartialAssistantMessage = z.infer<
  ReturnType<typeof CoreSDKPartialAssistantMessageSchema>
>
export type CoreSDKStatusMessage = z.infer<ReturnType<typeof CoreSDKStatusMessageSchema>>
export type CoreSDKStreamlinedTextMessage = z.infer<
  ReturnType<typeof CoreSDKStreamlinedTextMessageSchema>
>
export type CoreSDKStreamlinedToolUseSummaryMessage = z.infer<
  ReturnType<typeof CoreSDKStreamlinedToolUseSummaryMessageSchema>
>
export type CoreSDKSystemMessage = z.infer<ReturnType<typeof CoreSDKSystemMessageSchema>>
export type CoreSDKToolProgressMessage = z.infer<ReturnType<typeof CoreSDKToolProgressMessageSchema>>
export type CoreSDKToolUseSummaryMessage = z.infer<ReturnType<typeof CoreSDKToolUseSummaryMessageSchema>>
export type CoreSDKUserMessage = z.infer<ReturnType<typeof CoreSDKUserMessageSchema>>
