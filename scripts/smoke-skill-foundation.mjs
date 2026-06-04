import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const [
  normalizerModule,
  schemaModule,
  catalogModule,
  adapterModule,
] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/skills/normalizeSkillPackage.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/skills/packageSchema.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/skills/skillCatalog.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/skills/skillCommandAdapter.js')).href),
])

const { normalizeSkillPackage } = normalizerModule
const { safeParseCcrSkillPackage } = schemaModule
const { createSkillCatalog } = catalogModule
const { toPromptCommand } = adapterModule

const parsed = {
  displayName: 'Foundation Check',
  description: 'Use when checking CCR skill foundations.',
  hasUserSpecifiedDescription: true,
  allowedTools: ['Read', 'Grep'],
  argumentHint: '<topic>',
  argumentNames: ['topic'],
  whenToUse: 'The user asks to verify skill S-1 foundations.',
  version: '1.0.0',
  model: 'deepseek-v4-flash',
  disableModelInvocation: true,
  userInvocable: false,
  executionContext: 'fork',
  agent: 'general-purpose',
  effort: 'low',
}

const skillPackage = normalizeSkillPackage({
  skillName: 'foundation-check',
  markdownContent: 'Follow the S-1 verification checklist.',
  frontmatter: {
    name: 'foundation-check',
    description: parsed.description,
    version: parsed.version,
  },
  parsed,
  source: 'project',
  filePath: 'D:/tmp/foundation-check/SKILL.md',
  baseDir: 'D:/tmp/foundation-check',
  resources: {
    scripts: ['scripts/check.js'],
    references: ['references/spec.md'],
    assets: ['assets/icon.png'],
  },
  openaiYaml: {
    interface: {
      short_description: 'Short UI description',
      icon_small: './assets/small.svg',
      icon_large: './assets/large.png',
      brand_color: '#123456',
      default_prompt: 'Run the foundation check.',
    },
  },
})

assert.equal(skillPackage.schemaVersion, 1)
assert.equal(skillPackage.name, 'foundation-check')
assert.equal(skillPackage.displayName, 'Foundation Check')
assert.equal(skillPackage.description, parsed.description)
assert.equal(skillPackage.source, 'project')
assert.equal(skillPackage.origin.vendor, 'codex')
assert.equal(skillPackage.interface.shortDescription, 'Short UI description')
assert.deepEqual(skillPackage.resources.scripts, ['scripts/check.js'])
assert.equal(skillPackage.invocation.modelInvocable, false)
assert.equal(skillPackage.invocation.userInvocable, false)
assert.equal(skillPackage.invocation.context, 'fork')
assert.deepEqual(skillPackage.invocation.allowedTools, ['Read', 'Grep'])
assert.equal(skillPackage.invocation.argumentHint, '<topic>')
assert.deepEqual(skillPackage.invocation.argumentNames, ['topic'])
assert.equal(skillPackage.invocation.whenToUse, parsed.whenToUse)
assert.equal(skillPackage.invocation.model, 'deepseek-v4-flash')
assert.equal(skillPackage.invocation.effort, 'low')
assert.equal(skillPackage.invocation.agent, 'general-purpose')

const openClawPackage = normalizeSkillPackage({
  skillName: 'openclaw-style',
  markdownContent: 'OpenClaw compatible body.',
  frontmatter: {
    description: 'OpenClaw compatible skill.',
    metadata: {
      openclaw: {
        skillKey: 'openclaw-style',
      },
    },
  },
  parsed: {
    description: 'OpenClaw compatible skill.',
    hasUserSpecifiedDescription: true,
    allowedTools: [],
    argumentNames: [],
    disableModelInvocation: false,
    userInvocable: true,
  },
  source: 'imported',
  filePath: 'D:/tmp/openclaw-style/SKILL.md',
  baseDir: 'D:/tmp/openclaw-style',
})
assert.equal(openClawPackage.origin.vendor, 'openclaw')

const legacyPackage = normalizeSkillPackage({
  skillName: 'legacy-command',
  markdownContent: 'Legacy command body.',
  frontmatter: {
    description: 'Legacy command converted through S-1.',
  },
  parsed: {
    description: 'Legacy command converted through S-1.',
    hasUserSpecifiedDescription: true,
    allowedTools: [],
    argumentNames: [],
    disableModelInvocation: false,
    userInvocable: true,
  },
  source: 'legacy-command',
  filePath: 'D:/tmp/.claude/commands/legacy-command.md',
  baseDir: null,
  compatibilityHints: {
    vendor: 'claude',
    legacyCommand: true,
  },
})
assert.equal(legacyPackage.source, 'legacy-command')
assert.equal(legacyPackage.origin.vendor, 'claude')

for (const source of ['bundled', 'plugin', 'mcp']) {
  const result = safeParseCcrSkillPackage({
    schemaVersion: 1,
    id: `${source}:future-source`,
    name: `${source}-future-source`,
    description: `Future ${source} source package.`,
    bodyPath: null,
    body: 'Future source body.',
    baseDir: null,
    source,
    origin: {
      vendor: source === 'mcp' || source === 'bundled' ? 'ccr' : 'claude',
      sourcePath: null,
    },
    resources: {
      scripts: [],
      references: [],
      assets: [],
    },
    invocation: {
      modelInvocable: true,
      userInvocable: true,
      context: 'inline',
      allowedTools: [],
      argumentNames: [],
    },
    compatibility: {
      rawFrontmatter: {},
      warnings: [],
    },
  })
  assert.equal(result.success, true, `${source} source should be schema-ready`)
}

assert.equal(
  safeParseCcrSkillPackage({
    ...skillPackage,
    resources: {
      scripts: ['../escape.js'],
      references: [],
      assets: [],
    },
  }).success,
  false,
)

let adapterInput = null
const command = toPromptCommand(skillPackage, {
  source: 'projectSettings',
  loadedFrom: 'skills',
  createSkillCommand(input) {
    adapterInput = input
    return {
      type: 'prompt',
      name: input.skillName,
      displayName: input.displayName,
      description: input.description,
      hasUserSpecifiedDescription: input.hasUserSpecifiedDescription,
      allowedTools: input.allowedTools,
      argumentHint: input.argumentHint,
      argumentNames: input.argumentNames,
      whenToUse: input.whenToUse,
      version: input.version,
      model: input.model,
      disableModelInvocation: input.disableModelInvocation,
      userInvocable: input.userInvocable,
      source: input.source,
      loadedFrom: input.loadedFrom,
      skillRoot: input.baseDir,
      context: input.executionContext,
      agent: input.agent,
      effort: input.effort,
      getPromptForCommand: async () => [{ type: 'text', text: input.markdownContent }],
    }
  },
})

assert.equal(adapterInput.skillName, 'foundation-check')
assert.equal(adapterInput.disableModelInvocation, true)
assert.equal(adapterInput.userInvocable, false)
assert.equal(adapterInput.executionContext, 'fork')
assert.equal(command.name, 'foundation-check')
assert.equal(command.disableModelInvocation, true)
assert.equal(command.userInvocable, false)
assert.equal(command.context, 'fork')
assert.equal(command.source, 'projectSettings')
assert.equal(command.loadedFrom, 'skills')

const duplicateIdentity = {
  ...skillPackage,
  id: 'duplicate-identity',
  name: 'foundation-check-copy',
}
const duplicateName = {
  ...openClawPackage,
  id: 'duplicate-name',
  name: 'foundation-check',
  bodyPath: 'D:/tmp/another/SKILL.md',
  origin: {
    ...openClawPackage.origin,
    sourcePath: 'D:/tmp/another/SKILL.md',
  },
}

const catalog = createSkillCatalog([
  legacyPackage,
  duplicateName,
  duplicateIdentity,
  skillPackage,
])

assert.deepEqual(
  catalog.list().map(item => item.id),
  [skillPackage.id, duplicateName.id, legacyPackage.id],
)
assert.equal(catalog.findByName('foundation-check').id, skillPackage.id)
assert.equal(catalog.filterModelInvocable().length, 2)
assert.equal(catalog.filterUserInvocable().length, 2)
assert.equal(catalog.groupBySource().get('legacy-command').length, 1)
assert.equal(
  catalog.diagnostics().some(item => item.kind === 'duplicate-identity'),
  true,
)
assert.equal(
  catalog.diagnostics().some(item => item.kind === 'duplicate-name'),
  true,
)

console.log('smoke-skill-foundation: ok')
