import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [candidatesModule, plannerModule, managerModule, inspectorModule] =
  await Promise.all([
    import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installCandidates.js')).href),
    import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installPlanner.js')).href),
    import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installManager.js')).href),
    import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installInspector.js')).href),
  ])

const { searchSkillInstallCandidates } = candidatesModule
const { createSkillInstallPlan } = plannerModule
const { applySkillInstallPlan } = managerModule
const { inspectInstalledSkill } = inspectorModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-security-apply-inspect-'))
const configHome = join(root, 'ccr-home')

try {
  await createImportedSkill('high-risk-apply', {
    body: 'Use fetch("https://example.com") when needed.',
    script: 'fetch("https://example.com");\n',
  })
  const highRiskCandidate = await findCandidate('high-risk-apply')
  const blockedPlan = createSkillInstallPlan(highRiskCandidate, {
    configHomeDir: configHome,
  })
  assert.equal(blockedPlan.installable, false)
  assert.equal(blockedPlan.securityDecision.requiresOverride, true)
  await assert.rejects(() =>
    applySkillInstallPlan(blockedPlan, {
      confirmationToken: blockedPlan.confirmation.token,
      configHomeDir: configHome,
    }),
  )

  const installedResult = await applySkillInstallPlan(blockedPlan, {
    confirmationToken: blockedPlan.confirmation.token,
    securityOverrideToken: blockedPlan.securityDecision.overrideToken,
    configHomeDir: configHome,
    now: new Date('2026-06-03T00:00:00.000Z'),
  })
  assert.equal(installedResult.name, 'high-risk-apply')
  assert.equal(
    installedResult.warnings.some(warning => warning.includes('override')),
    true,
  )

  const installedInspection = await inspectInstalledSkill('high-risk-apply', {
    configHomeDir: configHome,
  })
  assert.equal(installedInspection.status, 'installed')
  assert.equal(installedInspection.securityReport.source, 'installed')
  assert.equal(installedInspection.securityReport.summary.highestSeverity, 'high')

  await writeFile(
    join(
      configHome,
      'skills',
      'packages',
      'high-risk-apply',
      'SKILL.md',
    ),
    `---\nname: high-risk-apply\ndescription: Drifted skill.\n---\n\nUse curl https://example.com after drift.\n`,
    'utf8',
  )
  const driftedInspection = await inspectInstalledSkill('high-risk-apply', {
    configHomeDir: configHome,
  })
  assert.equal(driftedInspection.status, 'drifted')
  assert.equal(driftedInspection.securityReport.source, 'drifted')
  assert.equal(driftedInspection.securityReport.summary.highestSeverity, 'high')

  await createImportedSkill('missing-package-skill', {
    body: 'Safe skill.',
  })
  const missingCandidate = await findCandidate('missing-package-skill')
  const missingPlan = createSkillInstallPlan(missingCandidate, {
    configHomeDir: configHome,
  })
  assert.equal(missingPlan.installable, true)
  await applySkillInstallPlan(missingPlan, {
    confirmationToken: missingPlan.confirmation.token,
    configHomeDir: configHome,
    now: new Date('2026-06-03T00:00:00.000Z'),
  })
  await rm(join(configHome, 'skills', 'packages', 'missing-package-skill'), {
    recursive: true,
    force: true,
  })
  const missingInspection = await inspectInstalledSkill('missing-package-skill', {
    configHomeDir: configHome,
  })
  assert.equal(missingInspection.status, 'missing-package')
  assert.equal(missingInspection.securityReport.summary.highestSeverity, 'high')
  assert.equal(
    missingInspection.securityReport.findings.some(
      finding => finding.ruleId === 'inspection.missing-package',
    ),
    true,
  )
} finally {
  await rm(root, { recursive: true, force: true })
}

async function findCandidate(name) {
  const result = await searchSkillInstallCandidates({
    query: name,
    configHomeDir: configHome,
  })
  const candidate = result.candidates.find(
    item => item.manifestInput.name === name,
  )
  assert.ok(candidate, `missing candidate for ${name}`)
  return candidate
}

async function createImportedSkill(name, input) {
  const skillDir = join(configHome, 'skills', 'imported', name)
  await mkdir(join(skillDir, 'scripts'), { recursive: true })
  await writeFile(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} apply inspect smoke.\n---\n\n${input.body}\n`,
    'utf8',
  )
  if (input.script) {
    await writeFile(join(skillDir, 'scripts', 'run.js'), input.script, 'utf8')
  }
}

console.log('smoke-skill-security-apply-inspect: ok')
