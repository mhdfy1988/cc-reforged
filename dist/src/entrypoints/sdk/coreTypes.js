// SDK Core Types - Common serializable types used by both SDK consumers and SDK builders.
//
// Recovery note:
// This project snapshot does not include the generated `coreTypes.generated`
// file set, so we keep the public SDK surface flowing by deriving the common
// exports directly from the committed Zod schemas.
import { z } from 'zod/v4';
import { ApiKeySourceSchema, HookEventSchema, McpServerConfigForProcessTransportSchema, McpServerStatusSchema, ModelInfoSchema, ModelUsageSchema, NotificationHookInputSchema, PermissionDeniedHookInputSchema, PermissionResultSchema, PermissionRequestHookInputSchema, PermissionUpdateSchema, PermissionModeSchema, PostCompactHookInputSchema, PostToolUseFailureHookInputSchema, PostToolUseHookInputSchema, PreCompactHookInputSchema, PreToolUseHookInputSchema, RewindFilesResultSchema, SDKAssistantMessageErrorSchema, SDKAssistantMessageSchema, SDKCompactBoundaryMessageSchema, SDKHookProgressMessageSchema, SDKHookResponseMessageSchema, SDKHookStartedMessageSchema, SDKPermissionDenialSchema, SDKMessageSchema, SDKPartialAssistantMessageSchema, SDKResultMessageSchema, SDKResultErrorSchema, SDKResultSuccessSchema, SDKSessionInfoSchema, SDKStatusSchema, SDKStatusMessageSchema, SDKRateLimitInfoSchema, SDKStreamlinedTextMessageSchema, SDKStreamlinedToolUseSummaryMessageSchema, SDKSystemMessageSchema, SDKToolProgressMessageSchema, SDKToolUseSummaryMessageSchema, SDKUserMessageReplaySchema, SDKUserMessageSchema, SessionStartHookInputSchema, SessionEndHookInputSchema, SetupHookInputSchema, StopFailureHookInputSchema, StopHookInputSchema, SubagentStartHookInputSchema, SubagentStopHookInputSchema, TaskCompletedHookInputSchema, TaskCreatedHookInputSchema, TeammateIdleHookInputSchema, ConfigChangeHookInputSchema, CwdChangedHookInputSchema, ElicitationHookInputSchema, ElicitationResultHookInputSchema, FileChangedHookInputSchema, InstructionsLoadedHookInputSchema, UserPromptSubmitHookInputSchema, WorktreeCreateHookInputSchema, WorktreeRemoveHookInputSchema, PreToolUseHookSpecificOutputSchema, UserPromptSubmitHookSpecificOutputSchema, SessionStartHookSpecificOutputSchema, SetupHookSpecificOutputSchema, SubagentStartHookSpecificOutputSchema, PostToolUseHookSpecificOutputSchema, PostToolUseFailureHookSpecificOutputSchema, PermissionDeniedHookSpecificOutputSchema, NotificationHookSpecificOutputSchema, PermissionRequestHookSpecificOutputSchema, ElicitationHookSpecificOutputSchema, ElicitationResultHookSpecificOutputSchema, CwdChangedHookSpecificOutputSchema, FileChangedHookSpecificOutputSchema, WorktreeCreateHookSpecificOutputSchema, } from './coreSchemas.js';
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
];
export const EXIT_REASONS = [
    'clear',
    'resume',
    'logout',
    'prompt_input_exit',
    'other',
    'bypass_permissions_disabled',
];
//# sourceMappingURL=coreTypes.js.map