import {
  McpAddParamsSchema,
  McpDisableParamsSchema,
  McpEnableParamsSchema,
  McpInstallAdoptApplyParamsSchema,
  McpInstallAdoptPlanParamsSchema,
  McpInstallApplyParamsSchema,
  McpInstallListParamsSchema,
  McpInstallPlanParamsSchema,
  McpInstallRepairParamsSchema,
  McpInstallSearchParamsSchema,
  McpInstallUninstallParamsSchema,
  McpInspectParamsSchema,
  McpListParamsSchema,
  McpRemoveParamsSchema,
  McpRestartParamsSchema,
  McpTestParamsSchema,
  McpUpdateParamsSchema,
} from '../protocol.js'
import type { AppServerContext } from '../router.js'

type McpNameParams = {
  name: string
}

type McpMutationParams = {
  name: string
  scope: 'user' | 'project' | 'local'
  config: Record<string, unknown>
}

type McpRemoveParams = {
  name: string
  scope: 'user' | 'project' | 'local'
}

type McpInstallSearchParams = {
  query?: string
}

type McpInstallPlanParams = {
  name?: string
  scope?: 'user' | 'project' | 'local'
  manifest: Record<string, unknown>
  force?: boolean
}

type McpInstallApplyParams = McpInstallPlanParams & {
  confirmed: boolean
  confirmationToken: string
}

type McpInstallAdoptPlanParams = {
  name: string
}

type McpInstallAdoptApplyParams = McpInstallAdoptPlanParams & {
  confirmed: boolean
  confirmationToken: string
}

type McpInstallUninstallParams = {
  name: string
  confirmed: boolean
}

type McpInstallRepairParams = {
  name: string
  scope?: 'user' | 'project' | 'local'
  confirmed: boolean
}

export async function handleMcpList(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = McpListParamsSchema.parse(params ?? {})
  return context.core.mcp.listServers({
    includeDisabled: parsedParams.includeDisabled,
  })
}

export function handleMcpInspect(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = McpInspectParamsSchema.parse(params) as McpNameParams
  return context.core.mcp.inspectServer(parsedParams)
}

export async function handleMcpAdd(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = McpAddParamsSchema.parse(params) as McpMutationParams
  return context.core.mcp.addServer(parsedParams)
}

export async function handleMcpUpdate(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = McpUpdateParamsSchema.parse(params) as McpMutationParams
  return context.core.mcp.updateServer(parsedParams)
}

export async function handleMcpRemove(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = McpRemoveParamsSchema.parse(params) as McpRemoveParams
  return context.core.mcp.removeServer(parsedParams)
}

export function handleMcpEnable(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = McpEnableParamsSchema.parse(params) as McpNameParams
  return context.core.mcp.setServerEnabled({
    name: parsedParams.name,
    enabled: true,
  })
}

export function handleMcpDisable(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = McpDisableParamsSchema.parse(params) as McpNameParams
  return context.core.mcp.setServerEnabled({
    name: parsedParams.name,
    enabled: false,
  })
}

export function handleMcpRestart(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = McpRestartParamsSchema.parse(params) as McpNameParams
  return context.core.mcp.restartServer(parsedParams)
}

export async function handleMcpTest(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = McpTestParamsSchema.parse(params) as McpNameParams
  return context.core.mcp.testServer(parsedParams)
}

export async function handleMcpInstallSearch(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = McpInstallSearchParamsSchema.parse(
    params ?? {},
  ) as McpInstallSearchParams
  return context.core.mcp.searchInstallCandidates(parsedParams)
}

export function handleMcpInstallPlan(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = McpInstallPlanParamsSchema.parse(
    params,
  ) as McpInstallPlanParams
  return context.core.mcp.planInstall(parsedParams)
}

export async function handleMcpInstallApply(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = McpInstallApplyParamsSchema.parse(
    params,
  ) as McpInstallApplyParams
  return context.core.mcp.applyInstall(parsedParams)
}

export async function handleMcpInstallAdoptPlan(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = McpInstallAdoptPlanParamsSchema.parse(
    params,
  ) as McpInstallAdoptPlanParams
  return context.core.mcp.planAdopt(parsedParams)
}

export async function handleMcpInstallAdoptApply(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = McpInstallAdoptApplyParamsSchema.parse(
    params,
  ) as McpInstallAdoptApplyParams
  return context.core.mcp.applyAdopt(parsedParams)
}

export async function handleMcpInstallList(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  McpInstallListParamsSchema.parse(params ?? {})
  return context.core.mcp.listInstalls()
}

export async function handleMcpInstallUninstall(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = McpInstallUninstallParamsSchema.parse(
    params,
  ) as McpInstallUninstallParams
  return context.core.mcp.uninstallInstalledServer(parsedParams)
}

export async function handleMcpInstallRepair(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = McpInstallRepairParamsSchema.parse(
    params,
  ) as McpInstallRepairParams
  return context.core.mcp.repairInstalledServer(parsedParams)
}
