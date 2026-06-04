import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [candidatesModule, plannerModule, policyModule, schemaModule] =
  await Promise.all([
    import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installCandidates.js')).href),
    import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/installPlanner.js')).href),
    import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/securityPolicy.js')).href),
    import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/securitySchema.js')).href),
  ])

const { searchSkillInstallCandidates } = candidatesModule
const { createSkillInstallPlan } = plannerModule
const { evaluateSkillSecurityPolicy } = policyModule
const { createSkillSecurityFinding, createSkillSecurityScanReport } = schemaModule

const root = await mkdtemp(join(tmpdir(), 'ccr-skill-security-install-plan-'))
const configHome = join(root, 'ccr-home')

try {
  await createImportedSkill('high-risk', {
    body: 'Call fetch("https://example.com") and read process.env.API_KEY.',
    script: 'fetch("https://example.com");\n',
  })
  await createImportedSkill('medium-risk', {
    body: 'Review this helper.',
    script: 'console.log("helper");\n',
  })

  const result = await searchSkillInstallCandidates({ configHomeDir: configHome })
  const highRisk = result.candidates.find(
    candidate => candidate.manifestInput.name === 'high-risk',
  )
  assert.ok(highRisk)
  assert.equal(highRisk.securityReport.summary.highestSeverity, 'high')
  assert.equal(highRisk.risks.some(risk => risk.includes('high')), true)

  const blockedPlan = createSkillInstallPlan(highRisk, {
    configHomeDir: configHome,
  })
  assert.equal(blockedPlan.installable, false)
  assert.equal(blockedPlan.securityDecision.action, 'block')
  assert.equal(blockedPlan.overrideRequired, true)
  assert.equal(
    blockedPlan.conflicts.some(conflict => conflict.kind === 'security-blocked'),
    true,
  )
  assert.ok(blockedPlan.securityDecision.overrideToken)

  const overridePlan = createSkillInstallPlan(highRisk, {
    configHomeDir: configHome,
    securityOverrideToken: blockedPlan.securityDecision.overrideToken,
  })
  assert.equal(overridePlan.installable, true)
  assert.equal(overridePlan.securityDecision.action, 'require-confirmation')
  assert.equal(overridePlan.overrideRequired, false)

  const mediumRisk = result.candidates.find(
    candidate => candidate.manifestInput.name === 'medium-risk',
  )
  assert.ok(mediumRisk)
  assert.equal(mediumRisk.securityReport.summary.highestSeverity, 'medium')
  const mediumPlan = createSkillInstallPlan(mediumRisk, {
    configHomeDir: configHome,
  })
  assert.equal(mediumPlan.installable, true)
  assert.equal(mediumPlan.securityDecision.action, 'require-confirmation')
  assert.equal(mediumPlan.overrideRequired, false)

  const criticalReport = createSkillSecurityScanReport({
    packageId: 'candidate:critical',
    skillName: 'critical',
    scannedAt: '2026-06-03T00:00:00.000Z',
    packageDir: 'D:/tmp/critical',
    source: 'candidate',
    findings: [
      createSkillSecurityFinding({
        id: 'critical:path-escape',
        ruleId: 'resource.path-escape',
        severity: 'critical',
        category: 'path-escape',
        title: 'Path escape',
        message: 'Path escape detected.',
        filePath: null,
        relativePath: null,
        line: null,
        evidence: '../outside',
        recommendation: 'Reject this skill.',
      }),
    ],
  })
  const criticalDecision = evaluateSkillSecurityPolicy(criticalReport, {
    overrideToken: 'anything',
  })
  assert.equal(criticalDecision.installAllowed, false)
  assert.equal(criticalDecision.requiresOverride, false)
  assert.equal(criticalDecision.action, 'block')
} finally {
  await rm(root, { recursive: true, force: true })
}

async function createImportedSkill(name, input) {
  const skillDir = join(configHome, 'skills', 'imported', name)
  await mkdir(join(skillDir, 'scripts'), { recursive: true })
  await writeFile(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} security install plan smoke.\n---\n\n${input.body}\n`,
    'utf8',
  )
  await writeFile(join(skillDir, 'scripts', 'run.js'), input.script, 'utf8')
}

console.log('smoke-skill-security-install-plan: ok')
