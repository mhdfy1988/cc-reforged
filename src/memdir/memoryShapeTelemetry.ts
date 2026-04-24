import type { MemoryHeader } from './memoryScan.js'

export function logMemoryWriteShape(..._args: unknown[]): void {}

export function logMemoryRecallShape(
  _memories: readonly MemoryHeader[],
  _selected: readonly MemoryHeader[],
): void {}
