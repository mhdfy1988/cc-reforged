import assert from 'node:assert/strict'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  createRuntimeSmokeEnv,
  importDist,
  installSkillFromSource,
  writeSourceSkill,
} from './smoke-skill-runtime-helpers.mjs'

const env = await createRuntimeSmokeEnv('ccr-skill-package-inspection-')

try {
  const [sharedInspection, inspector, runtimeLoader] = await Promise.all([
    importDist('src/services/skills/installedPackageInspection.js'),
    importDist('src/services/skills/installInspector.js'),
    importDist('src/skills/installedSkillLoader.js'),
  ])

  for (const spec of [
    { name: 'shared-ok' },
    { name: 'shared-disabled', enabled: false },
    { name: 'shared-drifted' },
    { name: 'shared-missing-package' },
  ]) {
    const sourceDir = await writeSourceSkill(env.root, spec.name)
    await installSkillFromSource({
      ...spec,
      sourceDir,
      configHome: env.configHome,
    })
  }

  await writeFile(
    join(env.configHome, 'skills', 'packages', 'shared-drifted', 'SKILL.md'),
    'changed\n',
    'utf8',
  )
  await rm(join(env.configHome, 'skills', 'packages', 'shared-missing-package'), {
    recursive: true,
    force: true,
  })

  const shared = await sharedInspection.listInstalledSkillPackageInspections({
    configHomeDir: env.configHome,
  })
  const managed = await inspector.listInstalledSkills({
    configHomeDir: env.configHome,
  })
  const runtime = await runtimeLoader.loadInstalledSkillRuntimePackages({
    configHomeDir: env.configHome,
  })

  assert.deepEqual(statusMap(managed.installed), statusMap(shared.installed))
  assert.deepEqual(statusMap(runtime.inspections), statusMap(shared.installed))
  assert.equal(shared.summary.installed, 1)
  assert.equal(shared.summary.disabled, 1)
  assert.equal(shared.summary.drifted, 1)
  assert.equal(shared.summary['missing-package'], 1)
  assert.equal(
    runtime.entries.some(entry => entry.package.name === 'shared-ok'),
    true,
  )
  assert.equal(
    runtime.entries.some(entry => entry.package.name === 'shared-disabled'),
    false,
  )
} finally {
  await env.cleanup()
}

function statusMap(inspections) {
  return Object.fromEntries(
    inspections
      .map(inspection => [inspection.name, inspection.status])
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

console.log('smoke-skill-installed-package-inspection: ok')
