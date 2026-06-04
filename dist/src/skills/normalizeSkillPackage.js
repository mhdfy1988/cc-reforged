import { parseCcrSkillPackage, } from './packageSchema.js';
import { createSkillOrigin, normalizeOpenAiSkillInterface, } from './skillCompatibility.js';
import { normalizeSkillResources, } from './skillResourceScanner.js';
export function normalizeSkillPackage(input) {
    const rawFrontmatter = normalizeRawFrontmatter(input.frontmatter);
    const openaiInterface = normalizeOpenAiSkillInterface(input.openaiYaml);
    const skillInterface = mergeSkillInterface(openaiInterface, normalizeParsedInterface(input.parsed));
    const candidate = {
        schemaVersion: 1,
        id: input.id ?? createSkillPackageId(input),
        name: input.skillName,
        ...(input.parsed.displayName
            ? { displayName: input.parsed.displayName }
            : {}),
        description: input.parsed.description,
        bodyPath: input.filePath,
        body: input.markdownContent,
        baseDir: input.baseDir,
        source: input.source,
        origin: createSkillOrigin({
            source: input.source,
            sourcePath: input.filePath ?? input.baseDir,
            rawFrontmatter,
            openaiYaml: input.openaiYaml,
            compatibilityHints: input.compatibilityHints,
        }),
        resources: normalizeSkillResources(input.resources),
        ...(skillInterface ? { interface: skillInterface } : {}),
        invocation: {
            modelInvocable: !input.parsed.disableModelInvocation,
            userInvocable: input.parsed.userInvocable,
            context: input.parsed.executionContext ?? 'inline',
            allowedTools: input.parsed.allowedTools,
            ...(input.parsed.argumentHint
                ? { argumentHint: input.parsed.argumentHint }
                : {}),
            argumentNames: input.parsed.argumentNames,
            ...(input.parsed.model ? { model: input.parsed.model } : {}),
            ...(input.parsed.effort !== undefined
                ? { effort: input.parsed.effort }
                : {}),
            ...(input.parsed.agent ? { agent: input.parsed.agent } : {}),
            ...(input.parsed.whenToUse ? { whenToUse: input.parsed.whenToUse } : {}),
        },
        compatibility: {
            rawFrontmatter,
            ...(input.openaiYaml != null
                ? { openaiYaml: normalizeUnknownRecord(input.openaiYaml) }
                : {}),
            warnings: [],
        },
    };
    return parseCcrSkillPackage(candidate);
}
function createSkillPackageId(input) {
    return [input.source, input.skillName, input.filePath ?? input.baseDir ?? '']
        .filter(Boolean)
        .join(':');
}
function normalizeRawFrontmatter(frontmatter) {
    return normalizeUnknownRecord(frontmatter);
}
function normalizeUnknownRecord(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value)
        ? { ...value }
        : {};
}
function normalizeParsedInterface(parsed) {
    return parsed.displayName
        ? {
            shortDescription: parsed.description,
        }
        : undefined;
}
function mergeSkillInterface(primary, fallback) {
    if (!primary) {
        return fallback;
    }
    if (!fallback) {
        return primary;
    }
    return {
        ...fallback,
        ...primary,
    };
}
//# sourceMappingURL=normalizeSkillPackage.js.map