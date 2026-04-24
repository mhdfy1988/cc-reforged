// Content for the verify bundled skill.
// This recovery build keeps the bundle explicitly unavailable instead of
// relying on placeholder markdown files.

export const SKILL_MD: string =
  'verify bundled skill content is unavailable in this recovery build.'

export const SKILL_FILES: Record<string, string> = {}

export const SKILL_STATUS = {
  available: false,
  reason: 'bundled verify markdown assets are not restored yet',
} as const
