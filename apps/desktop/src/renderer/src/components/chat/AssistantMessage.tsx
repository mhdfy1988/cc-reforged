import { MessageFrame } from './MessageFrame.js'
import { PlanApprovalCard } from './PlanApprovalCard.js'
import type { MessageAvatarRuntime } from '../../domain/avatarEvents.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'
import type {
  JsonObject,
  PermissionCard,
  PermissionRespondPayload,
} from '../../domain/displayTypes.js'

export function AssistantMessage(props: {
  event: DisplayEvent
  avatarRuntime?: MessageAvatarRuntime
  permission?: PermissionCard
  onOpenLogs?: () => void
  onOpenModels?: () => void
  onRespondPermission?: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
    payload?: PermissionRespondPayload,
  ) => Promise<void>
}) {
  return (
    <MessageFrame event={props.event} avatarRuntime={props.avatarRuntime}>
      {props.permission && props.onRespondPermission ? (
        <div className="assistant-inline-permission">
          <PlanApprovalCard
            compact={shouldUseCompactPlanApproval(props.event, props.permission)}
            inline
            onRespond={props.onRespondPermission}
            permission={props.permission}
          />
        </div>
      ) : null}
    </MessageFrame>
  )
}

function shouldUseCompactPlanApproval(
  event: DisplayEvent,
  permission: PermissionCard,
): boolean {
  if (
    permission.interactionKind === 'enter_plan_mode' ||
    permission.toolName === 'EnterPlanMode'
  ) {
    return true
  }
  if (
    permission.interactionKind !== 'plan_approval' &&
    permission.toolName !== 'ExitPlanMode' &&
    permission.toolName !== 'ExitPlanModeV2'
  ) {
    return true
  }

  const planText = getPlanText(permission.input)
  if (!planText) {
    return false
  }
  const normalizedMessage = normalizeTextForPlanMatch(event.text)
  const normalizedPlan = normalizeTextForPlanMatch(planText)
  if (!normalizedMessage || !normalizedPlan) {
    return false
  }

  const planProbe = normalizedPlan.slice(0, Math.min(160, normalizedPlan.length))
  return normalizedMessage.includes(planProbe)
}

function getPlanText(input: JsonObject): string | undefined {
  return (
    getString(input.plan) ??
    getString(input.planContent) ??
    getString(input.content)
  )
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeTextForPlanMatch(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}
