import {
  CompactRunParamsSchema,
  ContextAnalyzeParamsSchema,
  ThreadScopedStatusParamsSchema,
} from '../protocol.js'
import type { AppServerContext } from '../router.js'

export function handleContextStatus(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = ThreadScopedStatusParamsSchema.parse(params ?? {})
  return context.core.session.getContextStatus(parsedParams)
}

export async function handleContextAnalyze(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = ContextAnalyzeParamsSchema.parse(params ?? {})
  return context.core.session.getContextAnalysis(parsedParams)
}

export function handleCompactStatus(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = ThreadScopedStatusParamsSchema.parse(params ?? {})
  return context.core.session.getCompactStatus(parsedParams)
}

export async function handleCompactRun(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = CompactRunParamsSchema.parse(params)
  if (!parsedParams.threadId) {
    throw new Error('threadId is required.')
  }
  return context.core.session.runCompact({
    threadId: parsedParams.threadId,
    instruction: parsedParams.instruction,
  })
}

export async function handleMemorySessionStatus(
  context: AppServerContext,
  params: unknown,
): Promise<Record<string, unknown>> {
  const parsedParams = ThreadScopedStatusParamsSchema.parse(params ?? {})
  return context.core.session.getMemorySessionStatus(parsedParams)
}
