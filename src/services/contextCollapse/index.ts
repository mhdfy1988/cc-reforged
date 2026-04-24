import type { QuerySource } from '../../constants/querySource.js'
import type { Message } from '../../types/message.js'
import { projectView } from './operations.js'

type ContextCollapseHealth = {
  totalSpawns: number
  totalErrors: number
  lastError?: string
  emptySpawnWarningEmitted: boolean
  totalEmptySpawns: number
}

type ContextCollapseStats = {
  collapsedSpans: number
  collapsedMessages: number
  stagedSpans: number
  health: ContextCollapseHealth
}

const DEFAULT_STATS: ContextCollapseStats = {
  collapsedSpans: 0,
  collapsedMessages: 0,
  stagedSpans: 0,
  health: {
    totalSpawns: 0,
    totalErrors: 0,
    emptySpawnWarningEmitted: false,
    totalEmptySpawns: 0,
  },
}

function cloneDefaultStats(): ContextCollapseStats {
  return {
    collapsedSpans: DEFAULT_STATS.collapsedSpans,
    collapsedMessages: DEFAULT_STATS.collapsedMessages,
    stagedSpans: DEFAULT_STATS.stagedSpans,
    health: {
      totalSpawns: DEFAULT_STATS.health.totalSpawns,
      totalErrors: DEFAULT_STATS.health.totalErrors,
      lastError: DEFAULT_STATS.health.lastError,
      emptySpawnWarningEmitted: DEFAULT_STATS.health.emptySpawnWarningEmitted,
      totalEmptySpawns: DEFAULT_STATS.health.totalEmptySpawns,
    },
  }
}

let stats: ContextCollapseStats = cloneDefaultStats()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getStats(): ContextCollapseStats {
  return stats
}

export function isContextCollapseEnabled(): boolean {
  return false
}

export function resetContextCollapse(): void {
  stats = cloneDefaultStats()
  emit()
}

export async function applyCollapsesIfNeeded(
  messages: Message[],
  _toolUseContext: unknown,
  _querySource?: QuerySource,
): Promise<{ messages: Message[] }> {
  return { messages: projectView(messages) }
}

export function recoverFromOverflow(
  messages: Message[],
  _querySource?: QuerySource,
): { committed: number; messages: Message[] } {
  return {
    committed: 0,
    messages: projectView(messages),
  }
}

export function isWithheldPromptTooLong(_message: unknown): boolean {
  return false
}

export { projectView }
