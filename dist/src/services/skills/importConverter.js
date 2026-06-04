import { basename } from 'path';
export function convertClaudeCommandToSkill(input) {
    const skillName = resolveCommandSkillName(input.commandPath, input.frontmatter);
    const description = typeof input.frontmatter.description === 'string' &&
        input.frontmatter.description.trim()
        ? input.frontmatter.description.trim()
        : extractDescriptionFallback(input.body, skillName);
    const frontmatter = {
        ...input.frontmatter,
        name: skillName,
        description,
        'user-invocable': input.frontmatter['user-invocable'] ?? 'true',
    };
    const notes = ['Claude command will be converted to SKILL.md.'];
    if (input.body.includes('$ARGUMENTS')) {
        notes.push('Command body references $ARGUMENTS; converted skill keeps it unchanged.');
    }
    return {
        skillName,
        frontmatter,
        body: input.body,
        markdownContent: renderSkillMarkdown(frontmatter, input.body),
        notes,
    };
}
function resolveCommandSkillName(commandPath, frontmatter) {
    if (typeof frontmatter.name === 'string' && frontmatter.name.trim()) {
        return frontmatter.name.trim();
    }
    return basename(commandPath).replace(/\.md$/i, '') || 'command-skill';
}
function extractDescriptionFallback(body, skillName) {
    const firstParagraph = body
        .split(/\r?\n\s*\r?\n/)
        .map(part => part.replace(/\s+/g, ' ').trim())
        .find(Boolean);
    if (!firstParagraph) {
        return `Converted Claude command ${skillName}.`;
    }
    return firstParagraph.length > 160
        ? `${firstParagraph.slice(0, 157).trimEnd()}...`
        : firstParagraph;
}
function renderSkillMarkdown(frontmatter, body) {
    return `---\n${renderFrontmatter(frontmatter)}---\n\n${body.trimStart()}`;
}
function renderFrontmatter(frontmatter) {
    return Object.entries(frontmatter)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => renderFrontmatterEntry(key, value))
        .join('');
}
function renderFrontmatterEntry(key, value) {
    if (Array.isArray(value)) {
        return `${key}:\n${value.map(item => `  - ${quoteYamlScalar(item)}`).join('\n')}\n`;
    }
    if (typeof value === 'object' && value !== null) {
        return `${key}: ${JSON.stringify(value)}\n`;
    }
    return `${key}: ${quoteYamlScalar(value)}\n`;
}
function quoteYamlScalar(value) {
    const text = String(value);
    return /^[A-Za-z0-9_.:/@ -]+$/.test(text) && !text.includes(': ')
        ? text
        : JSON.stringify(text);
}
//# sourceMappingURL=importConverter.js.map