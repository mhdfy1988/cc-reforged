import type { Command } from '../../commands.js'

const workflows = {
  type: 'local-jsx',
  name: 'workflows',
  description: 'Workflow scripts (placeholder bridge)',
  aliases: ['workflow'],
  isEnabled: () => false,
  load: async () => ({
    call: async () => null,
  }),
} satisfies Command

export default workflows
