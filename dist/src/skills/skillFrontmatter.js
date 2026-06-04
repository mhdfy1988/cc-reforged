import { parseArgumentNames, } from '../utils/argumentSubstitution.js';
import { logForDebugging } from '../utils/debug.js';
import { EFFORT_LEVELS, parseEffortValue, } from '../utils/effort.js';
import { coerceDescriptionToString, parseBooleanFrontmatter, parseShellFrontmatter, splitPathInFrontmatter, } from '../utils/frontmatterParser.js';
import { extractDescriptionFromMarkdown, parseSlashCommandToolsFromFrontmatter, } from '../utils/markdownConfigLoader.js';
import { parseUserSpecifiedModel } from '../utils/model/model.js';
import { HooksSchema } from '../utils/settings/types.js';
/**
 * Parse and validate hooks from frontmatter.
 * Returns undefined if hooks are not defined or invalid.
 */
function parseHooksFromFrontmatter(frontmatter, skillName) {
    if (!frontmatter.hooks) {
        return undefined;
    }
    const result = HooksSchema().safeParse(frontmatter.hooks);
    if (!result.success) {
        logForDebugging(`Invalid hooks in skill '${skillName}': ${result.error.message}`);
        return undefined;
    }
    return result.data;
}
/**
 * Parse paths frontmatter from a skill, using the same format as CLAUDE.md rules.
 * Returns undefined if no paths are specified or if all patterns are match-all.
 */
export function parseSkillPaths(frontmatter) {
    if (!frontmatter.paths) {
        return undefined;
    }
    const patterns = splitPathInFrontmatter(frontmatter.paths)
        .map(pattern => {
        // Remove /** suffix - ignore library treats 'path' as matching both
        // the path itself and everything inside it.
        return pattern.endsWith('/**') ? pattern.slice(0, -3) : pattern;
    })
        .filter((p) => p.length > 0);
    // If all patterns are ** (match-all), treat as no paths (undefined).
    if (patterns.length === 0 || patterns.every((p) => p === '**')) {
        return undefined;
    }
    return patterns;
}
/**
 * Parses all skill frontmatter fields that are shared between file-based,
 * installed, and MCP skill loading. Caller supplies the resolved skill name and
 * the source/loadedFrom/baseDir/paths fields separately.
 */
export function parseSkillFrontmatterFields(frontmatter, markdownContent, resolvedName, descriptionFallbackLabel = 'Skill') {
    const validatedDescription = coerceDescriptionToString(frontmatter.description, resolvedName);
    const description = validatedDescription ??
        extractDescriptionFromMarkdown(markdownContent, descriptionFallbackLabel);
    const userInvocable = frontmatter['user-invocable'] === undefined
        ? true
        : parseBooleanFrontmatter(frontmatter['user-invocable']);
    const model = frontmatter.model === 'inherit'
        ? undefined
        : frontmatter.model
            ? parseUserSpecifiedModel(frontmatter.model)
            : undefined;
    const effortRaw = frontmatter['effort'];
    const effort = effortRaw !== undefined ? parseEffortValue(effortRaw) : undefined;
    if (effortRaw !== undefined && effort === undefined) {
        logForDebugging(`Skill ${resolvedName} has invalid effort '${effortRaw}'. Valid options: ${EFFORT_LEVELS.join(', ')} or an integer`);
    }
    return {
        displayName: frontmatter.name != null ? String(frontmatter.name) : undefined,
        description,
        hasUserSpecifiedDescription: validatedDescription !== null,
        allowedTools: parseSlashCommandToolsFromFrontmatter(frontmatter['allowed-tools']),
        argumentHint: frontmatter['argument-hint'] != null
            ? String(frontmatter['argument-hint'])
            : undefined,
        argumentNames: parseArgumentNames(frontmatter.arguments),
        whenToUse: frontmatter.when_to_use,
        version: frontmatter.version,
        model,
        disableModelInvocation: parseBooleanFrontmatter(frontmatter['disable-model-invocation']),
        userInvocable,
        hooks: parseHooksFromFrontmatter(frontmatter, resolvedName),
        executionContext: frontmatter.context === 'fork' ? 'fork' : undefined,
        agent: frontmatter.agent,
        effort,
        shell: parseShellFrontmatter(frontmatter.shell, resolvedName),
    };
}
//# sourceMappingURL=skillFrontmatter.js.map