export {
  createSkillDiscoveryIndex,
  discoverSkills,
  isSkillCatalogQuery,
  searchSkillDiscoveryIndex,
  type SkillDiscoveryIndexEntry,
  type SkillDiscoveryResult,
  type SkillDiscoverySearchOptions,
  type SkillDiscoverySearchResult,
} from './skillDiscoveryService.js'

export function clearSkillIndexCache(): void {}
