import assert from 'node:assert/strict'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-local-archive-'))
const home = join(root, 'home')
const workspace = join(root, 'workspace')
const archivePath = join(root, 'bom-root-plugin.zip')

try {
  await Promise.all([
    mkdir(home, { recursive: true }),
    mkdir(workspace, { recursive: true }),
  ])

  await writeFile(
    archivePath,
    Buffer.from(
      zipSync({
        'plugin.json': strToU8(
          `\uFEFF${JSON.stringify(
            {
              name: 'bom-archive-plugin',
              version: '0.0.1',
              description: 'Local archive import smoke with BOM manifest.',
              skills: ['./skills/web-reading'],
              mcpServers: {
                web_reader_tools: {
                  type: 'stdio',
                  command: 'node',
                  args: ['./mcp/server.mjs'],
                },
              },
            },
            null,
            2,
          )}`,
        ),
        'skills/web-reading/SKILL.md': strToU8(`---
name: web-reading
description: Read web pages and summarize sources for archive import smoke.
---

# Web Reading

Use when a local archive Plugin needs to expose a Skill component.
`),
        'mcp/server.mjs': strToU8(`process.exit(0)\n`),
      }),
    ),
  )

  process.env.CCR_CONFIG_DIR = home
  const { enableConfigs } = await importDist('src/utils/config.js')
  enableConfigs()

  const { createPluginDomainSession } = await importDist(
    'src/services/plugins/pluginDomainSession.js',
  )
  const { PluginLocalImportService } = await importDist(
    'src/services/plugins/pluginLocalImportService.js',
  )

  const session = createPluginDomainSession({
    workspaceRoot: workspace,
    currentCwd: workspace,
    configHomeDir: home,
    runtimeInstanceId: 'archive-import-smoke',
    requestId: 'archive-import-smoke',
  })

  const result = await new PluginLocalImportService().importLocal(session, {
    path: archivePath,
    kind: 'archive',
    enableAfterInstall: true,
  })

  assert.equal(result.pluginId, 'bom-archive-plugin@local-import')
  assert.equal(result.operation.status, 'succeeded')
  assert.equal(result.operation.phase, 'completed')

  const installed = JSON.parse(
    await readFile(session.paths.installedRegistryPath, 'utf8'),
  )
  const installation = installed.plugins[result.pluginId]?.[0]
  assert.ok(installation)
  assert.equal(installation.scope, 'user')

  const canonicalManifestPath = join(
    installation.installPath,
    '.claude-plugin',
    'plugin.json',
  )
  const canonicalManifest = await readFile(canonicalManifestPath)
  assert.notEqual(canonicalManifest[0], 0xef)
  assert.equal(
    JSON.parse(canonicalManifest.toString('utf8')).name,
    'bom-archive-plugin',
  )

  const settings = JSON.parse(await readFile(join(home, 'settings.json'), 'utf8'))
  assert.equal(settings.enabledPlugins?.[result.pluginId], true)

  console.log('plugin local archive import smoke passed')
} finally {
  await rm(root, { recursive: true, force: true })
}
