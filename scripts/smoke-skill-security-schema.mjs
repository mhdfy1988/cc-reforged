import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const securityModule = await import(
  pathToFileURL(join(repoRoot, 'dist/src/services/skills/securitySchema.js')).href
)

const {
  SkillSecurityFindingSchema,
  SkillSecurityScanReportSchema,
  SkillSecurityPolicyDecisionSchema,
  createSkillSecurityFinding,
  createSkillSecurityPolicyDecision,
  createSkillSecurityScanReport,
  parseSkillSecurityFinding,
  parseSkillSecurityPolicyDecision,
  parseSkillSecurityScanReport,
  severityRank,
  summarizeSkillSecurityFindings,
} = securityModule

const lowFinding = createSkillSecurityFinding({
  id: 'finding:script-file',
  ruleId: 'resource.executable-extension',
  severity: 'low',
  category: 'executable-content',
  title: 'Executable file detected',
  message: 'The skill contains a JavaScript file.',
  filePath: 'D:/tmp/skill/scripts/run.js',
  relativePath: 'scripts/run.js',
  line: null,
  evidence: 'scripts/run.js',
  recommendation: 'Review the script before installing this skill.',
})
assert.equal(lowFinding.schemaVersion, 1)
assert.equal(lowFinding.relativePath, 'scripts/run.js')

const highFinding = createSkillSecurityFinding({
  id: 'finding:network',
  ruleId: 'script.network-access',
  severity: 'high',
  category: 'network-access',
  title: 'Network access detected',
  message: 'The script appears to call an external URL.',
  filePath: 'D:/tmp/skill/scripts/run.js',
  relativePath: 'scripts/run.js',
  line: 7,
  evidence: 'fetch("https://example.com")',
  recommendation: 'Require explicit override before installing.',
})

const criticalFinding = createSkillSecurityFinding({
  id: 'finding:path-escape',
  ruleId: 'resource.path-escape',
  severity: 'critical',
  category: 'path-escape',
  title: 'Path escape detected',
  message: 'A resource path points outside the skill package.',
  filePath: null,
  relativePath: null,
  line: null,
  evidence: null,
  recommendation: 'Reject this skill package.',
})

assert.equal(
  SkillSecurityFindingSchema().safeParse({
    ...lowFinding,
    severity: 'danger',
  }).success,
  false,
)
assert.throws(() =>
  parseSkillSecurityFinding({
    ...lowFinding,
    relativePath: '../outside.js',
  }),
)
assert.throws(() =>
  parseSkillSecurityFinding({
    ...lowFinding,
    evidence: 'x'.repeat(241),
  }),
)

const summary = summarizeSkillSecurityFindings([
  lowFinding,
  highFinding,
  criticalFinding,
])
assert.equal(summary.totalFindings, 3)
assert.equal(summary.highestSeverity, 'critical')
assert.equal(summary.bySeverity.low, 1)
assert.equal(summary.bySeverity.high, 1)
assert.equal(summary.bySeverity.critical, 1)
assert.equal(summary.byCategory['executable-content'], 1)
assert.equal(summary.byCategory['network-access'], 1)
assert.equal(summary.byCategory['path-escape'], 1)
assert.equal(severityRank('medium') > severityRank('low'), true)

const report = createSkillSecurityScanReport({
  packageId: 'user:demo-skill',
  skillName: 'demo-skill',
  scannedAt: '2026-06-03T00:00:00.000Z',
  packageDir: 'D:/tmp/skill',
  source: 'candidate',
  findings: [lowFinding, highFinding],
  scannedFiles: [
    {
      relativePath: 'SKILL.md',
      kind: 'skill-md',
      sizeBytes: 120,
      skipped: false,
    },
    {
      relativePath: 'scripts/run.js',
      kind: 'script',
      sizeBytes: 512,
      skipped: true,
      skipReason: 'file exceeds smoke limit',
    },
  ],
})
assert.equal(report.schemaVersion, 1)
assert.equal(report.summary.totalFindings, 2)
assert.equal(report.summary.highestSeverity, 'high')
assert.equal(report.scannedFiles[1].skipReason, 'file exceeds smoke limit')
assert.equal(
  SkillSecurityScanReportSchema().safeParse({
    ...report,
    source: 'runtime',
  }).success,
  false,
)
assert.throws(() =>
  parseSkillSecurityScanReport({
    ...report,
    scannedFiles: [
      {
        relativePath: 'assets/icon.png',
        kind: 'asset',
        sizeBytes: 12,
        skipped: true,
      },
    ],
  }),
)

const emptyReport = createSkillSecurityScanReport({
  packageId: 'user:clean-skill',
  skillName: 'clean-skill',
  scannedAt: '2026-06-03T00:00:00.000Z',
  packageDir: 'D:/tmp/clean-skill',
  source: 'installed',
})
assert.equal(emptyReport.summary.totalFindings, 0)
assert.equal(emptyReport.summary.highestSeverity, 'info')

const decision = createSkillSecurityPolicyDecision({
  installAllowed: false,
  action: 'block',
  requiresOverride: true,
  overrideToken: 'override-demo-token',
  reasons: ['High severity network access detected.'],
  report,
})
assert.equal(decision.action, 'block')
assert.equal(decision.requiresOverride, true)
assert.equal(
  parseSkillSecurityPolicyDecision(decision).overrideToken,
  'override-demo-token',
)
assert.equal(
  SkillSecurityPolicyDecisionSchema().safeParse({
    ...decision,
    requiresOverride: true,
    overrideToken: undefined,
  }).success,
  false,
)
assert.throws(() =>
  parseSkillSecurityPolicyDecision({
    ...decision,
    action: 'allow',
    installAllowed: false,
    requiresOverride: false,
    overrideToken: undefined,
  }),
)

console.log('smoke-skill-security-schema: ok')
