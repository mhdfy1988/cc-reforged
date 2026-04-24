import { z } from 'zod/v4'
import type { Tool } from '../../Tool.js'

const TungstenInputSchema = z.object({}).passthrough()

export const TungstenTool = {
  name: 'TungstenTool',
  description: async () => 'Placeholder Tungsten terminal tool.',
  inputSchema: TungstenInputSchema,
  maxResultSizeChars: Infinity,
  call: async () => ({
    data: undefined,
  }),
  isConcurrencySafe: () => true,
  isEnabled: () => false,
  isReadOnly: () => true,
} as unknown as Tool

export function clearSessionsWithTungstenUsage(): void {}

export function resetInitializationState(): void {}
