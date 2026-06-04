import { z } from 'zod/v4';
import { CcrSkillPackageSchema } from '../../skills/packageSchema.js';
import { CCR_SKILL_ORIGIN_VENDORS } from '../../skills/sourceTypes.js';
import { lazySchema } from '../../utils/lazySchema.js';
export const SkillImportSourceKindSchema = lazySchema(() => z.enum([
    'local-skill-dir',
    'local-archive',
    'codex-skill-dir',
    'openclaw-skill-dir',
    'claude-command',
]));
export const SkillImportSourceSchema = lazySchema(() => z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('local-skill-dir'),
        path: z.string().min(1),
    }),
    z.object({
        kind: z.literal('local-archive'),
        path: z.string().min(1),
        extractedPath: z.string().min(1).optional(),
        archiveFormat: z.enum(['zip', 'tar', 'tgz']).optional(),
    }),
    z.object({
        kind: z.literal('codex-skill-dir'),
        path: z.string().min(1),
        openaiYamlPath: z.string().min(1).optional(),
    }),
    z.object({
        kind: z.literal('openclaw-skill-dir'),
        path: z.string().min(1),
    }),
    z.object({
        kind: z.literal('claude-command'),
        path: z.string().min(1),
    }),
]));
export const SkillImportCandidateStateSchema = lazySchema(() => z.enum(['available', 'invalid', 'duplicate-name', 'unsupported']));
export const SkillImportCandidateSchema = lazySchema(() => z.object({
    candidateId: z.string().min(1),
    source: SkillImportSourceSchema(),
    state: SkillImportCandidateStateSchema(),
    stateMessage: z.string().default(''),
    name: z.string().min(1),
    displayName: z.string().optional(),
    description: z.string().min(1),
    originVendor: z.enum(CCR_SKILL_ORIGIN_VENDORS),
    sourcePath: z.string().min(1),
    targetName: z.string().min(1),
    normalizedPreview: CcrSkillPackageSchema().optional(),
    warnings: z.array(z.string()).default([]),
}));
export const SkillImportWriteSchema = lazySchema(() => z.object({
    kind: z.enum(['skill-md', 'resource', 'import-marker']),
    fromPath: z.string().min(1).optional(),
    toPath: z.string().min(1),
    mode: z.enum(['copy', 'write', 'record']),
}));
export const SkillImportConflictSchema = lazySchema(() => z.object({
    kind: z.enum(['target-exists', 'name-conflict', 'source-duplicate']),
    message: z.string().min(1),
}));
export const SkillImportConversionSchema = lazySchema(() => z.object({
    required: z.boolean(),
    kind: z.enum(['none', 'claude-command-to-skill']),
    notes: z.array(z.string()).default([]),
}));
export const SkillImportPlanSchema = lazySchema(() => z.object({
    schemaVersion: z.literal(1),
    planId: z.string().min(1),
    candidateId: z.string().min(1),
    name: z.string().min(1),
    source: SkillImportSourceSchema(),
    originVendor: z.enum(CCR_SKILL_ORIGIN_VENDORS),
    targetDir: z.string().min(1),
    writes: z.array(SkillImportWriteSchema()),
    conversion: SkillImportConversionSchema(),
    conflicts: z.array(SkillImportConflictSchema()).default([]),
    risks: z.array(z.string()).default([]),
    importable: z.boolean().default(true),
    requiresConfirmation: z.literal(true),
    confirmation: z.object({
        token: z.string().min(1),
        message: z.string().min(1),
    }),
}));
export const CcrSkillImportMarkerSchema = lazySchema(() => z.object({
    schemaVersion: z.literal(1),
    name: z.string().min(1),
    importedAt: z.string().min(1),
    source: SkillImportSourceSchema(),
    sourcePath: z.string().min(1),
    originVendor: z.enum(CCR_SKILL_ORIGIN_VENDORS),
    converted: z.boolean(),
    originalCommandPath: z.string().min(1).optional(),
}));
export const SkillImportResultSchema = lazySchema(() => z.object({
    schemaVersion: z.literal(1),
    name: z.string().min(1),
    targetDir: z.string().min(1),
    skillFilePath: z.string().min(1),
    markerPath: z.string().min(1),
    package: CcrSkillPackageSchema(),
    warnings: z.array(z.string()).default([]),
}));
export function parseSkillImportSource(input) {
    return SkillImportSourceSchema().parse(input);
}
export function parseSkillImportCandidate(input) {
    return SkillImportCandidateSchema().parse(input);
}
export function parseSkillImportPlan(input) {
    return SkillImportPlanSchema().parse(input);
}
export function parseCcrSkillImportMarker(input) {
    return CcrSkillImportMarkerSchema().parse(input);
}
export function parseSkillImportResult(input) {
    return SkillImportResultSchema().parse(input);
}
//# sourceMappingURL=importSource.js.map