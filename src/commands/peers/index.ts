import type { Command } from '../../commands.js'

const peers = {
  type: 'local-jsx',
  name: 'peers',
  description: 'Peer workflow commands (placeholder bridge)',
  isEnabled: () => false,
  load: async () => ({
    call: async () => null,
  }),
} satisfies Command

export default peers
