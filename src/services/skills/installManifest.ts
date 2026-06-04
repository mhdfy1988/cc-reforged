import { z } from 'zod/v4'
import { CcrSkillPackageSchema } from '../../skills/packageSchema.js'
import { CCR_SKILL_ORIGIN_VENDORS } from '../../skills/sourceTypes.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const CcrSkillInstallScopeSchema = lazySchema(() =>
  z.enum(['user', 'project']),
)
export type CcrSkillInstallScope = z.infer<
  ReturnType<typeof CcrSkillInstallScopeSchema>
>

export const CcrSkillInstallSourceKindSchema = lazySchema(() =>
  z.enum(['imported-skill', 'local-manifest', 'builtin-preset']),
)
export type CcrSkillInstallSourceKind = z.infer<
  ReturnType<typeof CcrSkillInstallSourceKindSchema>
>

export const CcrSkillInstallSourceSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('imported-skill'),
      path: z.string().min(1),
      importMarkerPath: z.string().min(1).optional(),
    }),
    z.object({
      kind: z.literal('local-manifest'),
      path: z.string().min(1),
    }),
    z.object({
      kind: z.literal('builtin-preset'),
      presetId: z.string().min(1),
    }),
  ]),
)
export type CcrSkillInstallSource = z.infer<
  ReturnType<typeof CcrSkillInstallSourceSchema>
>

export const CcrSkillInstallDefaultsSchema = lazySchema(() =>
  z.object({
    enabled: z.boolean().default(true),
    modelInvocable: z.boolean().default(true),
    userInvocable: z.boolean().default(true),
  }),
)
export type CcrSkillInstallDefaults = z.infer<
  ReturnType<typeof CcrSkillInstallDefaultsSchema>
>

export const CcrSkillInstallTrustSchema = lazySchema(() =>
  z.object({
    thirdParty: z.boolean().default(true),
    executableContent: z.boolean().default(false),
    networkDeclared: z.boolean().default(false),
    secretsDeclared: z.array(z.string()).default([]),
  }),
)
export type CcrSkillInstallTrust = z.infer<
  ReturnType<typeof CcrSkillInstallTrustSchema>
>

export const CcrSkillInstallCompatibilitySchema = lazySchema(() =>
  z.object({
    vendor: z.enum(CCR_SKILL_ORIGIN_VENDORS).optional(),
    convertedFromCommand: z.boolean().default(false),
  }),
)
export type CcrSkillInstallCompatibility = z.infer<
  ReturnType<typeof CcrSkillInstallCompatibilitySchema>
>

export const CcrSkillInstallManifestSchema = lazySchema(() =>
  z.object({
    schemaVersion: z.literal(1),
    name: z.string().min(1),
    displayName: z.string().optional(),
    description: z.string().optional(),
    version: z.string().optional(),
    source: CcrSkillInstallSourceSchema(),
    targetScope: CcrSkillInstallScopeSchema().default('user'),
    defaults: CcrSkillInstallDefaultsSchema().default({
      enabled: true,
      modelInvocable: true,
      userInvocable: true,
    }),
    trust: CcrSkillInstallTrustSchema().default({
      thirdParty: true,
      executableContent: false,
      networkDeclared: false,
      secretsDeclared: [],
    }),
    compatibility: CcrSkillInstallCompatibilitySchema().optional(),
  }),
)
export type CcrSkillInstallManifest = z.infer<
  ReturnType<typeof CcrSkillInstallManifestSchema>
>
export type CcrSkillInstallManifestInput = z.input<
  ReturnType<typeof CcrSkillInstallManifestSchema>
>

export const CcrSkillPackageOwnerMarkerSchema = lazySchema(() =>
  z.object({
    schemaVersion: z.literal(1),
    packageId: z.string().min(1),
    name: z.string().min(1),
    installedAt: z.string().min(1),
    source: CcrSkillInstallSourceSchema(),
    owner: z.literal('ccr-skill-installer'),
  }),
)
export type CcrSkillPackageOwnerMarker = z.infer<
  ReturnType<typeof CcrSkillPackageOwnerMarkerSchema>
>
export type CcrSkillPackageOwnerMarkerInput = z.input<
  ReturnType<typeof CcrSkillPackageOwnerMarkerSchema>
>

export const CcrSkillInstalledRecordSchema = lazySchema(() =>
  z.object({
    schemaVersion: z.literal(1),
    name: z.string().min(1),
    scope: CcrSkillInstallScopeSchema(),
    installedAt: z.string().min(1),
    updatedAt: z.string().min(1),
    manifest: CcrSkillInstallManifestSchema(),
    packageDir: z.string().min(1),
    skillFilePath: z.string().min(1),
    packageOwnerMarkerPath: z.string().min(1),
    enabled: z.boolean(),
    modelInvocable: z.boolean(),
    userInvocable: z.boolean(),
    lockKey: z.string().min(1),
  }),
)
export type CcrSkillInstalledRecord = z.infer<
  ReturnType<typeof CcrSkillInstalledRecordSchema>
>
export type CcrSkillInstalledRecordInput = z.input<
  ReturnType<typeof CcrSkillInstalledRecordSchema>
>

export const CcrSkillInstalledIndexSchema = lazySchema(() =>
  z.object({
    schemaVersion: z.literal(1),
    installed: z.record(z.string(), CcrSkillInstalledRecordSchema()).default({}),
  }),
)
export type CcrSkillInstalledIndex = z.infer<
  ReturnType<typeof CcrSkillInstalledIndexSchema>
>
export type CcrSkillInstalledIndexInput = z.input<
  ReturnType<typeof CcrSkillInstalledIndexSchema>
>

export const CcrSkillChecksumSchema = lazySchema(() =>
  z.object({
    algorithm: z.literal('sha256'),
    skillMd: z.string().min(1),
    packageTree: z.string().min(1).optional(),
  }),
)
export type CcrSkillChecksum = z.infer<
  ReturnType<typeof CcrSkillChecksumSchema>
>

export const CcrSkillLockRecordSchema = lazySchema(() =>
  z.object({
    name: z.string().min(1),
    scope: CcrSkillInstallScopeSchema(),
    sourceKind: CcrSkillInstallSourceKindSchema(),
    packageDir: z.string().min(1),
    skillFilePath: z.string().min(1),
    checksum: CcrSkillChecksumSchema(),
    originVendor: z.enum(CCR_SKILL_ORIGIN_VENDORS),
    updatedAt: z.string().min(1),
  }),
)
export type CcrSkillLockRecord = z.infer<
  ReturnType<typeof CcrSkillLockRecordSchema>
>
export type CcrSkillLockRecordInput = z.input<
  ReturnType<typeof CcrSkillLockRecordSchema>
>

export const CcrSkillLockIndexSchema = lazySchema(() =>
  z.object({
    schemaVersion: z.literal(1),
    locks: z.record(z.string(), CcrSkillLockRecordSchema()).default({}),
  }),
)
export type CcrSkillLockIndex = z.infer<
  ReturnType<typeof CcrSkillLockIndexSchema>
>
export type CcrSkillLockIndexInput = z.input<
  ReturnType<typeof CcrSkillLockIndexSchema>
>

export const SkillInstallResultSchema = lazySchema(() =>
  z.object({
    schemaVersion: z.literal(1),
    name: z.string().min(1),
    scope: CcrSkillInstallScopeSchema(),
    packageDir: z.string().min(1),
    installedRecord: CcrSkillInstalledRecordSchema(),
    lockRecord: CcrSkillLockRecordSchema(),
    package: CcrSkillPackageSchema(),
    warnings: z.array(z.string()).default([]),
  }),
)
export type SkillInstallResult = z.infer<
  ReturnType<typeof SkillInstallResultSchema>
>
export type SkillInstallResultInput = z.input<
  ReturnType<typeof SkillInstallResultSchema>
>

export function createCcrSkillInstallManifest(
  input: Omit<CcrSkillInstallManifestInput, 'schemaVersion'> & {
    schemaVersion?: 1
  },
): CcrSkillInstallManifest {
  return CcrSkillInstallManifestSchema().parse({
    schemaVersion: 1,
    ...input,
  })
}

export function parseCcrSkillInstallManifest(
  input: CcrSkillInstallManifestInput,
): CcrSkillInstallManifest {
  return CcrSkillInstallManifestSchema().parse(input)
}

export function summarizeCcrSkillInstallManifest(
  manifest: CcrSkillInstallManifest,
): {
  schemaVersion: 1
  name: string
  kind: CcrSkillInstallSource['kind']
  targetScope: CcrSkillInstallScope
  enabled: boolean
  modelInvocable: boolean
  userInvocable: boolean
  originVendor: string | null
  convertedFromCommand: boolean
} {
  return {
    schemaVersion: manifest.schemaVersion,
    name: manifest.name,
    kind: manifest.source.kind,
    targetScope: manifest.targetScope,
    enabled: manifest.defaults.enabled,
    modelInvocable: manifest.defaults.modelInvocable,
    userInvocable: manifest.defaults.userInvocable,
    originVendor: manifest.compatibility?.vendor ?? null,
    convertedFromCommand: manifest.compatibility?.convertedFromCommand ?? false,
  }
}

export function parseCcrSkillPackageOwnerMarker(
  input: CcrSkillPackageOwnerMarkerInput,
): CcrSkillPackageOwnerMarker {
  return CcrSkillPackageOwnerMarkerSchema().parse(input)
}

export function parseCcrSkillInstalledRecord(
  input: CcrSkillInstalledRecordInput,
): CcrSkillInstalledRecord {
  return CcrSkillInstalledRecordSchema().parse(input)
}

export function parseCcrSkillInstalledIndex(
  input: CcrSkillInstalledIndexInput,
): CcrSkillInstalledIndex {
  return CcrSkillInstalledIndexSchema().parse(input)
}

export function parseCcrSkillLockRecord(
  input: CcrSkillLockRecordInput,
): CcrSkillLockRecord {
  return CcrSkillLockRecordSchema().parse(input)
}

export function parseCcrSkillLockIndex(
  input: CcrSkillLockIndexInput,
): CcrSkillLockIndex {
  return CcrSkillLockIndexSchema().parse(input)
}

export function parseSkillInstallResult(
  input: SkillInstallResultInput,
): SkillInstallResult {
  return SkillInstallResultSchema().parse(input)
}
