import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { z } from 'zod/v4'
import {
  type SkillDiscoveryIndexEntry,
  type SkillDiscoverySearchResult,
} from '../../services/skillSearch/skillDiscoveryService.js'
import { recordDiscoveredSkill } from '../../skills/skillVisibilityLedger.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { DISCOVER_SKILLS_TOOL_NAME, getPrompt } from './prompt.js'

const DEFAULT_MAX_RESULTS = 6
const MAX_RESULTS_LIMIT = 20

export const inputSchema = lazySchema(() =>
  z.object({
    query: z
      .string()
      .describe(
        'Natural language task description or skill catalog query used to find relevant skills.',
      ),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(MAX_RESULTS_LIMIT)
      .optional()
      .default(DEFAULT_MAX_RESULTS)
      .describe('Maximum number of skills to return. Default 6, maximum 20.'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

export const outputSchema = lazySchema(() =>
  z.object({
    query: z.string(),
    matches: z.array(
      z.object({
        capability_id: z.string(),
        name: z.string(),
        display_name: z.string(),
        description: z.string(),
        source_kind: z.string(),
        parent_plugin_id: z.string().optional(),
        user_invocable: z.boolean(),
        model_invocable: z.boolean(),
        score: z.number().optional(),
        matched_fields: z.array(z.string()),
        reason: z.string().optional(),
      }),
    ),
    total_indexed_skills: z.number(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>
type OutputMatch = Output['matches'][number]

export const DiscoverSkillsTool = buildTool({
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  name: DISCOVER_SKILLS_TOOL_NAME,
  searchHint: 'find relevant workflow skills',
  maxResultSizeChars: 100_000,
  async description() {
    return getPrompt()
  },
  async prompt() {
    return getPrompt()
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  async call({ query, max_results }, context) {
    const normalizedQuery = query.trim()
    const limit = clampMaxResults(max_results)
    const { discoverRuntimeSkills } = await import(
      '../../services/skillSearch/prefetch.js'
    )
    const discovery = await discoverRuntimeSkills(normalizedQuery, context, {
      limit,
    })
    const matches = discovery.matches.map(searchResultToOutputMatch)

    for (const match of matches) {
      recordDiscoveredSkill(context, {
        name: match.name,
        capabilityId: match.capability_id,
      })
    }

    return {
      data: {
        query: normalizedQuery,
        matches,
        total_indexed_skills: discovery.totalIndexedSkills,
      },
    }
  },
  renderToolUseMessage() {
    return null
  },
  userFacingName: () => '',
  mapToolResultToToolResultBlockParam(
    content: Output,
    toolUseID: string,
  ): ToolResultBlockParam {
    if (content.matches.length === 0) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseID,
        content: `No relevant skills found for: ${content.query}`,
      }
    }

    const lines = content.matches.map(match => {
      const source = match.parent_plugin_id
        ? `${match.source_kind}/${match.parent_plugin_id}`
        : match.source_kind
      return `- ${match.name}: ${match.description || 'No description'} (source: ${source})`
    })
    return {
      type: 'tool_result',
      tool_use_id: toolUseID,
      content: `Relevant skills for: ${content.query}\n${lines.join('\n')}`,
    }
  },
} satisfies ToolDef<InputSchema, Output>)

function clampMaxResults(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_RESULTS
  return Math.max(1, Math.min(MAX_RESULTS_LIMIT, value))
}

function searchResultToOutputMatch(
  result: SkillDiscoverySearchResult,
): OutputMatch {
  return {
    ...entryToOutputMatch(result.entry),
    score: result.score,
    matched_fields: result.matchedFields,
    reason: result.reason,
  }
}

function entryToOutputMatch(entry: SkillDiscoveryIndexEntry): OutputMatch {
  return {
    capability_id: entry.capabilityId,
    name: entry.name,
    display_name: entry.displayName,
    description: entry.description,
    source_kind: entry.sourceKind,
    ...(entry.parentPluginId ? { parent_plugin_id: entry.parentPluginId } : {}),
    user_invocable: entry.userInvocable,
    model_invocable: entry.modelInvocable,
    matched_fields: [],
  }
}
