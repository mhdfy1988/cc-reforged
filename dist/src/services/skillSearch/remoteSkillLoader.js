export async function loadRemoteSkill(slug, url) {
    const skill = {
        slug,
        url,
    };
    void skill;
    return {
        cacheHit: false,
        latencyMs: 0,
        skillPath: '',
        content: '',
        fileCount: 0,
        totalBytes: 0,
        fetchMethod: 'placeholder',
    };
}
//# sourceMappingURL=remoteSkillLoader.js.map