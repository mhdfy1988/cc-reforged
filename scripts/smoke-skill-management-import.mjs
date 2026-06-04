import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const managementModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/skills/managementService.js')).href
)

const {
  applySkillManagementImportPlan,
  createSkillManagementImportPlan,
  searchSkillManagementInstallCandidates,
} = managementModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-management-import-'))
const configHome = join(root, 'ccr-home')
const sourceSkill = join(root, 'source-skill')
const commandFile = join(root, 'commands', 'check-release.md')

try {
  await mkdir(join(sourceSkill, 'references'), { recursive: true })
  await writeFile(
    join(sourceSkill, 'SKILL.md'),
    `---\nname: import-dir-demo\ndescription: Import directory demo.\n---\n\nUse this skill for import directory smoke.\n`,
    'utf8',
  )
  await writeFile(join(sourceSkill, 'references', 'note.md'), 'note\n', 'utf8')

  const dirPlan = await createSkillManagementImportPlan(
    {
      source: {
        kind: 'local-skill-dir',
        path: sourceSkill,
      },
    },
    { configHomeDir: configHome },
  )
  assert.equal(dirPlan.importable, true)
  assert.equal(dirPlan.conversion.required, false)
  const dirResult = await applySkillManagementImportPlan(
    {
      source: dirPlan.source,
      confirmed: true,
      confirmationToken: dirPlan.confirmation.token,
    },
    { configHomeDir: configHome },
  )
  assert.equal(dirResult.result.name, 'import-dir-demo')

  await mkdir(dirname(commandFile), { recursive: true })
  await writeFile(
    commandFile,
    `---\ndescription: Check release status.\nargument-hint: [version]\n---\n\nCheck release readiness for $ARGUMENTS.\n`,
    'utf8',
  )

  const commandPlan = await createSkillManagementImportPlan(
    {
      source: {
        kind: 'claude-command',
        path: commandFile,
      },
    },
    { configHomeDir: configHome },
  )
  assert.equal(commandPlan.importable, true)
  assert.equal(commandPlan.conversion.required, true)
  const commandResult = await applySkillManagementImportPlan(
    {
      source: commandPlan.source,
      confirmed: true,
      confirmationToken: commandPlan.confirmation.token,
    },
    { configHomeDir: configHome },
  )
  assert.equal(commandResult.result.package.origin.vendor, 'claude')

  const search = await searchSkillManagementInstallCandidates(
    {},
    { configHomeDir: configHome },
  )
  assert.equal(
    search.candidates.some(item => item.manifestInput?.name === 'import-dir-demo'),
    true,
  )
  assert.equal(
    search.candidates.some(item => item.manifestInput?.name === commandResult.result.name),
    true,
  )
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-skill-management-import: ok')
