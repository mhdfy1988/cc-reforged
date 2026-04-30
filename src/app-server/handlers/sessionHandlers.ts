import {
  ThreadListParamsSchema,
  ThreadStartParamsSchema,
  TurnInterruptParamsSchema,
  TurnStartParamsSchema,
} from '../protocol.js'
import type { AppServerContext } from '../router.js'

export function handleThreadStart(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = ThreadStartParamsSchema.parse(params ?? {})
  return {
    thread: context.core.session.startThread(parsedParams),
  }
}

export function handleThreadList(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  ThreadListParamsSchema.parse(params ?? {})
  return {
    threads: context.core.session.listThreads(),
  }
}

export function handleTurnStart(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = TurnStartParamsSchema.parse(params)
  return {
    turn: context.core.session.startTurn({
      threadId: parsedParams.threadId!,
      input: {
        type: parsedParams.input!.type!,
        text: parsedParams.input!.text!,
      },
    }),
  }
}

export function handleTurnInterrupt(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = TurnInterruptParamsSchema.parse(params)
  return context.core.session.interruptTurn({
    threadId: parsedParams.threadId!,
    turnId: parsedParams.turnId!,
    ...(parsedParams.reason ? { reason: parsedParams.reason } : {}),
  })
}
