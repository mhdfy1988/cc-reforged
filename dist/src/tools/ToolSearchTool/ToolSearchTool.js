import memoize from 'lodash-es/memoize.js';
import { z } from 'zod/v4';
import { logEvent, } from '../../services/analytics/index.js';
import { getCcrToolAvailability, } from '../../services/tools/toolAvailability.js';
import { getCcrToolSearchCandidates } from '../../services/tools/toolSearchPolicy.js';
import { buildCcrToolRegistry } from '../../services/tools/toolRegistry.js';
import { buildTool, findToolByName, } from '../../Tool.js';
import { logForDebugging } from '../../utils/debug.js';
import { lazySchema } from '../../utils/lazySchema.js';
import { escapeRegExp } from '../../utils/stringUtils.js';
import { isToolSearchEnabledOptimistic } from '../../utils/toolSearch.js';
import { getPrompt, TOOL_SEARCH_TOOL_NAME } from './prompt.js';
export const inputSchema = lazySchema(() => z.object({
    query: z
        .string()
        .describe('Query to find deferred tools. Use "select:<tool_name>" for direct selection, or keywords to search.'),
    max_results: z
        .number()
        .optional()
        .default(5)
        .describe('Maximum number of results to return (default: 5)'),
}));
export const outputSchema = lazySchema(() => z.object({
    matches: z.array(z.string()),
    query: z.string(),
    total_deferred_tools: z.number(),
    match_details: z
        .array(z.object({
        name: z.string(),
        display_name: z.string(),
        category: z.string(),
        source: z.object({
            kind: z.string(),
            provider_id: z.string().optional(),
            server_id: z.string().optional(),
            server_name: z.string().optional(),
            tool_name: z.string().optional(),
            plugin_id: z.string().optional(),
        }),
        availability: z.object({
            available: z.boolean(),
            reason: z.string().optional(),
            message: z.string().optional(),
            mcp_state: z.string().optional(),
        }),
    }))
        .optional(),
    pending_mcp_servers: z.array(z.string()).optional(),
    unavailable_mcp_servers: z
        .array(z.object({
        name: z.string(),
        state: z.string(),
        reason: z.string().optional(),
    }))
        .optional(),
}));
// Track deferred tool names to detect when cache should be cleared
let cachedDeferredToolNames = null;
/**
 * Get a cache key representing the current set of deferred tools.
 */
function getDeferredToolsCacheKey(deferredTools) {
    return deferredTools
        .map(t => t.name)
        .sort()
        .join(',');
}
/**
 * Get tool description, memoized by tool name.
 * Used for keyword search scoring.
 */
const getToolDescriptionMemoized = memoize(async (toolName, tools) => {
    const tool = findToolByName(tools, toolName);
    if (!tool) {
        return '';
    }
    return tool.prompt({
        getToolPermissionContext: async () => ({
            mode: 'default',
            additionalWorkingDirectories: new Map(),
            alwaysAllowRules: {},
            alwaysDenyRules: {},
            alwaysAskRules: {},
            isBypassPermissionsModeAvailable: false,
        }),
        tools,
        agents: [],
    });
}, (toolName) => toolName);
/**
 * Invalidate the description cache if deferred tools have changed.
 */
function maybeInvalidateCache(deferredTools) {
    const currentKey = getDeferredToolsCacheKey(deferredTools);
    if (cachedDeferredToolNames !== currentKey) {
        logForDebugging(`ToolSearchTool: cache invalidated - deferred tools changed`);
        getToolDescriptionMemoized.cache.clear?.();
        cachedDeferredToolNames = currentKey;
    }
}
export function clearToolSearchDescriptionCache() {
    getToolDescriptionMemoized.cache.clear?.();
    cachedDeferredToolNames = null;
}
/**
 * Build the search result output structure.
 */
function buildSearchResult(matches, query, totalDeferredTools, pendingMcpServers, matchDetails, unavailableMcpServers) {
    return {
        data: {
            matches,
            query,
            total_deferred_tools: totalDeferredTools,
            ...(matchDetails && matchDetails.length > 0
                ? { match_details: matchDetails }
                : {}),
            ...(pendingMcpServers && pendingMcpServers.length > 0
                ? { pending_mcp_servers: pendingMcpServers }
                : {}),
            ...(unavailableMcpServers && unavailableMcpServers.length > 0
                ? { unavailable_mcp_servers: unavailableMcpServers }
                : {}),
        },
    };
}
/**
 * Parse tool name into searchable parts.
 * Handles both MCP tools (mcp__server__action) and regular tools (CamelCase).
 */
function parseToolName(name) {
    // Check if it's an MCP tool
    if (name.startsWith('mcp__')) {
        const withoutPrefix = name.replace(/^mcp__/, '').toLowerCase();
        const parts = withoutPrefix.split('__').flatMap(p => p.split('_'));
        return {
            parts: parts.filter(Boolean),
            full: withoutPrefix.replace(/__/g, ' ').replace(/_/g, ' '),
            isMcp: true,
        };
    }
    // Regular tool - split by CamelCase and underscores
    const parts = name
        .replace(/([a-z])([A-Z])/g, '$1 $2') // CamelCase to spaces
        .replace(/_/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    return {
        parts,
        full: parts.join(' '),
        isMcp: false,
    };
}
/**
 * Pre-compile word-boundary regexes for all search terms.
 * Called once per search instead of tools×terms×2 times.
 */
function compileTermPatterns(terms) {
    const patterns = new Map();
    for (const term of terms) {
        if (!patterns.has(term)) {
            patterns.set(term, new RegExp(`\\b${escapeRegExp(term)}\\b`));
        }
    }
    return patterns;
}
/**
 * Keyword-based search over tool names and descriptions.
 * Handles both MCP tools (mcp__server__action) and regular tools (CamelCase).
 *
 * The model typically queries with:
 * - Server names when it knows the integration (e.g., "slack", "github")
 * - Action words when looking for functionality (e.g., "read", "list", "create")
 * - Tool-specific terms (e.g., "notebook", "shell", "kill")
 */
async function searchToolsWithKeywords(query, searchableTools, tools, maxResults) {
    const queryLower = query.toLowerCase().trim();
    // Fast path: if query matches a tool name exactly, return it directly.
    // Handles models using a bare tool name instead of select: prefix (seen
    // from subagents/post-compaction). Only searchable deferred tools are
    // returned here; direct and internal tools are already visible through the
    // normal tool list and should not be rediscovered through ToolSearch.
    const exactMatch = searchableTools.find(t => t.name.toLowerCase() === queryLower);
    if (exactMatch) {
        return [exactMatch.name];
    }
    // If query looks like an MCP tool prefix (mcp__server), find matching tools.
    // Handles models searching by server name with mcp__ prefix.
    if (queryLower.startsWith('mcp__') && queryLower.length > 5) {
        const prefixMatches = searchableTools
            .filter(t => t.name.toLowerCase().startsWith(queryLower))
            .slice(0, maxResults)
            .map(t => t.name);
        if (prefixMatches.length > 0) {
            return prefixMatches;
        }
    }
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 0);
    // Partition into required (+prefixed) and optional terms
    const requiredTerms = [];
    const optionalTerms = [];
    for (const term of queryTerms) {
        if (term.startsWith('+') && term.length > 1) {
            requiredTerms.push(term.slice(1));
        }
        else {
            optionalTerms.push(term);
        }
    }
    const allScoringTerms = requiredTerms.length > 0 ? [...requiredTerms, ...optionalTerms] : queryTerms;
    const termPatterns = compileTermPatterns(allScoringTerms);
    // Pre-filter to tools matching ALL required terms in name or description
    let candidateTools = searchableTools;
    if (requiredTerms.length > 0) {
        const matches = await Promise.all(searchableTools.map(async (tool) => {
            const parsed = parseToolName(tool.name);
            const description = await getToolDescriptionMemoized(tool.name, tools);
            const descNormalized = description.toLowerCase();
            const hintNormalized = tool.searchHint?.toLowerCase() ?? '';
            const matchesAll = requiredTerms.every(term => {
                const pattern = termPatterns.get(term);
                return (parsed.parts.includes(term) ||
                    parsed.parts.some(part => part.includes(term)) ||
                    pattern.test(descNormalized) ||
                    (hintNormalized && pattern.test(hintNormalized)));
            });
            return matchesAll ? tool : null;
        }));
        candidateTools = matches.filter((t) => t !== null);
    }
    const scored = await Promise.all(candidateTools.map(async (tool) => {
        const parsed = parseToolName(tool.name);
        const description = await getToolDescriptionMemoized(tool.name, tools);
        const descNormalized = description.toLowerCase();
        const hintNormalized = tool.searchHint?.toLowerCase() ?? '';
        let score = 0;
        for (const term of allScoringTerms) {
            const pattern = termPatterns.get(term);
            // Exact part match (high weight for MCP server names, tool name parts)
            if (parsed.parts.includes(term)) {
                score += parsed.isMcp ? 12 : 10;
            }
            else if (parsed.parts.some(part => part.includes(term))) {
                score += parsed.isMcp ? 6 : 5;
            }
            // Full name fallback (for edge cases)
            if (parsed.full.includes(term) && score === 0) {
                score += 3;
            }
            // searchHint match — curated capability phrase, higher signal than prompt
            if (hintNormalized && pattern.test(hintNormalized)) {
                score += 4;
            }
            // Description match - use word boundary to avoid false positives
            if (pattern.test(descNormalized)) {
                score += 2;
            }
        }
        return { name: tool.name, score };
    }));
    return scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(item => item.name);
}
export const ToolSearchTool = buildTool({
    isEnabled() {
        return isToolSearchEnabledOptimistic();
    },
    isConcurrencySafe() {
        return true;
    },
    isReadOnly() {
        return true;
    },
    name: TOOL_SEARCH_TOOL_NAME,
    maxResultSizeChars: 100_000,
    async description() {
        return getPrompt();
    },
    async prompt() {
        return getPrompt();
    },
    get inputSchema() {
        return inputSchema();
    },
    get outputSchema() {
        return outputSchema();
    },
    async call(input, { options: { tools }, getAppState }) {
        const { query, max_results = 5 } = input;
        const appState = getAppState();
        const availabilityContext = getToolSearchAvailabilityContext(appState);
        const deferredTools = getCcrToolSearchCandidates(tools, availabilityContext);
        maybeInvalidateCache(deferredTools);
        // Check for MCP servers still connecting
        function getPendingServerNames() {
            const pending = appState.mcp.clients.filter(c => c.type === 'pending');
            return pending.length > 0 ? pending.map(s => s.name) : undefined;
        }
        function getUnavailableMcpServers() {
            const unavailable = appState.mcp.clients
                .filter(c => c.type !== 'connected' && c.type !== 'pending')
                .map(c => {
                const reason = mapMcpClientTypeToReason(c.type);
                return {
                    name: c.name,
                    state: c.type,
                    ...(reason ? { reason } : {}),
                };
            });
            return unavailable.length > 0 ? unavailable : undefined;
        }
        // Helper to log search outcome
        function logSearchOutcome(matches, queryType) {
            logEvent('tengu_tool_search_outcome', {
                query: query,
                queryType: queryType,
                matchCount: matches.length,
                totalDeferredTools: deferredTools.length,
                maxResults: max_results,
                hasMatches: matches.length > 0,
            });
        }
        // Check for select: prefix — direct tool selection.
        // Supports comma-separated multi-select: `select:A,B,C`.
        // Only return searchable deferred tools. Direct tools are already loaded;
        // internal/control plumbing must not leak through ToolSearch results.
        const selectMatch = query.match(/^select:(.+)$/i);
        if (selectMatch) {
            const requested = selectMatch[1]
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);
            const found = [];
            const missing = [];
            for (const toolName of requested) {
                const tool = findToolByName(deferredTools, toolName);
                if (tool) {
                    if (!found.includes(tool.name))
                        found.push(tool.name);
                }
                else {
                    missing.push(toolName);
                }
            }
            if (found.length === 0) {
                logForDebugging(`ToolSearchTool: select failed — none found: ${missing.join(', ')}`);
                logSearchOutcome([], 'select');
                const pendingServers = getPendingServerNames();
                return buildSearchResult([], query, deferredTools.length, pendingServers, undefined, getUnavailableMcpServers());
            }
            if (missing.length > 0) {
                logForDebugging(`ToolSearchTool: partial select — found: ${found.join(', ')}, missing: ${missing.join(', ')}`);
            }
            else {
                logForDebugging(`ToolSearchTool: selected ${found.join(', ')}`);
            }
            logSearchOutcome(found, 'select');
            return buildSearchResult(found, query, deferredTools.length, undefined, buildMatchDetails(found, tools, availabilityContext));
        }
        // Keyword search
        const matches = await searchToolsWithKeywords(query, deferredTools, tools, max_results);
        logForDebugging(`ToolSearchTool: keyword search for "${query}", found ${matches.length} matches`);
        logSearchOutcome(matches, 'keyword');
        // Include pending server info when search finds no matches
        if (matches.length === 0) {
            const pendingServers = getPendingServerNames();
            return buildSearchResult(matches, query, deferredTools.length, pendingServers, undefined, getUnavailableMcpServers());
        }
        return buildSearchResult(matches, query, deferredTools.length, undefined, buildMatchDetails(matches, tools, availabilityContext));
    },
    renderToolUseMessage() {
        return null;
    },
    userFacingName: () => '',
    /**
     * Returns a tool_result with tool_reference blocks.
     * This format works on 1P/Foundry. Bedrock/Vertex may not support
     * client-side tool_reference expansion yet.
     */
    mapToolResultToToolResultBlockParam(content, toolUseID) {
        if (content.matches.length === 0) {
            let text = 'No matching deferred tools found';
            if (content.pending_mcp_servers &&
                content.pending_mcp_servers.length > 0) {
                text += `. Some MCP servers are still connecting: ${content.pending_mcp_servers.join(', ')}. Their tools will become available shortly — try searching again.`;
            }
            if (content.unavailable_mcp_servers &&
                content.unavailable_mcp_servers.length > 0) {
                const details = content.unavailable_mcp_servers
                    .map(server => `${server.name}=${server.state}`)
                    .join(', ');
                text += `. Some MCP servers are unavailable: ${details}. Check MCP authentication or connection status.`;
            }
            return {
                type: 'tool_result',
                tool_use_id: toolUseID,
                content: text,
            };
        }
        return {
            type: 'tool_result',
            tool_use_id: toolUseID,
            content: content.matches.map(name => ({
                type: 'tool_reference',
                tool_name: name,
            })),
        };
    },
});
function getToolSearchAvailabilityContext(appState) {
    const mcpServerStatuses = {};
    for (const client of appState.mcp.clients) {
        if (isMcpServerAvailabilityState(client.type)) {
            mcpServerStatuses[client.name] = client.type;
        }
    }
    return Object.keys(mcpServerStatuses).length > 0
        ? { mcpServerStatuses }
        : {};
}
function isMcpServerAvailabilityState(value) {
    return (value === 'connected' ||
        value === 'failed' ||
        value === 'needs-auth' ||
        value === 'pending' ||
        value === 'disabled' ||
        value === 'discovery-failed' ||
        value === 'call-failed');
}
function buildMatchDetails(matches, tools, availabilityContext) {
    const registry = buildCcrToolRegistry(tools);
    return matches.flatMap(name => {
        const entry = registry.get(name);
        if (!entry) {
            return [];
        }
        const availability = getCcrToolAvailability(entry, availabilityContext);
        return [{
                name: entry.name,
                display_name: entry.displayName,
                category: entry.category,
                source: {
                    kind: entry.source.kind,
                    ...(entry.source.providerId
                        ? { provider_id: entry.source.providerId }
                        : {}),
                    ...(entry.source.serverId ? { server_id: entry.source.serverId } : {}),
                    ...(entry.source.serverName
                        ? { server_name: entry.source.serverName }
                        : {}),
                    ...(entry.source.toolName ? { tool_name: entry.source.toolName } : {}),
                    ...(entry.source.pluginId ? { plugin_id: entry.source.pluginId } : {}),
                },
                availability: {
                    available: availability.available,
                    ...(availability.reason ? { reason: availability.reason } : {}),
                    ...(availability.message ? { message: availability.message } : {}),
                    ...(availability.mcpState ? { mcp_state: availability.mcpState } : {}),
                },
            }];
    });
}
function mapMcpClientTypeToReason(type) {
    switch (type) {
        case 'needs-auth':
            return 'mcp_needs_auth';
        case 'failed':
            return 'mcp_connection_failed';
        case 'disabled':
            return 'mcp_disabled';
        default:
            return undefined;
    }
}
//# sourceMappingURL=ToolSearchTool.js.map