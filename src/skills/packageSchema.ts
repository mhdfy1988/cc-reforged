import { z } from 'zod/v4'
import { lazySchema } from '../utils/lazySchema.js'
import type {
  CcrSkillPackage,
} from './model.js'
import {
  CCR_SKILL_ORIGIN_VENDORS,
  CCR_SKILL_SOURCES,
} from './sourceTypes.js'

const relativeSkillPathSchema = z
  .string()
  .min(1)
  .refine(value => !isEscapingRelativeSkillPath(value), {
    message: 'Skill resource path must stay inside the skill directory.',
  })

export const CcrSkillOriginSchema = lazySchema(() =>
  z.object({
    vendor: z.enum(CCR_SKILL_ORIGIN_VENDORS),
    sourcePath: z.string().nullable().default(null),
    importedFrom: z.string().optional(),
  }),
)

export type CcrSkillOriginInput = z.input<
  ReturnType<typeof CcrSkillOriginSchema>
>

export const CcrSkillResourcesSchema = lazySchema(() =>
  z.object({
    scripts: z.array(relativeSkillPathSchema).default([]),
    references: z.array(relativeSkillPathSchema).default([]),
    assets: z.array(relativeSkillPathSchema).default([]),
  }),
)

export type CcrSkillResourcesInput = z.input<
  ReturnType<typeof CcrSkillResourcesSchema>
>

export const CcrSkillInterfaceSchema = lazySchema(() =>
  z.object({
    shortDescription: z.string().optional(),
    iconSmall: relativeSkillPathSchema.optional(),
    iconLarge: relativeSkillPathSchema.optional(),
    brandColor: z.string().optional(),
    defaultPrompt: z.string().optional(),
  }),
)

export type CcrSkillInterfaceInput = z.input<
  ReturnType<typeof CcrSkillInterfaceSchema>
>

export const CcrSkillInvocationSchema = lazySchema(() =>
  z.object({
    modelInvocable: z.boolean().default(true),
    userInvocable: z.boolean().default(true),
    context: z.enum(['inline', 'fork']).default('inline'),
    allowedTools: z.array(z.string()).default([]),
    argumentHint: z.string().optional(),
    argumentNames: z.array(z.string()).default([]),
    model: z.string().optional(),
    effort: z.union([z.string(), z.number()]).optional(),
    agent: z.string().optional(),
    whenToUse: z.string().optional(),
  }),
)

export type CcrSkillInvocationInput = z.input<
  ReturnType<typeof CcrSkillInvocationSchema>
>

export const CcrSkillCompatibilitySchema = lazySchema(() =>
  z.object({
    rawFrontmatter: z.record(z.string(), z.unknown()).default({}),
    openaiYaml: z.record(z.string(), z.unknown()).optional(),
    warnings: z.array(z.string()).default([]),
  }),
)

export type CcrSkillCompatibilityInput = z.input<
  ReturnType<typeof CcrSkillCompatibilitySchema>
>

export const CcrSkillPackageSchema = lazySchema(() =>
  z.object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    name: z.string().min(1),
    displayName: z.string().optional(),
    description: z.string().min(1),
    bodyPath: z.string().nullable().default(null),
    body: z.string(),
    baseDir: z.string().nullable().default(null),
    source: z.enum(CCR_SKILL_SOURCES),
    origin: CcrSkillOriginSchema(),
    resources: CcrSkillResourcesSchema().default({
      scripts: [],
      references: [],
      assets: [],
    }),
    interface: CcrSkillInterfaceSchema().optional(),
    invocation: CcrSkillInvocationSchema().default({
      modelInvocable: true,
      userInvocable: true,
      context: 'inline',
      allowedTools: [],
      argumentNames: [],
    }),
    compatibility: CcrSkillCompatibilitySchema().default({
      rawFrontmatter: {},
      warnings: [],
    }),
  }),
)

export type CcrSkillPackageInput = z.input<
  ReturnType<typeof CcrSkillPackageSchema>
>

export function parseCcrSkillPackage(
  input: CcrSkillPackageInput,
): CcrSkillPackage {
  return CcrSkillPackageSchema().parse(input)
}

export function safeParseCcrSkillPackage(input: unknown):
  | { success: true; data: CcrSkillPackage }
  | { success: false; error: z.ZodError } {
  const result = CcrSkillPackageSchema().safeParse(input)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}

function isEscapingRelativeSkillPath(value: string): boolean {
  const normalized = value.replace(/\\/g, '/')
  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.includes('\0')
  ) {
    return true
  }

  const parts = normalized.split('/').filter(part => part.length > 0)
  let depth = 0
  for (const part of parts) {
    if (part === '.') {
      continue
    }
    if (part === '..') {
      depth -= 1
    } else {
      depth += 1
    }
    if (depth < 0) {
      return true
    }
  }
  return false
}
