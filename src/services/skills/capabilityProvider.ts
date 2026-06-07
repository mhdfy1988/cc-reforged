import { createSkillRuntimeCapabilityCatalog } from '../../skills/skillRuntimeCatalog.js'

export async function createSkillManagementCapabilityCatalog(input: {
  cwd: string
  configHomeDir?: string
  installed: Array<{
    name: string
    lockKey: string
    status: string
    statusMessage: string
    installedRecord: {
      enabled: boolean
      modelInvocable: boolean
      userInvocable: boolean
    }
  }>
}): Promise<ReturnType<typeof createSkillRuntimeCapabilityCatalog>> {
  const { getSkillRuntimeCatalogForCwd } = await import('../../commands.js')
  const runtime = await getSkillRuntimeCatalogForCwd(input.cwd, {
    configHomeDir: input.configHomeDir,
  })
  return createSkillRuntimeCapabilityCatalog({
    commands: runtime.sourceCommands,
    installed: input.installed,
  })
}
