export const DISCOVER_SKILLS_TOOL_NAME = 'DiscoverSkills'

export function getPrompt(): string {
  return 'Search the local runtime Skill catalog for skills relevant to the current task. Use this when the static skill list is incomplete or when you need to find a skill by description before calling Skill.'
}
