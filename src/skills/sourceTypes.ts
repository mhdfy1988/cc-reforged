export const CCR_SKILL_SOURCES = [
  'policy',
  'user',
  'project',
  'managed',
  'plugin',
  'bundled',
  'mcp',
  'imported',
  'legacy-command',
] as const

export type CcrSkillSource = (typeof CCR_SKILL_SOURCES)[number]

export const CCR_SKILL_ORIGIN_VENDORS = [
  'agent-skills',
  'claude',
  'codex',
  'openclaw',
  'ccr',
  'unknown',
] as const

export type CcrSkillOriginVendor = (typeof CCR_SKILL_ORIGIN_VENDORS)[number]

