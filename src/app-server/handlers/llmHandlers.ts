import {
  AuthStatusParamsSchema,
  ConfigGetParamsSchema,
  ModelListParamsSchema,
} from '../protocol.js'
import type { AppServerContext } from '../router.js'

export function handleConfigGet(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  ConfigGetParamsSchema.parse(params ?? {})
  return context.core.config.getSnapshot()
}

export async function handleAuthStatus(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = AuthStatusParamsSchema.parse(params ?? {})
  return context.core.auth.getStatus(parsedParams.provider)
}

export function handleModelList(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = ModelListParamsSchema.parse(params ?? {})
  return context.core.model.listModels(parsedParams.provider)
}
