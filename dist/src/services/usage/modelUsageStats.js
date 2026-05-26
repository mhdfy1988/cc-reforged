import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js';
const DEFAULT_DETAIL_LIMIT = 500;
function getModelUsageEventsDir() {
    return process.env.CCR_USAGE_EVENTS_DIR?.trim()
        ? process.env.CCR_USAGE_EVENTS_DIR.trim()
        : join(getClaudeConfigHomeDir(), 'usage-events');
}
export async function readModelUsageStats(input = {}) {
    const usageEventsDir = getModelUsageEventsDir();
    const now = new Date();
    const from = parseDate(input.from) ?? startOfMonth(now);
    const to = parseDate(input.to) ?? endOfDay(now);
    const files = await listUsageEventFiles(usageEventsDir, from, to);
    const diagnostics = [];
    const seenEventIds = new Set();
    const events = [];
    for (const file of files) {
        const content = await readFile(file, 'utf8').catch(() => '');
        const lines = content.split(/\r?\n/);
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) {
                return;
            }
            try {
                const parsed = JSON.parse(trimmed);
                if (!isModelUsageEvent(parsed)) {
                    throw new Error('invalid ModelUsageEvent shape');
                }
                if (seenEventIds.has(parsed.eventId)) {
                    return;
                }
                seenEventIds.add(parsed.eventId);
                const timestampMs = Date.parse(parsed.timestamp);
                if (!Number.isFinite(timestampMs)) {
                    throw new Error('invalid timestamp');
                }
                if (timestampMs < from.getTime() || timestampMs > to.getTime()) {
                    return;
                }
                if (!matchesFilters(parsed, input)) {
                    return;
                }
                events.push({ event: parsed, timestampMs });
            }
            catch (error) {
                diagnostics.push({
                    file,
                    line: index + 1,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        });
    }
    events.sort((left, right) => right.timestampMs - left.timestampMs);
    const todayStart = startOfDay(now).getTime();
    const todayEnd = endOfDay(now).getTime();
    const monthStart = startOfMonth(now).getTime();
    const monthEnd = endOfMonth(now).getTime();
    const limit = Math.max(1, input.limit ?? DEFAULT_DETAIL_LIMIT);
    return {
        usageEventsDir,
        from: from.toISOString(),
        to: to.toISOString(),
        generatedAt: now.toISOString(),
        filesRead: files,
        badLineCount: diagnostics.length,
        diagnostics,
        totals: buildGroup('all', '全部调用', events.map(item => item.event)),
        today: buildGroup('today', '今天', events
            .filter(item => item.timestampMs >= todayStart && item.timestampMs <= todayEnd)
            .map(item => item.event)),
        month: buildGroup('month', '本月', events
            .filter(item => item.timestampMs >= monthStart && item.timestampMs <= monthEnd)
            .map(item => item.event)),
        byProvider: groupBy(events, event => [
            event.provider,
            event.providerDisplayName ?? event.provider,
        ]),
        byProfile: groupBy(events, event => [
            event.profileId ?? 'unknown',
            event.profileName ?? event.profileId ?? '未知 profile',
        ]),
        byModel: groupBy(events, event => [event.model, event.model]),
        byProject: groupBy(events, event => [
            event.projectPath ?? event.cwd ?? 'unknown',
            event.projectPath ?? event.cwd ?? '未知项目',
        ]),
        events: events.slice(0, limit).map(item => toStatsEvent(item.event)),
    };
}
async function listUsageEventFiles(usageEventsDir, from, to) {
    const expectedMonths = new Set(monthKeysBetween(from, to));
    const names = await readdir(usageEventsDir).catch(() => []);
    return names
        .filter(name => expectedMonths.has(name.replace(/\.jsonl$/i, '')))
        .filter(name => /^\d{4}-\d{2}\.jsonl$/u.test(name))
        .map(name => join(usageEventsDir, name))
        .sort();
}
function monthKeysBetween(from, to) {
    const keys = [];
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    while (cursor.getTime() <= end.getTime()) {
        keys.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return keys;
}
function isModelUsageEvent(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const event = value;
    return (event.eventVersion === 1 &&
        typeof event.eventId === 'string' &&
        typeof event.timestamp === 'string' &&
        typeof event.provider === 'string' &&
        typeof event.model === 'string' &&
        typeof event.usage === 'object' &&
        event.usage !== null &&
        typeof event.contextBudget === 'object' &&
        event.contextBudget !== null &&
        (event.costStatus === 'calculated' || event.costStatus === 'unavailable'));
}
function matchesFilters(event, input) {
    return (matchesOptional(event.provider, input.provider) &&
        matchesOptional(event.profileId, input.profileId) &&
        matchesOptional(event.model, input.model) &&
        matchesOptional(event.projectPath ?? event.cwd, input.projectPath) &&
        matchesOptional(event.sessionId, input.sessionId) &&
        matchesOptional(event.threadId, input.threadId));
}
function matchesOptional(value, expected) {
    return !expected || value === expected;
}
function groupBy(events, getKey) {
    const groups = new Map();
    for (const { event } of events) {
        const [key, label] = getKey(event);
        const group = groups.get(key) ?? createEmptyGroup(key, label);
        addEventToGroup(group, event);
        groups.set(key, group);
    }
    return Array.from(groups.values()).sort((left, right) => right.totalTokens - left.totalTokens);
}
function buildGroup(key, label, events) {
    const group = createEmptyGroup(key, label);
    events.forEach(event => addEventToGroup(group, event));
    return group;
}
function createEmptyGroup(key, label) {
    return {
        key,
        label,
        eventCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        totalTokens: 0,
        knownCostUSD: 0,
        unknownCostEvents: 0,
    };
}
function addEventToGroup(group, event) {
    group.eventCount += 1;
    group.inputTokens += event.usage.inputTokens;
    group.outputTokens += event.usage.outputTokens;
    group.cacheReadInputTokens += event.usage.cacheReadInputTokens;
    group.cacheCreationInputTokens += event.usage.cacheCreationInputTokens;
    group.totalTokens += event.usage.totalTokens;
    if (event.costStatus === 'calculated' && typeof event.costUSD === 'number') {
        group.knownCostUSD += event.costUSD;
    }
    else {
        group.unknownCostEvents += 1;
    }
}
function toStatsEvent(event) {
    return {
        eventId: event.eventId,
        timestamp: event.timestamp,
        provider: event.provider,
        providerDisplayName: event.providerDisplayName,
        profileId: event.profileId,
        profileName: event.profileName,
        model: event.model,
        requestedModel: event.requestedModel,
        inputTokens: event.usage.inputTokens,
        outputTokens: event.usage.outputTokens,
        cacheReadInputTokens: event.usage.cacheReadInputTokens,
        cacheCreationInputTokens: event.usage.cacheCreationInputTokens,
        totalTokens: event.usage.totalTokens,
        costStatus: event.costStatus,
        costUSD: event.costUSD,
        costUnavailableReason: event.costUnavailableReason,
        requestId: event.requestId,
        sessionId: event.sessionId,
        threadId: event.threadId,
        turnId: event.turnId,
        cwd: event.cwd,
        projectPath: event.projectPath,
        source: event.source,
    };
}
function parseDate(value) {
    if (!value) {
        return undefined;
    }
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : undefined;
}
function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}
//# sourceMappingURL=modelUsageStats.js.map