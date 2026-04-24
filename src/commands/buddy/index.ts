import type { Command } from '../../commands.js'

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Buddy commands (placeholder bridge)',
  isEnabled: () => false,
  load: async () => ({
    call: async () => null,
  }),
} satisfies Command

export default buddy
