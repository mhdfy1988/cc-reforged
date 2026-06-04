import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const clientModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/app-server/client/index.js')).href
)

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-end-to-end-'))
const configHome = join(root, 'ccr-home')
const sourceSkill = join(root, 'source-skill')

try {
  await mkdir(join(sourceSkill, 'references'), { recursive: true })
  await writeFile(
    join(sourceSkill, 'SKILL.md'),
    `---\nname: e2e-skill\ndescription: Skill end-to-end smoke.\nversion: 1.0.0\nuser-invocable: true\ndisable-model-invocation: false\npaths: references/**/*.md\n---\n\nUse this skill for App Server end-to-end smoke.\n`,
    'utf8',
  )
  await writeFile(
    join(sourceSkill, 'references', 'guide.md'),
    'End-to-end reference.\n',
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
        name: 'smoke-skill-end-to-end',
        title: 'CCR Skill End-to-End Smoke',
      },
    })
    assert.equal(initialized.capabilities.skills, true)

    const builtinSearch = await managed.client.searchSkillInstalls({
      query: 'skill-package',
    })
    const builtinPreset = builtinSearch.candidates.find(
      item =>
        item.sourceType === 'builtin-preset' &&
        item.manifestInput?.source?.presetId === 'skill-package-helper',
    )
    assert.ok(builtinPreset, 'builtin preset candidate should be searchable')
    assert.equal(builtinPreset.state, 'available')

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

    const search = await managed.client.searchSkillInstalls({
      query: 'e2e-skill',
    })
    const candidate = search.candidates.find(
      item =>
        item.sourceType === 'imported-skill' &&
        item.manifestInput?.name === 'e2e-skill',
    )
    assert.ok(candidate, 'imported skill candidate should be searchable')
    assert.equal(candidate.manifestInput.defaults.enabled, true)
    assert.equal(candidate.manifestInput.defaults.modelInvocable, true)
    assert.equal(candidate.manifestInput.defaults.userInvocable, true)

    const installPlan = await managed.client.planSkillInstall({
      manifest: candidate.manifestInput,
    })
    assert.equal(installPlan.installable, true)
    assert.equal(installPlan.securityReport.summary.highestSeverity, 'info')
    await managed.client.applySkillInstall({
      manifest: candidate.manifestInput,
      confirmed: true,
      confirmationToken: installPlan.confirmation.token,
    })

    const installedList = await managed.client.listSkillInstalls()
    assert.equal(Array.isArray(installedList.runtimeDiagnostics), true)
    const installed = findInstalled(installedList, 'e2e-skill')
    assert.equal(installed.status, 'installed')
    assert.equal(installed.installedRecord.enabled, true)
    assert.equal(installed.installedRecord.modelInvocable, true)
    assert.equal(installed.installedRecord.userInvocable, true)

    await managed.client.setSkillEnabled({
      skillRef: 'e2e-skill',
      enabled: false,
    })
    await managed.client.setSkillInvocation({
      skillRef: 'e2e-skill',
      modelInvocable: false,
      userInvocable: false,
    })
    const disabled = findInstalled(
      await managed.client.listSkillInstalls(),
      'e2e-skill',
    )
    assert.equal(disabled.installedRecord.enabled, false)
    assert.equal(disabled.installedRecord.modelInvocable, false)
    assert.equal(disabled.installedRecord.userInvocable, false)

    await managed.client.setSkillEnabled({
      skillRef: 'e2e-skill',
      enabled: true,
    })
    await managed.client.setSkillInvocation({
      skillRef: 'e2e-skill',
      modelInvocable: true,
      userInvocable: true,
    })
    const reenabled = findInstalled(
      await managed.client.listSkillInstalls(),
      'e2e-skill',
    )
    assert.equal(reenabled.installedRecord.enabled, true)
    assert.equal(reenabled.installedRecord.modelInvocable, true)
    assert.equal(reenabled.installedRecord.userInvocable, true)

    const saved = await managed.client.saveSkillInstallManifest({
      manifest: candidate.manifestInput,
      overwrite: true,
    })
    assert.equal(saved.saved, true)
    assert.equal(saved.name, 'e2e-skill')
    assert.equal(typeof saved.path, 'string')
    await access(saved.path)
    const localManifestSearch = await managed.client.searchSkillInstalls({
      query: 'e2e-skill',
    })
    assert.equal(
      localManifestSearch.candidates.some(
        item =>
          item.sourceType === 'local-manifest' &&
          item.manifestInput?.name === 'e2e-skill',
      ),
      true,
    )

    await rm(reenabled.installedRecord.packageDir, {
      recursive: true,
      force: true,
    })
    const broken = await managed.client.inspectSkill({
      skillRef: 'e2e-skill',
    })
    assert.equal(broken.found, true)
    assert.equal(broken.inspection.status, 'missing-package')

    const repaired = await managed.client.repairSkill({
      skillRef: 'e2e-skill',
      confirmed: true,
    })
    assert.equal(repaired.repaired, true)
    assert.equal(repaired.inspection.status, 'installed')

    const afterRepairSearch = await managed.client.searchSkillInstalls({
      query: 'e2e-skill',
    })
    const installedCandidate = afterRepairSearch.candidates.find(
      item => item.manifestInput?.name === 'e2e-skill',
    )
    assert.equal(installedCandidate.state, 'installed')

    await managed.client.uninstallSkill({
      skillRef: 'e2e-skill',
      confirmed: true,
    })
    const afterUninstall = await managed.client.listSkillInstalls()
    assert.equal(
      afterUninstall.installed.some(item => item.name === 'e2e-skill'),
      false,
    )
  } finally {
    await managed.close()
  }
} finally {
  await rm(root, { recursive: true, force: true })
}

function findInstalled(list, name) {
  const item = list.installed.find(entry => entry.name === name)
  assert.ok(item, `Expected installed skill: ${name}`)
  return item
}

console.log('smoke-skill-end-to-end: ok')
