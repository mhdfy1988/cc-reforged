import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export async function createRuntimeSmokeEnv(prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix))
  const configHome = join(root, 'ccr-home')
  process.env.CCR_CONFIG_DIR = configHome
  return {
    root,
    configHome,
    async cleanup() {
      await rm(root, { recursive: true, force: true })
    },
  }
}

export async function importDist(...parts) {
  return import(pathToFileURL(join(repoRoot, 'dist', ...parts)).href)
}

export async function enableRuntimeCommandLoading() {
  const [configModule, stateModule] = await Promise.all([
    importDist('src/utils/config.js'),
    importDist('src/bootstrap/state.js'),
  ])
  configModule.enableConfigs()
  stateModule.setAllowedSettingSources([
    'userSettings',
    'projectSettings',
    'localSettings',
  ])
}

export async function writeSourceSkill(root, name, options = {}) {
  const skillDir = join(root, 'source-skills', name)
  await mkdir(skillDir, { recursive: true })
  await writeFile(
    join(skillDir, 'SKILL.md'),
    skillMarkdown(name, options),
    'utf8',
  )
  return skillDir
}

export async function installSkillFromSource(input) {
  const management = await importDist('src/services/skills/managementService.js')
  const manifest = {
    schemaVersion: 1,
    name: input.name,
    displayName: input.displayName ?? input.name,
    description: input.description ?? `${input.name} runtime smoke skill.`,
    source: {
      kind: 'imported-skill',
      path: input.sourceDir,
    },
    targetScope: 'user',
    defaults: {
      enabled: input.enabled ?? true,
      modelInvocable: input.modelInvocable ?? true,
      userInvocable: input.userInvocable ?? true,
    },
    trust: {
      thirdParty: false,
      executableContent: false,
      networkDeclared: false,
      secretsDeclared: [],
    },
    compatibility: {
      vendor: 'agent-skills',
      convertedFromCommand: false,
    },
  }
  const plan = await management.createSkillManagementInstallPlan(
    { manifest },
    { configHomeDir: input.configHome },
  )
  const securityOverrideToken =
    input.allowSecurityOverride && plan.securityDecision?.requiresOverride
      ? plan.securityDecision.overrideToken
      : undefined
  if (!plan.installable) {
    if (securityOverrideToken) {
      return management.applySkillManagementInstallPlan(
        {
          manifest,
          confirmed: true,
          confirmationToken: plan.confirmation.token,
          securityOverrideToken,
        },
        { configHomeDir: input.configHome },
      )
    }
    throw new Error(
      `Expected installable skill plan for ${input.name}: ${JSON.stringify(plan.conflicts)}`,
    )
  }
  return management.applySkillManagementInstallPlan(
    {
      manifest,
      confirmed: true,
      confirmationToken: plan.confirmation.token,
    },
    { configHomeDir: input.configHome },
  )
}

export function skillMarkdown(name, options = {}) {
  const userInvocable = options.userInvocable ?? true
  const disableModelInvocation = options.disableModelInvocation ?? false
  const body = options.body ?? `Runtime smoke body for ${name}.`
  const extraFrontmatter = options.frontmatter
    ? `${options.frontmatter.trim()}\n`
    : ''
  return `---\nname: ${name}\ndescription: ${name} runtime smoke skill.\nuser-invocable: ${userInvocable}\ndisable-model-invocation: ${disableModelInvocation}\n${extraFrontmatter}---\n\n${body}\n`
}
