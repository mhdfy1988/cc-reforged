import type {
  CapabilityManagementAction,
  CapabilityManagementItem,
  CapabilityManagementProjection,
} from './managementProjectionService.js'

export type SkillManagementInstalledInspectionLike = {
  lockKey?: string
  name?: string
  status?: string
  statusMessage?: string
  installedRecord?: {
    lockKey?: string
    name?: string
  } | null
}

export type SkillManagementViewItem<
  TInspection extends SkillManagementInstalledInspectionLike =
    SkillManagementInstalledInspectionLike,
> = {
  capability: CapabilityManagementItem
  inspection: TInspection | null
  actionRef: string | null
  allowedActions: CapabilityManagementAction[]
}

export function createSkillManagementViewItems<
  TInspection extends SkillManagementInstalledInspectionLike,
>(input: {
  management?: Pick<CapabilityManagementProjection, 'skills'> | null
  installed?: readonly TInspection[] | null
}): Array<SkillManagementViewItem<TInspection>> {
  const installedByRef = createInstalledSkillInspectionRefMap(
    input.installed ?? [],
  )
  return (input.management?.skills ?? [])
    .map(capability => ({
      capability,
      inspection: findInstalledSkillInspection(capability, installedByRef),
      actionRef: capability.actionRef ?? capability.relations.installedRef ?? null,
      allowedActions: [...capability.allowedActions],
    }))
    .sort(compareSkillManagementViewItems)
}

export function hasSkillManagementAction(
  item: SkillManagementViewItem,
  action: CapabilityManagementAction,
): boolean {
  return item.allowedActions.includes(action)
}

export function getSkillManagementActionRef(
  item: SkillManagementViewItem,
  action: CapabilityManagementAction,
): string | null {
  if (!hasSkillManagementAction(item, action)) return null
  return item.actionRef
}

export function getSkillManagementToggleEnabledTarget(
  item: SkillManagementViewItem,
): { skillRef: string; enabled: boolean } | null {
  const action = item.capability.state.enabled ? 'disable' : 'enable'
  const skillRef = getSkillManagementActionRef(item, action)
  if (!skillRef) return null
  return {
    skillRef,
    enabled: !item.capability.state.enabled,
  }
}

function createInstalledSkillInspectionRefMap<
  TInspection extends SkillManagementInstalledInspectionLike,
>(installed: readonly TInspection[]): Map<string, TInspection> {
  const installedByRef = new Map<string, TInspection>()
  for (const inspection of installed) {
    addInstalledSkillInspectionRef(installedByRef, inspection.lockKey, inspection)
    addInstalledSkillInspectionRef(
      installedByRef,
      inspection.installedRecord?.lockKey,
      inspection,
    )
  }
  return installedByRef
}

function addInstalledSkillInspectionRef<
  TInspection extends SkillManagementInstalledInspectionLike,
>(
  installedByRef: Map<string, TInspection>,
  ref: string | undefined,
  inspection: TInspection,
): void {
  if (!ref) return
  if (!installedByRef.has(ref)) {
    installedByRef.set(ref, inspection)
  }
}

function findInstalledSkillInspection<
  TInspection extends SkillManagementInstalledInspectionLike,
>(
  capability: CapabilityManagementItem,
  installedByRef: Map<string, TInspection>,
): TInspection | null {
  const installedRef = capability.relations.installedRef ?? capability.actionRef
  if (!installedRef) return null
  return installedByRef.get(installedRef) ?? null
}

function compareSkillManagementViewItems(
  a: SkillManagementViewItem,
  b: SkillManagementViewItem,
): number {
  const attentionDiff =
    getSkillManagementAttentionRank(a) - getSkillManagementAttentionRank(b)
  if (attentionDiff !== 0) return attentionDiff
  const sourceDiff =
    getSkillManagementSourceRank(a.capability.source.kind) -
    getSkillManagementSourceRank(b.capability.source.kind)
  if (sourceDiff !== 0) return sourceDiff
  return a.capability.displayName.localeCompare(b.capability.displayName)
}

function getSkillManagementAttentionRank(item: SkillManagementViewItem): number {
  if (
    item.capability.diagnostics.some(diagnostic => diagnostic.severity === 'error')
  ) {
    return 0
  }
  if (
    item.inspection?.status &&
    !['installed', 'disabled'].includes(item.inspection.status)
  ) {
    return 1
  }
  if (
    item.capability.diagnostics.some(
      diagnostic => diagnostic.severity === 'warning',
    )
  ) {
    return 2
  }
  if (!item.capability.state.runtimeVisible) return 3
  return 4
}

function getSkillManagementSourceRank(sourceKind: string): number {
  switch (sourceKind) {
    case 'managed-skill':
      return 0
    case 'user-skill':
      return 1
    case 'project-skill':
      return 2
    case 'plugin':
      return 3
    case 'mcp':
      return 4
    case 'dynamic':
      return 5
    case 'bundled':
      return 6
    default:
      return 7
  }
}
