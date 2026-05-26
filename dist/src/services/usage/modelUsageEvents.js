import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js';
import { logError } from '../../utils/log.js';
export function createModelUsageEvent(input) {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const event = {
        eventVersion: 1,
        ...input,
        timestamp,
        eventId: input.eventId ?? createModelUsageEventId(input, timestamp),
    };
    validateModelUsageEvent(event);
    return event;
}
export function appendModelUsageEvent(input) {
    const event = createModelUsageEvent(input);
    const filePath = getModelUsageEventsFilePath(event.timestamp);
    try {
        mkdirSync(getModelUsageEventsDir(), { recursive: true });
        appendFileSync(filePath, `${JSON.stringify(event)}\n`, {
            encoding: 'utf8',
        });
        return { ok: true, event, filePath };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(new Error([
            'Failed to append ModelUsageEvent.',
            `path=${filePath}`,
            `provider=${event.provider}`,
            `profileId=${event.profileId ?? ''}`,
            `model=${event.model}`,
            `requestId=${event.requestId ?? ''}`,
            `sessionId=${event.sessionId ?? ''}`,
            `threadId=${event.threadId ?? ''}`,
            `turnId=${event.turnId ?? ''}`,
            `error=${message}`,
        ].join(' ')));
        return { ok: false, event, filePath, error: message };
    }
}
export function getModelUsageEventsDir() {
    return process.env.CCR_USAGE_EVENTS_DIR?.trim()
        ? process.env.CCR_USAGE_EVENTS_DIR.trim()
        : join(getClaudeConfigHomeDir(), 'usage-events');
}
export function getModelUsageEventsFilePath(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) {
        throw new Error(`Invalid ModelUsageEvent timestamp: ${timestamp}`);
    }
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return join(getModelUsageEventsDir(), `${year}-${month}.jsonl`);
}
export function createModelUsageEventId(input, timestamp = input.timestamp ?? new Date().toISOString()) {
    const usage = input.usage;
    const stableParts = input.requestId
        ? [
            input.requestId,
            input.provider,
            input.profileId ?? '',
            input.model,
            usage.inputTokens,
            usage.outputTokens,
            usage.cacheReadInputTokens,
            usage.cacheCreationInputTokens,
            input.costUSD ?? '',
        ]
        : [
            input.sessionId ?? '',
            input.threadId ?? '',
            input.turnId ?? '',
            timestamp,
            input.provider,
            input.model,
            usage.inputTokens,
            usage.outputTokens,
            input.costUSD ?? '',
        ];
    return createHash('sha256').update(stableParts.join('\u001f')).digest('hex');
}
function validateModelUsageEvent(event) {
    assertNonEmptyString(event.provider, 'provider');
    assertNonEmptyString(event.model, 'model');
    assertNonEmptyString(event.source, 'source');
    assertNonEmptyString(event.costStatus, 'costStatus');
    if (event.costUSD !== undefined) {
        assertFiniteNumber(event.costUSD, 'costUSD');
    }
    assertFiniteNumber(event.usage.inputTokens, 'usage.inputTokens');
    assertFiniteNumber(event.usage.outputTokens, 'usage.outputTokens');
    assertFiniteNumber(event.usage.cacheReadInputTokens, 'usage.cacheReadInputTokens');
    assertFiniteNumber(event.usage.cacheCreationInputTokens, 'usage.cacheCreationInputTokens');
    assertFiniteNumber(event.usage.totalTokens, 'usage.totalTokens');
    assertFiniteNumber(event.contextBudget.totalContextWindow, 'contextBudget.totalContextWindow');
    assertFiniteNumber(event.contextBudget.effectiveInputWindow, 'contextBudget.effectiveInputWindow');
}
function assertNonEmptyString(value, field) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`Invalid ModelUsageEvent ${field}.`);
    }
}
function assertFiniteNumber(value, field) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Invalid ModelUsageEvent ${field}.`);
    }
}
//# sourceMappingURL=modelUsageEvents.js.map