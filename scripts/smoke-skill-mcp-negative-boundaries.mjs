import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const configHome = await mkdtemp(join(tmpdir(), 'ccr-skill-mcp-negative-'))
process.env.CCR_CONFIG_DIR = configHome

try {
  const [
    configModule,
    mcpInstallManagerModule,
    skillInstallCandidatesModule,
    skillImportSourceModule,
  ] = await Promise.all([
    import(pathToFileURL(join(repoRoot, 'dist/src/utils/config.js')).href),
    import(
      pathToFileURL(join(repoRoot, 'dist/src/services/mcp/installManager.js'))
        .href
    ),
    import(
      pathToFileURL(join(repoRoot, 'dist/src/services/skills/installCandidates.js'))
        .href
    ),
    import(
      pathToFileURL(join(repoRoot, 'dist/src/services/skills/importSource.js'))
        .href
    ),
  ])

  configModule.enableConfigs()

  await mkdir(join(configHome, 'mcp', 'manifests'), { recursive: true })
  await writeFile(
    join(configHome, 'mcp', 'manifests', 'bad-mcp.json'),
    '{"schemaVersion":1,"name":"bad_mcp"}',
    'utf8',
  )

  const mcpSearch =
    await mcpInstallManagerModule.searchCcrMcpInstallCandidates()
  assert.equal(
    mcpSearch.sources.some(
      source => source.sourceType === 'remote-registry' && source.enabled === false,
    ),
    true,
  )
  assert.equal(
    mcpSearch.candidates.some(candidate => candidate.sourceType === 'remote-registry'),
    false,
  )
  assert.equal(
    mcpSearch.errors.some(error => error.originPath?.endsWith('bad-mcp.json')),
    true,
  )

  const skillSearch =
    await skillInstallCandidatesModule.searchSkillInstallCandidates({
      configHomeDir: configHome,
    })
  assert.equal(
    skillSearch.sources.some(source => source.sourceType === 'remote-registry'),
    false,
  )
  assert.equal(
    skillSearch.candidates.some(candidate => candidate.sourceType === 'remote-registry'),
    false,
  )
  assert.equal(skillSearch.errors.length, 0)

  const importSourceSchema =
    skillImportSourceModule.SkillImportSourceSchema()
  assert.equal(
    importSourceSchema.safeParse({
      kind: 'remote-registry',
      url: 'https://example.invalid/skills/index.json',
    }).success,
    false,
  )
  assert.equal(
    importSourceSchema.safeParse({
      kind: 'local-archive',
      path: '',
    }).success,
    false,
  )
} finally {
  await rm(configHome, { recursive: true, force: true })
}

console.log('smoke-skill-mcp-negative-boundaries: ok')
