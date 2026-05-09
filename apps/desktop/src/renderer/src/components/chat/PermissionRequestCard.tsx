import { AskUserQuestionCard } from './AskUserQuestionCard.js'
import { LongTailPermissionCard } from './LongTailPermissionCard.js'
import { PlanApprovalCard } from './PlanApprovalCard.js'
import { ShellPermissionCard } from './ShellPermissionCard.js'
import { SkillPermissionCard } from './SkillPermissionCard.js'
import { WebFetchPermissionCard } from './WebFetchPermissionCard.js'
import type { ReactElement } from 'react'
import type {
  PermissionCard,
  PermissionRespondPayload,
} from '../../domain/displayTypes.js'

type PermissionCardComponent = (props: {
  permission: PermissionCard
  onRespond: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
    payload?: PermissionRespondPayload,
  ) => Promise<void>
}) => ReactElement

type PermissionCardRegistration = {
  component: PermissionCardComponent
  match: (permission: PermissionCard) => boolean
}

const permissionCardRegistry: PermissionCardRegistration[] = [
  {
    component: AskUserQuestionCard,
    match: permission =>
      permission.interactionKind === 'ask_user_question' ||
      permission.toolName === 'AskUserQuestion',
  },
  {
    component: PlanApprovalCard,
    match: permission =>
      permission.interactionKind === 'plan_approval' ||
      permission.interactionKind === 'enter_plan_mode' ||
      permission.toolName === 'ExitPlanMode' ||
      permission.toolName === 'ExitPlanModeV2' ||
      permission.toolName === 'EnterPlanMode',
  },
  {
    component: ShellPermissionCard,
    match: permission =>
      permission.interactionKind === 'shell_permission' ||
      permission.toolName === 'Bash' ||
      permission.toolName === 'PowerShell',
  },
  {
    component: WebFetchPermissionCard,
    match: permission =>
      permission.interactionKind === 'web_fetch' ||
      permission.toolName === 'WebFetch',
  },
  {
    component: SkillPermissionCard,
    match: permission =>
      permission.interactionKind === 'skill' || permission.toolName === 'Skill',
  },
]

export function PermissionRequestCard(props: {
  permission: PermissionCard
  onRespond: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
    payload?: PermissionRespondPayload,
  ) => Promise<void>
}) {
  const permission = props.permission
  const registration = permissionCardRegistry.find(item =>
    item.match(permission),
  )
  if (registration) {
    const Card = registration.component
    return (
      <Card
        permission={permission}
        onRespond={props.onRespond}
      />
    )
  }

  return (
    <LongTailPermissionCard
      permission={permission}
      onRespond={props.onRespond}
    />
  )
}
