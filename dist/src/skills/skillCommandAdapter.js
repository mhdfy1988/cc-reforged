export function toPromptCommand(skillPackage, options) {
    return options.createSkillCommand({
        skillName: skillPackage.name,
        displayName: skillPackage.displayName,
        description: skillPackage.description,
        hasUserSpecifiedDescription: options.hasUserSpecifiedDescription ??
            hasUserSpecifiedDescription(skillPackage),
        markdownContent: skillPackage.body,
        allowedTools: skillPackage.invocation.allowedTools,
        argumentHint: skillPackage.invocation.argumentHint,
        argumentNames: skillPackage.invocation.argumentNames,
        whenToUse: skillPackage.invocation.whenToUse,
        version: options.version ?? getStringFrontmatter(skillPackage, 'version'),
        model: skillPackage.invocation.model,
        disableModelInvocation: !skillPackage.invocation.modelInvocable,
        userInvocable: skillPackage.invocation.userInvocable,
        source: options.source,
        baseDir: skillPackage.baseDir ?? undefined,
        loadedFrom: options.loadedFrom,
        hooks: options.hooks,
        executionContext: skillPackage.invocation.context === 'inline'
            ? undefined
            : skillPackage.invocation.context,
        agent: skillPackage.invocation.agent,
        paths: options.paths,
        effort: normalizeEffort(skillPackage.invocation.effort),
        shell: options.shell,
    });
}
function hasUserSpecifiedDescription(skillPackage) {
    return (typeof skillPackage.compatibility.rawFrontmatter.description === 'string' &&
        skillPackage.compatibility.rawFrontmatter.description.trim().length > 0);
}
function getStringFrontmatter(skillPackage, key) {
    const value = skillPackage.compatibility.rawFrontmatter[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
}
function normalizeEffort(effort) {
    if (effort === undefined) {
        return undefined;
    }
    return effort;
}
//# sourceMappingURL=skillCommandAdapter.js.map