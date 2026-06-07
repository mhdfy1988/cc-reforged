import { ListResourcesResultSchema, ReadResourceResultSchema, } from '@modelcontextprotocol/sdk/types.js';
import { errorMessage } from '../utils/errors.js';
import { parseFrontmatter } from '../utils/frontmatterParser.js';
import { logMCPError } from '../utils/log.js';
import { getMCPSkillBuilders } from './mcpSkillBuilders.js';
class McpSkillCache {
    entries = new Map();
    get(key) {
        return this.entries.get(key);
    }
    set(key, value) {
        this.entries.set(key, value);
    }
    delete(serverName) {
        let deleted = false;
        const prefix = `${serverName}\0`;
        for (const key of this.entries.keys()) {
            if (key === serverName || key.startsWith(prefix)) {
                deleted = this.entries.delete(key) || deleted;
            }
        }
        diagnosticsByServer.delete(serverName);
        return deleted;
    }
    clear() {
        this.entries.clear();
        diagnosticsByServer.clear();
    }
}
const cache = new McpSkillCache();
const diagnosticsByServer = new Map();
export class McpSkillsUnavailableError extends Error {
    constructor(message = 'MCP server does not expose the Resources capability.') {
        super(message);
        this.name = 'McpSkillsUnavailableError';
    }
}
export const fetchMcpSkillsForClient = Object.assign(async (client) => {
    if (client.type !== 'connected' || !client.capabilities?.resources) {
        return [];
    }
    const cacheKey = getServerIdentityKey(client);
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const pending = discoverMcpSkills(client).catch(error => {
        cache.delete(client.name);
        throw error;
    });
    cache.set(cacheKey, pending);
    return pending;
}, { cache });
export const fetchMcpSkillsForClientSafely = Object.assign(async (client) => {
    try {
        return await fetchMcpSkillsForClient(client);
    }
    catch (error) {
        logMCPError(client.name, `MCP Skill discovery unavailable: ${errorMessage(error)}`);
        return [];
    }
}, { cache });
export function getMcpSkillDiscoveryDiagnostics(serverName) {
    if (serverName) {
        return [...(diagnosticsByServer.get(serverName) ?? [])];
    }
    return [...diagnosticsByServer.values()].flat();
}
async function discoverMcpSkills(client) {
    diagnosticsByServer.set(client.name, []);
    const resources = await listAllResources(client);
    const indexResource = resources.find(resource => resource.uri === 'skill://index.json');
    const entries = indexResource
        ? await readSkillIndex(client, indexResource.uri)
        : resources
            .filter(resource => isSkillMarkdownUri(resource.uri))
            .map(resource => ({
            name: skillNameFromUri(resource.uri),
            uri: resource.uri,
            ...(resource.description ? { description: resource.description } : {}),
        }));
    const commands = await Promise.all(entries.map(entry => readMcpSkillCommand(client, entry)));
    return commands.filter((command) => command !== null);
}
async function listAllResources(client) {
    const resources = [];
    let cursor;
    do {
        const result = await client.client.request({
            method: 'resources/list',
            ...(cursor ? { params: { cursor } } : {}),
        }, ListResourcesResultSchema);
        resources.push(...(result.resources ?? []));
        cursor = result.nextCursor;
    } while (cursor);
    return resources;
}
async function readSkillIndex(client, uri) {
    try {
        const text = await readTextResource(client, uri);
        const parsed = JSON.parse(text);
        if (!parsed ||
            typeof parsed !== 'object' ||
            !Array.isArray(parsed.skills)) {
            throw new Error('index must contain a skills array');
        }
        return parsed.skills
            .map(parseSkillIndexEntry)
            .filter((entry) => entry !== null);
    }
    catch (error) {
        recordDiagnostic(client.name, {
            serverName: client.name,
            code: 'mcp-skill-index-invalid',
            message: `Failed to read ${uri}: ${errorMessage(error)}`,
            uri,
        });
        throw new McpSkillsUnavailableError(`MCP Skill index from ${client.name} is invalid: ${errorMessage(error)}`);
    }
}
function parseSkillIndexEntry(value) {
    if (!value || typeof value !== 'object')
        return null;
    const record = value;
    if (typeof record.name !== 'string' || typeof record.uri !== 'string') {
        return null;
    }
    if (!isSkillMarkdownUri(record.uri))
        return null;
    return {
        name: record.name,
        uri: record.uri,
        ...(typeof record.description === 'string'
            ? { description: record.description }
            : {}),
        ...(typeof record.version === 'string' ? { version: record.version } : {}),
    };
}
async function readMcpSkillCommand(client, entry) {
    try {
        const markdown = await readTextResource(client, entry.uri);
        const { frontmatter, content } = parseFrontmatter(markdown, entry.uri);
        const builders = getMCPSkillBuilders();
        const parsed = builders.parseSkillFrontmatterFields(frontmatter, content, entry.name);
        const command = builders.createSkillCommand({
            skillName: entry.name,
            displayName: parsed.displayName,
            description: entry.description ?? parsed.description,
            hasUserSpecifiedDescription: entry.description !== undefined || parsed.hasUserSpecifiedDescription,
            markdownContent: content,
            allowedTools: parsed.allowedTools,
            argumentHint: parsed.argumentHint,
            argumentNames: parsed.argumentNames,
            whenToUse: parsed.whenToUse,
            version: entry.version ?? parsed.version,
            model: parsed.model,
            disableModelInvocation: parsed.disableModelInvocation,
            userInvocable: parsed.userInvocable,
            source: 'mcp',
            baseDir: undefined,
            loadedFrom: 'mcp',
            // Remote resources cannot register local hooks or shell behavior.
            hooks: undefined,
            executionContext: parsed.executionContext,
            agent: parsed.agent,
            paths: undefined,
            effort: parsed.effort,
            shell: undefined,
        });
        command.isMcp = true;
        command.mcpServerName = client.name;
        command.pluginId = client.config.pluginSource;
        command.mcpSkillUri = entry.uri;
        command.mcpSkillVersion = entry.version ?? parsed.version;
        return command;
    }
    catch (error) {
        recordDiagnostic(client.name, {
            serverName: client.name,
            code: 'mcp-skill-resource-read-failed',
            message: `Failed to load MCP Skill ${entry.name}: ${errorMessage(error)}`,
            uri: entry.uri,
        });
        logMCPError(client.name, `Failed to load MCP Skill ${entry.name}: ${errorMessage(error)}`);
        return null;
    }
}
async function readTextResource(client, uri) {
    const result = (await client.client.request({ method: 'resources/read', params: { uri } }, ReadResourceResultSchema));
    const text = result.contents
        .map(content => ('text' in content ? content.text : ''))
        .filter(Boolean)
        .join('\n');
    if (!text) {
        throw new Error('resource did not return text content');
    }
    return text;
}
function isSkillMarkdownUri(uri) {
    return uri.startsWith('skill://') && /\/SKILL\.md$/i.test(uri);
}
function skillNameFromUri(uri) {
    const path = uri.replace(/^skill:\/\//, '').replace(/\/SKILL\.md$/i, '');
    const parts = path.split('/').filter(Boolean);
    return decodeURIComponent(parts.at(-1) ?? 'mcp-skill');
}
function getServerIdentityKey(client) {
    const serverIdentity = client.serverInfo
        ? `${client.serverInfo.name}@${client.serverInfo.version}`
        : 'unknown-version';
    return `${client.name}\0${serverIdentity}`;
}
function recordDiagnostic(serverName, diagnostic) {
    const diagnostics = diagnosticsByServer.get(serverName) ?? [];
    diagnostics.push(diagnostic);
    diagnosticsByServer.set(serverName, diagnostics);
}
//# sourceMappingURL=mcpSkills.js.map