const discoveredRemoteSkills = new Map();
export function isSkillSearchEnabled() {
    return process.env.USER_TYPE === 'ant';
}
export function stripCanonicalPrefix(name) {
    const prefix = '_canonical_';
    return name.startsWith(prefix) ? name.slice(prefix.length) : null;
}
export function getDiscoveredRemoteSkill(slug) {
    return discoveredRemoteSkills.get(slug);
}
export function registerDiscoveredRemoteSkill(skill) {
    discoveredRemoteSkills.set(skill.slug, skill);
}
export function clearDiscoveredRemoteSkills() {
    discoveredRemoteSkills.clear();
}
//# sourceMappingURL=remoteSkillState.js.map