export type DiscoveredRemoteSkill = {
  slug: string
  url: string
  name?: string
  [key: string]: unknown
}

const discoveredRemoteSkills = new Map<string, DiscoveredRemoteSkill>()

export function isSkillSearchEnabled(): boolean {
  return process.env.USER_TYPE === 'ant'
}

export function stripCanonicalPrefix(name: string): string | null {
  const prefix = '_canonical_'
  return name.startsWith(prefix) ? name.slice(prefix.length) : null
}

export function getDiscoveredRemoteSkill(
  slug: string,
): DiscoveredRemoteSkill | undefined {
  return discoveredRemoteSkills.get(slug)
}

export function registerDiscoveredRemoteSkill(skill: DiscoveredRemoteSkill): void {
  discoveredRemoteSkills.set(skill.slug, skill)
}

export function clearDiscoveredRemoteSkills(): void {
  discoveredRemoteSkills.clear()
}
