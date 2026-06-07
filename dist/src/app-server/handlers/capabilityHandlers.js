import { CapabilitiesAppsRegisterParamsSchema, CapabilitiesManagementActionApplyParamsSchema, CapabilitiesManagementActionPlanParamsSchema, CapabilitiesListParamsSchema, CapabilitiesManagementListParamsSchema, } from '../protocol.js';
import { AppServerError } from '../errors.js';
import { canApplyCapabilityManagementAction, createCapabilityManagementActionPlan, getCapabilityManagementActionTargetRef, } from '../../services/capabilities/managementActionService.js';
export function handleCapabilitiesAppsRegister(context, params) {
    const parsedParams = CapabilitiesAppsRegisterParamsSchema.parse(params);
    return context.core.capabilities.apps.register(parsedParams);
}
export async function handleCapabilitiesList(context, params) {
    const parsedParams = CapabilitiesListParamsSchema.parse(params ?? {});
    return context.core.capabilities.list({
        ...parsedParams,
        cwd: parsedParams.cwd ?? process.cwd(),
        configHomeDir: parsedParams.configHomeDir ?? context.ccrHome,
    });
}
export async function handleCapabilitiesManagementList(context, params) {
    const parsedParams = CapabilitiesManagementListParamsSchema.parse(params ?? {});
    return context.core.capabilities.listManagement({
        ...parsedParams,
        cwd: parsedParams.cwd ?? process.cwd(),
        configHomeDir: parsedParams.configHomeDir ?? context.ccrHome,
    });
}
export async function handleCapabilityManagementActionPlan(context, params) {
    const parsedParams = CapabilitiesManagementActionPlanParamsSchema.parse(params);
    const management = await loadCapabilityManagementProjection(context, parsedParams);
    return createCapabilityManagementActionPlan(management, toCapabilityActionRequest(context, parsedParams));
}
export async function handleCapabilityManagementActionApply(context, params) {
    const parsedParams = CapabilitiesManagementActionApplyParamsSchema.parse(params);
    const management = await loadCapabilityManagementProjection(context, parsedParams);
    const request = toCapabilityActionApplyRequest(context, parsedParams);
    const plan = createCapabilityManagementActionPlan(management, request, {
        issueConfirmationToken: false,
    });
    const guard = canApplyCapabilityManagementAction(plan, request);
    if (guard.ok === false) {
        throw new AppServerError('invalid_params', guard.reason, { plan });
    }
    const result = await applyCapabilityManagementAction(context, plan, request);
    const nextManagement = await loadCapabilityManagementProjection(context, parsedParams);
    return {
        schemaVersion: 1,
        applied: true,
        plan,
        result,
        management: nextManagement,
    };
}
async function loadCapabilityManagementProjection(context, params) {
    return context.core.capabilities.listManagement({
        cwd: params.cwd ?? process.cwd(),
        configHomeDir: params.configHomeDir ?? context.ccrHome,
    });
}
function toCapabilityActionRequest(context, params) {
    return {
        capabilityId: params.capabilityId,
        action: params.action,
        ...(params.actionRef ? { actionRef: params.actionRef } : {}),
        ...(params.params ? { params: params.params } : {}),
        context: {
            cwd: params.cwd ?? process.cwd(),
            configHomeDir: params.configHomeDir ?? context.ccrHome,
        },
    };
}
function toCapabilityActionApplyRequest(context, params) {
    return {
        ...toCapabilityActionRequest(context, params),
        ...(params.confirmed !== undefined ? { confirmed: params.confirmed } : {}),
        ...(params.confirmationToken
            ? { confirmationToken: params.confirmationToken }
            : {}),
    };
}
async function applyCapabilityManagementAction(context, plan, request) {
    const targetRef = getCapabilityManagementActionTargetRef(plan);
    const target = plan.target;
    if (!target) {
        throw new AppServerError('invalid_params', 'Capability action target missing.', {
            plan,
        });
    }
    if (target.kind === 'skill') {
        return applySkillCapabilityAction(context, request, targetRef, plan);
    }
    if (target.kind === 'mcp-server') {
        return applyMcpServerCapabilityAction(context, request, targetRef, plan);
    }
    if (request.action === 'inspect') {
        return {
            capabilityId: target.capabilityId,
            kind: target.kind,
            name: target.name,
            displayName: target.displayName,
            managementOwnership: target.managementOwnership,
        };
    }
    throw new AppServerError('invalid_params', `Action "${request.action}" is not executable for capability kind "${target.kind}".`, { plan });
}
async function applySkillCapabilityAction(context, request, skillRef, plan) {
    if (!skillRef) {
        if (request.action === 'inspect') {
            return { plan };
        }
        throw new AppServerError('invalid_params', 'Skill action reference missing.', {
            plan,
        });
    }
    switch (request.action) {
        case 'enable':
            return context.core.skills.setEnabled({ skillRef, enabled: true });
        case 'disable':
            return context.core.skills.setEnabled({ skillRef, enabled: false });
        case 'set-model-invocation':
            return context.core.skills.setInvocation({
                skillRef,
                modelInvocable: request.params?.modelInvocable,
            });
        case 'set-user-invocation':
            return context.core.skills.setInvocation({
                skillRef,
                userInvocable: request.params?.userInvocable,
            });
        case 'inspect':
            return context.core.skills.inspect({ skillRef });
        case 'repair':
            return context.core.skills.repair({ skillRef, confirmed: true });
        case 'uninstall':
            return context.core.skills.uninstall({ skillRef, confirmed: true });
        default:
            throw new AppServerError('invalid_params', `Action "${request.action}" is not executable for Skill.`, { plan });
    }
}
async function applyMcpServerCapabilityAction(context, request, name, plan) {
    if (!name) {
        throw new AppServerError('invalid_params', 'MCP action reference missing.', {
            plan,
        });
    }
    switch (request.action) {
        case 'enable':
            return context.core.mcp.setServerEnabled({ name, enabled: true });
        case 'disable':
            return context.core.mcp.setServerEnabled({ name, enabled: false });
        case 'inspect':
            return context.core.mcp.inspectServer({ name });
        case 'test':
            return context.core.mcp.testServer({ name });
        case 'restart':
            return context.core.mcp.restartServer({ name });
        case 'repair':
            return context.core.mcp.repairInstalledServer({
                name,
                ...(isMcpWritableScope(request.params?.scope)
                    ? { scope: request.params.scope }
                    : {}),
                confirmed: true,
            });
        case 'uninstall':
            return context.core.mcp.uninstallInstalledServer({
                name,
                confirmed: true,
            });
        default:
            throw new AppServerError('invalid_params', `Action "${request.action}" is not executable for MCP server.`, { plan });
    }
}
function isMcpWritableScope(value) {
    return value === 'user' || value === 'project' || value === 'local';
}
//# sourceMappingURL=capabilityHandlers.js.map