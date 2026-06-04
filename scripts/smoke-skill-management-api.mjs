import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const clientModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/app-server/client/index.js')).href
)

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-management-api-'))
const configHome = join(root, 'ccr-home')
const sourceSkill = join(root, 'api-source-skill')

try {
  await mkdir(sourceSkill, { recursive: true })
  await writeFile(
    join(sourceSkill, 'SKILL.md'),
    `---\nname: api-demo\ndescription: API management demo.\n---\n\nUse this skill for app-server API smoke.\n`,
    'utf8',
  )

  const managed = clientModule.startManagedStdioAppServerClient({
    defaultTimeoutMs: 15_000,
    process: {
      command: process.execPath,
      args: ['cli.js', 'app-server', '--listen', 'stdio'],
      cwd: repoRoot,
      env: {
        ...process.env,
        CCR_CONFIG_DIR: configHome,
        CLAUDE_CONFIG_DIR: configHome,
        DISABLE_TELEMETRY: '1',
        DISABLE_ERROR_REPORTING: '1',
        NODE_ENV: 'test',
      },
    },
  })

  try {
    const initialized = await managed.client.initialize({
      clientInfo: {
        name: 'smoke-skill-management-api',
        title: 'CCR Skill Management API Smoke',
      },
    })
    assert.equal(initialized.capabilities.skills, true)

    const importPlan = await managed.client.planSkillImport({
      source: {
        kind: 'local-skill-dir',
        path: sourceSkill,
      },
    })
    assert.equal(importPlan.importable, true)
    await managed.client.applySkillImport({
      source: importPlan.source,
      confirmed: true,
      confirmationToken: importPlan.confirmation.token,
    })

    const search = await managed.client.searchSkillInstalls({ query: 'api-demo' })
    const candidate = search.candidates.find(
      item => item.manifestInput?.name === 'api-demo',
    )
    assert.ok(candidate)
    const installPlan = await managed.client.planSkillInstall({
      manifest: candidate.manifestInput,
    })
    assert.equal(installPlan.installable, true)
    await managed.client.applySkillInstall({
      manifest: candidate.manifestInput,
      confirmed: true,
      confirmationToken: installPlan.confirmation.token,
    })

    await managed.client.setSkillEnabled({
      skillRef: 'api-demo',
      enabled: false,
    })
    await managed.client.setSkillInvocation({
      skillRef: 'api-demo',
      modelInvocable: false,
      userInvocable: false,
    })
    const list = await managed.client.listSkillInstalls()
    assert.equal(Array.isArray(list.runtimeDiagnostics), true)
    const installed = list.installed.find(item => item.name === 'api-demo')
    assert.equal(installed.installedRecord.enabled, false)
    assert.equal(installed.installedRecord.modelInvocable, false)
    assert.equal(installed.installedRecord.userInvocable, false)

    const saved = await managed.client.saveSkillInstallManifest({
      manifest: candidate.manifestInput,
      overwrite: true,
    })
    assert.equal(saved.saved, true)

    await managed.client.uninstallSkill({
      skillRef: 'api-demo',
      confirmed: true,
    })
    const afterUninstall = await managed.client.listSkillInstalls()
    assert.equal(
      afterUninstall.installed.some(item => item.name === 'api-demo'),
      false,
    )
  } finally {
    await managed.close()
  }
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('smoke-skill-management-api: ok')
