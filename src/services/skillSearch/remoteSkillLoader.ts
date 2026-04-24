import type { DiscoveredRemoteSkill } from './remoteSkillState.js'

export type RemoteSkillLoadResult = {
  cacheHit: boolean
  latencyMs: number
  skillPath: string
  content: string
  fileCount: number
  totalBytes: number
  fetchMethod: string
}

export async function loadRemoteSkill(
  slug: string,
  url: string,
): Promise<RemoteSkillLoadResult> {
  const skill: DiscoveredRemoteSkill = {
    slug,
    url,
  }
  void skill
  return {
    cacheHit: false,
    latencyMs: 0,
    skillPath: '',
    content: '',
    fileCount: 0,
    totalBytes: 0,
    fetchMethod: 'placeholder',
  }
}
