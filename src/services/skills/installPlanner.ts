import { existsSync, readFileSync } from 'fs'
import {
  parseCcrSkillPackageOwnerMarker,
  summarizeCcrSkillInstallManifest,
  type CcrSkillInstallScope,
} from './installManifest.js'
import {
  getCcrSkillInstallPaths,
  getCcrSkillPackageDir,
  getCcrSkillPackageOwnerMarkerPath,
} from './installPaths.js'
import type { SkillInstallCandidate } from './installCandidates.js'
import { evaluateSkillSecurityPolicy } from './securityPolicy.js'
import type {
  SkillSecurityPolicyDecision,
  SkillSecurityScanReport,
} from './securitySchema.js'

export type SkillInstallPlan = {
  schemaVersion: 1
  planId: string
  name: string
  scope: CcrSkillInstallScope
  installable: boolean
  force: boolean
  manifest: ReturnType<typeof summarizeCcrSkillInstallManifest>
  manifestInput: SkillInstallCandidate['manifestInput']
  securityReport: SkillSecurityScanReport
  securityDecision: SkillSecurityPolicyDecision
  overrideRequired: boolean
  packagePreview: {
    name: string
    description: string
    originVendor: string
    resources: {
      scripts: number
      references: number
      assets: number
    }
  }
  writes: Array<{
    kind: 'package' | 'owner-marker' | 'installed-index' | 'lockfile'
    path: string
    mode: 'copy' | 'write' | 'record'
  }>
  conflicts: Array<{
    kind:
      | 'already-installed'
      | 'package-exists'
      | 'name-conflict'
      | 'security-blocked'
    message: string
  }>
  risks: string[]
  requiresConfirmation: true
  confirmation: {
    token: string
    message: string
  }
}

export function createSkillInstallPlan(
  candidate: SkillInstallCandidate,
  options: {
    configHomeDir?: string
    force?: boolean
    securityOverrideToken?: string
  } = {},
): SkillInstallPlan {
  const force = options.force ?? false
  const paths = getCcrSkillInstallPaths(options.configHomeDir)
  const packageDir = getCcrSkillPackageDir(
    candidate.manifestInput.name,
    options.configHomeDir,
  )
  const ownerMarkerPath = getCcrSkillPackageOwnerMarkerPath(
    candidate.manifestInput.name,
    options.configHomeDir,
  )
  const securityDecision = evaluateSkillSecurityPolicy(
    candidate.securityReport,
    {
      overrideToken: options.securityOverrideToken,
    },
  )
  const conflicts = [
    ...collectInstallConflicts({
      candidate,
      packageDir,
      ownerMarkerPath,
      force,
    }),
    ...collectSecurityConflicts(securityDecision),
  ]
  const installableState =
    candidate.state === 'available' ||
    (candidate.state === 'installed' && force)
  const installable =
    installableState &&
    conflicts.length === 0 &&
    securityDecision.installAllowed

  return {
    schemaVersion: 1,
    planId: `skill-install:${candidate.candidateId}`,
    name: candidate.manifestInput.name,
    scope: candidate.manifestInput.targetScope,
    installable,
    force,
    manifest: summarizeCcrSkillInstallManifest(candidate.manifestInput),
    manifestInput: candidate.manifestInput,
    securityReport: candidate.securityReport,
    securityDecision,
    overrideRequired: securityDecision.requiresOverride,
    packagePreview: {
      name: candidate.packagePreview.name,
      description: candidate.packagePreview.description,
      originVendor: candidate.packagePreview.origin.vendor,
      resources: {
        scripts: candidate.packagePreview.resources.scripts.length,
        references: candidate.packagePreview.resources.references.length,
        assets: candidate.packagePreview.resources.assets.length,
      },
    },
    writes: [
      {
        kind: 'package',
        path: packageDir,
        mode: 'copy',
      },
      {
        kind: 'owner-marker',
        path: ownerMarkerPath,
        mode: 'write',
      },
      {
        kind: 'installed-index',
        path: paths.installedIndexPath,
        mode: 'record',
      },
      {
        kind: 'lockfile',
        path: paths.lockFilePath,
        mode: 'record',
      },
    ],
    conflicts,
    risks: candidate.risks,
    requiresConfirmation: true,
    confirmation: {
      token: createInstallConfirmationToken(candidate.candidateId, packageDir),
      message: createConfirmationMessage({
        skillName: candidate.manifestInput.name,
        packageDir,
        securityDecision,
      }),
    },
  }
}

function collectInstallConflicts(input: {
  candidate: SkillInstallCandidate
  packageDir: string
  ownerMarkerPath: string
  force: boolean
}): SkillInstallPlan['conflicts'] {
  const conflicts: SkillInstallPlan['conflicts'] = []
  if (input.candidate.state === 'installed' && !input.force) {
    conflicts.push({
      kind: 'already-installed',
      message: `Skill ${input.candidate.manifestInput.name} 已安装。`,
    })
  }
  if (input.candidate.state === 'duplicate-name') {
    conflicts.push({
      kind: 'name-conflict',
      message: input.candidate.stateMessage,
    })
  }
  if (!existsSync(input.packageDir)) {
    return conflicts
  }

  const ownerMarker = readOwnerMarker(input.ownerMarkerPath)
  if (!ownerMarker) {
    conflicts.push({
      kind: 'package-exists',
      message: `目标 package 目录已存在且不是 CCR installer-owned：${input.packageDir}`,
    })
    return conflicts
  }
  if (!input.force) {
    conflicts.push({
      kind: 'package-exists',
      message: `目标 package 目录已存在：${input.packageDir}`,
    })
  }
  return conflicts
}

function collectSecurityConflicts(
  securityDecision: SkillSecurityPolicyDecision,
): SkillInstallPlan['conflicts'] {
  if (securityDecision.installAllowed) {
    return []
  }
  return [
    {
      kind: 'security-blocked',
      message: `安全策略阻断安装：${securityDecision.reasons.join('; ')}`,
    },
  ]
}

function readOwnerMarker(ownerMarkerPath: string): unknown {
  try {
    return parseCcrSkillPackageOwnerMarker(
      JSON.parse(readFileSync(ownerMarkerPath, 'utf8')),
    )
  } catch {
    return null
  }
}

function createInstallConfirmationToken(
  candidateId: string,
  packageDir: string,
): string {
  return Buffer.from(`${candidateId}\n${packageDir}`, 'utf8')
    .toString('base64url')
    .slice(0, 32)
}

function createConfirmationMessage(input: {
  skillName: string
  packageDir: string
  securityDecision: SkillSecurityPolicyDecision
}): string {
  const base = `确认安装 Skill ${input.skillName} 到 ${input.packageDir}`
  if (input.securityDecision.action === 'allow') {
    return base
  }
  return `${base}。安全策略：${input.securityDecision.action}，最高风险：${input.securityDecision.report.summary.highestSeverity}`
}
