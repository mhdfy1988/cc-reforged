import type { JsonObject } from './displayTypes.js'

export type DisplayEventContractContext = {
  itemId: string
  params?: JsonObject
  item?: JsonObject
  block?: JsonObject
  contentIndex?: number
}

export type DisplayEventIdentity = {
  itemId: string
  threadId?: string
  turnId?: string
  contentIndex?: number
  toolUseId?: string
  parentToolUseId?: string
  requestId?: string
  provider?: string
  model?: string
  missingFields: string[]
  raw: {
    params?: JsonObject
    item?: JsonObject
    block?: JsonObject
  }
}

const REQUIRED_DISPLAY_FIELDS = ['threadId', 'turnId']

export function createDisplayEventIdentity(
  context: DisplayEventContractContext,
): DisplayEventIdentity {
  const threadId = readStringField(context.params, ['threadId']) ??
    readStringField(context.item, ['threadId']) ??
    readStringField(context.block, ['threadId'])
  const turnId = readStringField(context.params, ['turnId']) ??
    readStringField(context.item, ['turnId']) ??
    readStringField(context.block, ['turnId'])
  const contentIndex =
    context.contentIndex ??
    readNumberField(context.block, ['contentIndex', 'index']) ??
    readNumberField(context.params, ['contentIndex', 'index'])

  const identity: DisplayEventIdentity = {
    itemId: context.itemId,
    threadId,
    turnId,
    contentIndex,
    toolUseId:
      readStringField(context.block, [
        'id',
        'toolUseId',
        'toolUseID',
        'tool_use_id',
      ]) ??
      readStringField(context.params, [
        'toolUseId',
        'toolUseID',
        'tool_use_id',
      ]),
    parentToolUseId:
      readStringField(context.block, [
        'parentToolUseId',
        'parentToolUseID',
        'parent_tool_use_id',
      ]) ??
      readStringField(context.params, [
        'parentToolUseId',
        'parentToolUseID',
        'parent_tool_use_id',
      ]),
    requestId:
      readStringField(context.params, ['requestId']) ??
      readStringField(context.block, ['requestId']),
    provider:
      readStringField(context.params, ['provider']) ??
      readStringField(context.item, ['provider']),
    model:
      readStringField(context.params, ['model']) ??
      readStringField(context.item, ['model']),
    missingFields: [],
    raw: {
      params: context.params,
      item: context.item,
      block: context.block,
    },
  }

  identity.missingFields = REQUIRED_DISPLAY_FIELDS.filter(
    field => !identity[field as 'threadId' | 'turnId'],
  )
  return identity
}

export function createCompletedItemContractContext(input: {
  itemId: string
  params?: JsonObject
  item?: JsonObject
}): DisplayEventContractContext {
  return {
    itemId: input.itemId,
    params: input.params,
    item: input.item,
  }
}

export function withContentBlock(
  context: DisplayEventContractContext,
  block: JsonObject,
  contentIndex: number,
): DisplayEventContractContext {
  return {
    ...context,
    block,
    contentIndex,
  }
}

function readStringField(
  source: JsonObject | undefined,
  keys: string[],
): string | undefined {
  if (!source) {
    return undefined
  }

  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}

function readNumberField(
  source: JsonObject | undefined,
  keys: string[],
): number | undefined {
  if (!source) {
    return undefined
  }

  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return undefined
}
