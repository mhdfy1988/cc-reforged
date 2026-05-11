import {
  AuthStatusParamsSchema,
  ConfigGetParamsSchema,
  ModelAvailabilityParamsSchema,
  ModelListParamsSchema,
  ModelSetParamsSchema,
  ModelTestParamsSchema,
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

export async function handleModelSet(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = ModelSetParamsSchema.parse(params ?? {})
  if (!parsedParams.model) {
    throw new Error('LLM model cannot be empty.')
  }
  return context.core.model.setModel({
    ...(parsedParams.provider ? { provider: parsedParams.provider } : {}),
    model: parsedParams.model,
  })
}

export function handleModelAvailability(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = ModelAvailabilityParamsSchema.parse(params ?? {})
  return context.core.model.getAvailability({
    ...(parsedParams.provider ? { provider: parsedParams.provider } : {}),
    ...(parsedParams.model ? { model: parsedParams.model } : {}),
  })
}

export async function handleModelTest(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = ModelTestParamsSchema.parse(params ?? {})
  return context.core.model.testConnection({
    ...(parsedParams.provider ? { provider: parsedParams.provider } : {}),
    ...(parsedParams.model ? { model: parsedParams.model } : {}),
    ...(parsedParams.prompt ? { prompt: parsedParams.prompt } : {}),
  })
}
