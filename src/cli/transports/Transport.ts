import type { StdoutMessage } from 'src/entrypoints/sdk/controlTypes.js'

// Recovery bridge: keep the transport contract as a minimal superset of the
// existing implementations so `.js` imports resolve without widening behavior.
export interface Transport {
  connect(): Promise<void> | void
  write(message: StdoutMessage): Promise<void> | void
  close(): void
  setOnData(callback: (data: string) => void): void
  setOnClose(callback: (closeCode?: number) => void): void
  setOnConnect?(callback: () => void): void
  setOnEvent?(callback: (event: unknown) => void): void
  isConnectedStatus(): boolean
  isClosedStatus(): boolean
  flush?(): Promise<void>
  writeBatch?(messages: StdoutMessage[]): Promise<void>
  droppedBatchCount?: number
  getStateLabel?(): string
  reportState?(state: unknown, details?: unknown): void
  reportMetadata?(metadata: Record<string, unknown>): void
  reportDelivery?(eventId: string, status: 'received' | 'processing' | 'processed'): void
}

