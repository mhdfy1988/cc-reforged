import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [discoveryModule, converterModule, frontmatterModule] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/importDiscovery.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/importConverter.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/utils/frontmatterParser.js')).href),
])

const { discoverSkillImportCandidate } = discoveryModule
const { convertClaudeCommandToSkill } = converterModule
const { parseFrontmatter } = frontmatterModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-import-command-'))

try {
  const commandDir = join(root, '.claude', 'commands')
  await mkdir(commandDir, { recursive: true })
  const commandPath = join(commandDir, 'foo.md')
  const commandMarkdown = `---\ndescription: Run foo command.\nallowed-tools: Read\nargument-hint: <name>\nmodel: inherit\n---\n\nRun foo with $ARGUMENTS.\n`
  await writeFile(commandPath, commandMarkdown, 'utf8')

  const parsedCommand = parseFrontmatter(commandMarkdown, commandPath)
  const conversion = convertClaudeCommandToSkill({
    commandPath,
    frontmatter: parsedCommand.frontmatter,
    body: parsedCommand.content,
  })
  assert.equal(conversion.skillName, 'foo')
  assert.equal(conversion.frontmatter.description, 'Run foo command.')
  assert.equal(conversion.frontmatter['user-invocable'], 'true')
  assert.equal(conversion.markdownContent.startsWith('---\n'), true)
  assert.equal(conversion.markdownContent.includes('name: foo\n'), true)
  assert.equal(conversion.markdownContent.includes('Run foo with $ARGUMENTS.'), true)
  assert.equal(
    conversion.notes.some(value => value.includes('$ARGUMENTS')),
    true,
  )

  const candidateResult = await discoverSkillImportCandidate({
    kind: 'claude-command',
    path: commandPath,
  })
  assert.equal(candidateResult.success, true)
  assert.equal(candidateResult.candidate.name, 'foo')
  assert.equal(candidateResult.candidate.originVendor, 'claude')
  assert.equal(candidateResult.candidate.normalizedPreview.origin.vendor, 'claude')
  assert.equal(candidateResult.candidate.normalizedPreview.invocation.userInvocable, true)
  assert.deepEqual(candidateResult.candidate.normalizedPreview.invocation.allowedTools, [
    'Read',
  ])
  assert.equal(
    candidateResult.candidate.warnings.some(value => value.includes('$ARGUMENTS')),
    true,
  )

  const fallbackPath = join(commandDir, 'fallback.md')
  await writeFile(
    fallbackPath,
    `Summarize the current repository status.\n\nThen propose next steps.\n`,
    'utf8',
  )
  const fallbackResult = await discoverSkillImportCandidate({
    kind: 'claude-command',
    path: fallbackPath,
  })
  assert.equal(fallbackResult.success, true)
  assert.equal(fallbackResult.candidate.name, 'fallback')
  assert.equal(
    fallbackResult.candidate.description,
    'Summarize the current repository status.',
  )
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-skill-import-command-conversion: ok')
