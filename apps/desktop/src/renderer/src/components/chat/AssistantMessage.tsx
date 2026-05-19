import { MessageFrame } from './MessageFrame.js'
import { PlanApprovalCard } from './PlanApprovalCard.js'
import type { DisplayEvent } from '../../domain/displayEvents.js'
import type {
  PermissionCard,
  PermissionRespondPayload,
} from '../../domain/displayTypes.js'

export function AssistantMessage(props: {
  event: DisplayEvent
  permission?: PermissionCard
  inlineControlFailure?: DisplayEvent
  onOpenLogs?: () => void
  onOpenModels?: () => void
  onRespondPermission?: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
    payload?: PermissionRespondPayload,
  ) => Promise<void>
}) {
  return (
    <MessageFrame event={props.event} label="C">
      {props.permission && props.onRespondPermission ? (
        <div className="assistant-inline-permission">
          <PlanApprovalCard
            compact
            inline
            onRespond={props.onRespondPermission}
            permission={props.permission}
          />
        </div>
      ) : null}
      {props.inlineControlFailure ? (
        <InlineControlFailureNotice
          event={props.inlineControlFailure}
        />
      ) : null}
    </MessageFrame>
  )
}

function InlineControlFailureNotice(props: {
  event: DisplayEvent
}) {
  const snapshot = props.event.toolSnapshot
  if (!snapshot) {
    return null
  }

  const title = snapshot.displayName ?? snapshot.name
  const status = snapshot.statusLabel ?? '失败'
  const errorText = snapshot.errorMessage?.trim()
  const summary = errorText || snapshot.summary || '控制工具执行失败。'

  return (
    <section className="assistant-inline-control-failure">
      <div className="assistant-inline-control-failure-head">
        <strong>{title}</strong>
        <span>{status}</span>
      </div>
      <p>{summary}</p>
      {snapshot.errorClass ? (
        <small>错误类型：{snapshot.errorClass}</small>
      ) : null}
      {snapshot.actionableHint ? (
        <p className="assistant-inline-control-failure-hint">
          {snapshot.actionableHint}
        </p>
      ) : null}
    </section>
  )
}
