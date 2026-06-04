import { basename } from 'path'
import type { FrontmatterData } from '../../utils/frontmatterParser.js'

export type ClaudeCommandConversionResult = {
  skillName: string
  markdownContent: string
  frontmatter: FrontmatterData
  body: string
  notes: string[]
}

export function convertClaudeCommandToSkill(input: {
  commandPath: string
  frontmatter: FrontmatterData
  body: string
}): ClaudeCommandConversionResult {
  const skillName = resolveCommandSkillName(input.commandPath, input.frontmatter)
  const description =
    typeof input.frontmatter.description === 'string' &&
    input.frontmatter.description.trim()
      ? input.frontmatter.description.trim()
      : extractDescriptionFallback(input.body, skillName)
  const frontmatter: FrontmatterData = {
    ...input.frontmatter,
    name: skillName,
    description,
    'user-invocable': input.frontmatter['user-invocable'] ?? 'true',
  }
  const notes: string[] = ['Claude command will be converted to SKILL.md.']
  if (input.body.includes('$ARGUMENTS')) {
    notes.push('Command body references $ARGUMENTS; converted skill keeps it unchanged.')
  }

  return {
    skillName,
    frontmatter,
    body: input.body,
    markdownContent: renderSkillMarkdown(frontmatter, input.body),
    notes,
  }
}

function resolveCommandSkillName(
  commandPath: string,
  frontmatter: FrontmatterData,
): string {
  if (typeof frontmatter.name === 'string' && frontmatter.name.trim()) {
    return frontmatter.name.trim()
  }
  return basename(commandPath).replace(/\.md$/i, '') || 'command-skill'
}

function extractDescriptionFallback(body: string, skillName: string): string {
  const firstParagraph = body
    .split(/\r?\n\s*\r?\n/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .find(Boolean)
  if (!firstParagraph) {
    return `Converted Claude command ${skillName}.`
  }
  return firstParagraph.length > 160
    ? `${firstParagraph.slice(0, 157).trimEnd()}...`
    : firstParagraph
}

function renderSkillMarkdown(frontmatter: FrontmatterData, body: string): string {
  return `---\n${renderFrontmatter(frontmatter)}---\n\n${body.trimStart()}`
}

function renderFrontmatter(frontmatter: FrontmatterData): string {
  return Object.entries(frontmatter)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => renderFrontmatterEntry(key, value))
    .join('')
}

function renderFrontmatterEntry(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    return `${key}:\n${value.map(item => `  - ${quoteYamlScalar(item)}`).join('\n')}\n`
  }
  if (typeof value === 'object' && value !== null) {
    return `${key}: ${JSON.stringify(value)}\n`
  }
  return `${key}: ${quoteYamlScalar(value)}\n`
}

function quoteYamlScalar(value: unknown): string {
  const text = String(value)
  return /^[A-Za-z0-9_.:/@ -]+$/.test(text) && !text.includes(': ')
    ? text
    : JSON.stringify(text)
}
