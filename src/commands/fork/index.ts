import type { Command } from '../../commands.js'

const fork = {
  type: 'local-jsx',
  name: 'fork',
  description: 'Fork sub-agent commands (placeholder bridge)',
  isEnabled: () => false,
  load: async () => ({
    call: async () => null,
  }),
} satisfies Command

export default fork
