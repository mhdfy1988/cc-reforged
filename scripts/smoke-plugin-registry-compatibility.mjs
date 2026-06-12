import assert from 'node:assert/strict'
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { importDist } from './smoke-skill-runtime-helpers.mjs'

const root = await mkdtemp(join(tmpdir(), 'ccr-plugin-registry-compat-'))

try {
  const { readPluginRegistryV2ForWrite } = await importDist(
    'src/services/plugins/pluginRegistryCompatibility.js',
  )

  const v1Path = join(root, 'v1', 'installed_plugins.json')
  await writeJson(v1Path, {
    version: 1,
    plugins: {
      'legacy@market': {
        version: '1.2.3',
        installedAt: '2026-01-01T00:00:00.000Z',
        installPath: join(root, 'legacy-package'),
        gitCommitSha: 'abc123',
      },
    },
  })
  const migrated = await readPluginRegistryV2ForWrite(v1Path)
  assert.equal(migrated.version, 2)
  assert.deepEqual(migrated.plugins['legacy@market'], [
    {
      scope: 'user',
      installPath: join(root, 'legacy-package'),
      version: '1.2.3',
      installedAt: '2026-01-01T00:00:00.000Z',
      gitCommitSha: 'abc123',
    },
  ])
  assert.equal((await readJson(v1Path)).version, 2)

  const legacyDir = join(root, 'dual-file')
  const mainPath = join(legacyDir, 'installed_plugins.json')
  const legacyV2Path = join(legacyDir, 'installed_plugins_v2.json')
  await writeJson(legacyV2Path, {
    version: 2,
    plugins: {
      'dual@market': [
        {
          scope: 'project',
          projectPath: join(root, 'workspace'),
          installPath: join(root, 'dual-package'),
          version: '2.0.0',
        },
      ],
    },
  })
  const consolidated = await readPluginRegistryV2ForWrite(mainPath)
  assert.equal(consolidated.version, 2)
  assert.equal(consolidated.plugins['dual@market'][0].scope, 'project')
  assert.equal((await readJson(mainPath)).version, 2)
  await assert.rejects(access(legacyV2Path), { code: 'ENOENT' })

  const invalidPath = join(root, 'invalid', 'installed_plugins.json')
  await writeJson(invalidPath, { version: 3, plugins: {} })
  await assert.rejects(readPluginRegistryV2ForWrite(invalidPath))
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-plugin-registry-compatibility: ok')

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}
