import {
  CapabilitiesAppsRegisterParamsSchema,
  CapabilitiesManagementActionApplyParamsSchema,
  CapabilitiesManagementActionPlanParamsSchema,
  CapabilitiesListParamsSchema,
  CapabilitiesManagementListParamsSchema,
} from '../protocol.js'
import type {
  CapabilitiesAppsRegisterResult,
  CapabilitiesManagementActionApplyParams,
  CapabilitiesManagementActionApplyResult,
  CapabilitiesManagementActionPlanParams,
  CapabilitiesManagementActionPlanResult,
} from '../protocol.js'
import type { AppServerContext } from '../router.js'
import { AppServerError } from '../errors.js'
import {
  canApplyCapabilityManagementAction,
  createCapabilityManagementActionPlan,
  getCapabilityManagementActionTargetRef,
  type CapabilityManagementActionApplyRequest,
  type CapabilityManagementActionRequest,
} from '../../services/capabilities/managementActionService.js'
import type { CapabilityManagementProjection } from '../../services/capabilities/managementProjectionService.js'

type CapabilityCore = AppServerContext['core']['capabilities']

export function handleCapabilitiesAppsRegister(
  context: AppServerContext,
  params: unknown,
): CapabilitiesAppsRegisterResult {
  const parsedParams = CapabilitiesAppsRegisterParamsSchema.parse(params)
  return context.core.capabilities.apps.register(parsedParams)
}

export async function handleCapabilitiesList(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = CapabilitiesListParamsSchema.parse(
    params ?? {},
  ) as Parameters<CapabilityCore['list']>[0]
  return context.core.capabilities.list({
    ...parsedParams,
    cwd: parsedParams.cwd ?? process.cwd(),
    configHomeDir: parsedParams.configHomeDir ?? context.ccrHome,
  })
}

export async function handleCapabilitiesManagementList(
  context: AppServerContext,
  params: unknown,
) {
  const parsedParams = CapabilitiesManagementListParamsSchema.parse(
    params ?? {},
  ) as Parameters<CapabilityCore['listManagement']>[0]
  return context.core.capabilities.listManagement({
    ...parsedParams,
    cwd: parsedParams.cwd ?? process.cwd(),
    configHomeDir: parsedParams.configHomeDir ?? context.ccrHome,
  })
}

export async function handleCapabilityManagementActionPlan(
  context: AppServerContext,
  params: unknown,
): Promise<CapabilitiesManagementActionPlanResult> {
  const parsedParams = CapabilitiesManagementActionPlanParamsSchema.parse(
    params,
  ) as CapabilitiesManagementActionPlanParams
  const management = await loadCapabilityManagementProjection(context, parsedParams)
  return createCapabilityManagementActionPlan(
    management,
    toCapabilityActionRequest(context, parsedParams),
  )
}

export async function handleCapabilityManagementActionApply(
  context: AppServerContext,
  params: unknown,
): Promise<CapabilitiesManagementActionApplyResult> {
  const parsedParams = CapabilitiesManagementActionApplyParamsSchema.parse(
    params,
  ) as CapabilitiesManagementActionApplyParams
  const management = await loadCapabilityManagementProjection(context, parsedParams)
  const request = toCapabilityActionApplyRequest(context, parsedParams)
  const plan = createCapabilityManagementActionPlan(management, request, {
    issueConfirmationToken: false,
  })
  const guard = canApplyCapabilityManagementAction(plan, request)
  if (guard.ok === false) {
    throw new AppServerError('invalid_params', guard.reason, { plan })
  }

  const result = await applyCapabilityManagementAction(context, plan, request)
  const nextManagement = await loadCapabilityManagementProjection(
    context,
    parsedParams,
  )

  return {
    schemaVersion: 1,
    applied: true,
    plan,
    result,
    management: nextManagement,
  }
}

async function loadCapabilityManagementProjection(
  context: AppServerContext,
  params: { cwd?: string; configHomeDir?: string },
): Promise<CapabilityManagementProjection> {
  return context.core.capabilities.listManagement({
    cwd: params.cwd ?? process.cwd(),
    configHomeDir: params.configHomeDir ?? context.ccrHome,
  })
}

function toCapabilityActionRequest(
  context: AppServerContext,
  params: CapabilitiesManagementActionPlanParams,
): CapabilityManagementActionRequest {
  return {
    capabilityId: params.capabilityId,
    action: params.action,
    ...(params.actionRef ? { actionRef: params.actionRef } : {}),
    ...(params.params ? { params: params.params } : {}),
    context: {
      cwd: params.cwd ?? process.cwd(),
      configHomeDir: params.configHomeDir ?? context.ccrHome,
    },
  }
}

function toCapabilityActionApplyRequest(
  context: AppServerContext,
  params: CapabilitiesManagementActionApplyParams,
): CapabilityManagementActionApplyRequest {
  return {
    ...toCapabilityActionRequest(context, params),
    ...(params.confirmed !== undefined ? { confirmed: params.confirmed } : {}),
    ...(params.confirmationToken
      ? { confirmationToken: params.confirmationToken }
      : {}),
  }
}

async function applyCapabilityManagementAction(
  context: AppServerContext,
  plan: CapabilitiesManagementActionPlanResult,
  request: CapabilityManagementActionApplyRequest,
): Promise<Record<string, unknown>> {
  const targetRef = getCapabilityManagementActionTargetRef(plan)
  const target = plan.target
  if (!target) {
    throw new AppServerError('invalid_params', 'Capability action target missing.', {
      plan,
    })
  }

  if (target.kind === 'skill') {
    return applySkillCapabilityAction(context, request, targetRef, plan)
  }

  if (target.kind === 'mcp-server') {
    return applyMcpServerCapabilityAction(context, request, targetRef, plan)
  }

  if (request.action === 'inspect') {
    return {
      capabilityId: target.capabilityId,
      kind: target.kind,
      name: target.name,
      displayName: target.displayName,
      managementOwnership: target.managementOwnership,
    }
  }

  throw new AppServerError(
    'invalid_params',
    `Action "${request.action}" is not executable for capability kind "${target.kind}".`,
    { plan },
  )
}

async function applySkillCapabilityAction(
  context: AppServerContext,
  request: CapabilityManagementActionApplyRequest,
  skillRef: string | undefined,
  plan: CapabilitiesManagementActionPlanResult,
): Promise<Record<string, unknown>> {
  if (!skillRef) {
    if (request.action === 'inspect') {
      return { plan }
    }
    throw new AppServerError('invalid_params', 'Skill action reference missing.', {
      plan,
    })
  }
  switch (request.action) {
    case 'enable':
      return context.core.skills.setEnabled({ skillRef, enabled: true })
    case 'disable':
      return context.core.skills.setEnabled({ skillRef, enabled: false })
    case 'set-model-invocation':
      return context.core.skills.setInvocation({
        skillRef,
        modelInvocable: request.params?.modelInvocable as boolean,
      })
    case 'set-user-invocation':
      return context.core.skills.setInvocation({
        skillRef,
        userInvocable: request.params?.userInvocable as boolean,
      })
    case 'inspect':
      return context.core.skills.inspect({ skillRef })
    case 'repair':
      return context.core.skills.repair({ skillRef, confirmed: true })
    case 'uninstall':
      return context.core.skills.uninstall({ skillRef, confirmed: true })
    default:
      throw new AppServerError(
        'invalid_params',
        `Action "${request.action}" is not executable for Skill.`,
        { plan },
      )
  }
}

async function applyMcpServerCapabilityAction(
  context: AppServerContext,
  request: CapabilityManagementActionApplyRequest,
  name: string | undefined,
  plan: CapabilitiesManagementActionPlanResult,
): Promise<Record<string, unknown>> {
  if (!name) {
    throw new AppServerError('invalid_params', 'MCP action reference missing.', {
      plan,
    })
  }
  switch (request.action) {
    case 'enable':
      return context.core.mcp.setServerEnabled({ name, enabled: true })
    case 'disable':
      return context.core.mcp.setServerEnabled({ name, enabled: false })
    case 'inspect':
      return context.core.mcp.inspectServer({ name })
    case 'test':
      return context.core.mcp.testServer({ name })
    case 'restart':
      return context.core.mcp.restartServer({ name })
    case 'repair':
      return context.core.mcp.repairInstalledServer({
        name,
        ...(isMcpWritableScope(request.params?.scope)
          ? { scope: request.params.scope }
          : {}),
        confirmed: true,
      })
    case 'uninstall':
      return context.core.mcp.uninstallInstalledServer({
        name,
        confirmed: true,
      })
    default:
      throw new AppServerError(
        'invalid_params',
        `Action "${request.action}" is not executable for MCP server.`,
        { plan },
      )
  }
}

function isMcpWritableScope(value: unknown): value is 'user' | 'project' | 'local' {
  return value === 'user' || value === 'project' || value === 'local'
}
