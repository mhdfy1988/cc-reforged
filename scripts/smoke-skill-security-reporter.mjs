import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [schemaModule, policyModule, reporterModule] = await Promise.all([
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/securitySchema.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/securityPolicy.js')).href),
  import(pathToFileURL(join(repoRoot, 'dist/src/services/skills/securityReporter.js')).href),
])

const {
  createSkillSecurityFinding,
  createSkillSecurityScanReport,
} = schemaModule
const { evaluateSkillSecurityPolicy } = policyModule
const {
  formatSkillSecurityHeadline,
  summarizeSkillSecurityDecision,
  summarizeSkillSecurityReport,
} = reporterModule

const cleanReport = createSkillSecurityScanReport({
  packageId: 'candidate:clean',
  skillName: 'clean',
  scannedAt: '2026-06-03T00:00:00.000Z',
  packageDir: 'D:/tmp/clean',
  source: 'candidate',
})
const cleanDigest = summarizeSkillSecurityReport(cleanReport)
assert.equal(cleanDigest.action, 'scan-only')
assert.equal(cleanDigest.installAllowed, null)
assert.equal(cleanDigest.highestSeverity, 'info')
assert.equal(cleanDigest.headline, '安全扫描未发现风险：clean')
assert.equal(formatSkillSecurityHeadline(cleanReport), cleanDigest.headline)

const report = createSkillSecurityScanReport({
  packageId: 'candidate:risky',
  skillName: 'risky',
  scannedAt: '2026-06-03T00:00:00.000Z',
  packageDir: 'D:/tmp/risky',
  source: 'candidate',
  findings: [
    createSkillSecurityFinding({
      id: 'low:executable',
      ruleId: 'resource.executable-extension',
      severity: 'low',
      category: 'executable-content',
      title: 'Executable file',
      message: 'Executable file detected.',
      filePath: 'D:/tmp/risky/scripts/run.js',
      relativePath: 'scripts/run.js',
      line: null,
      evidence: 'scripts/run.js',
      recommendation: 'Review executable files.',
    }),
    createSkillSecurityFinding({
      id: 'high:network',
      ruleId: 'text.network-access',
      severity: 'high',
      category: 'network-access',
      title: 'Network access',
      message: 'Network access detected.',
      filePath: 'D:/tmp/risky/scripts/run.js',
      relativePath: 'scripts/run.js',
      line: 1,
      evidence: 'fetch("https://example.com")',
      recommendation: 'Require explicit review.',
    }),
  ],
})
const blockedDecision = evaluateSkillSecurityPolicy(report)
const blockedDigest = summarizeSkillSecurityDecision(blockedDecision)
assert.equal(blockedDigest.action, 'block')
assert.equal(blockedDigest.installAllowed, false)
assert.equal(blockedDigest.requiresOverride, true)
assert.equal(blockedDigest.highestSeverity, 'high')
assert.equal(blockedDigest.primaryFindings[0].severity, 'high')
assert.equal(blockedDigest.primaryFindings[0].category, 'network-access')
assert.equal(
  blockedDigest.headline,
  '安全扫描最高风险 high，共 2 项：需要显式 override',
)
assert.equal(formatSkillSecurityHeadline(blockedDigest), blockedDigest.headline)

const overrideDecision = evaluateSkillSecurityPolicy(report, {
  overrideToken: blockedDecision.overrideToken,
})
const overrideDigest = summarizeSkillSecurityDecision(overrideDecision)
assert.equal(overrideDigest.installAllowed, true)
assert.equal(overrideDigest.requiresOverride, false)
assert.equal(overrideDigest.action, 'require-confirmation')
assert.equal(overrideDigest.headline, '安全扫描最高风险 high，共 2 项：需要确认')

console.log('smoke-skill-security-reporter: ok')
