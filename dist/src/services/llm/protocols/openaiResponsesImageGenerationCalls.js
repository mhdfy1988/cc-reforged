export function collectOpenAiResponsesImageGenerationCalls(input) {
    const collector = createImageGenerationCallCollector();
    for (const item of input.raw?.output ?? []) {
        collector.add(item);
    }
    for (const event of input.events) {
        collector.add(event);
        const item = toRecord(event.item);
        if (item) {
            collector.add(item);
        }
        const response = toRecord(event.response);
        for (const outputItem of toRecordArray(response?.output)) {
            collector.add(outputItem);
        }
        for (const outputItem of toRecordArray(event.output)) {
            collector.add(outputItem);
        }
    }
    return collector.values();
}
function createImageGenerationCallCollector() {
    const calls = [];
    const indexByKey = new Map();
    return {
        add(value) {
            if (!value || value.type !== 'image_generation_call') {
                return;
            }
            const call = value;
            const key = getNonEmptyString(call.id) ?? getNonEmptyString(call.call_id);
            if (!key) {
                calls.push(call);
                return;
            }
            const existingIndex = indexByKey.get(key);
            if (existingIndex === undefined) {
                indexByKey.set(key, calls.length);
                calls.push(call);
                return;
            }
            const existing = calls[existingIndex];
            if (shouldReplaceImageGenerationCall(existing, call)) {
                calls[existingIndex] = call;
            }
        },
        values() {
            return calls;
        },
    };
}
function shouldReplaceImageGenerationCall(current, next) {
    const currentResult = getNonEmptyString(current.result);
    const nextResult = getNonEmptyString(next.result);
    if (!currentResult && nextResult) {
        return true;
    }
    if (currentResult && !nextResult) {
        return false;
    }
    const currentRank = getImageGenerationCallStatusRank(current.status);
    const nextRank = getImageGenerationCallStatusRank(next.status);
    if (nextRank !== currentRank) {
        return nextRank > currentRank;
    }
    return Object.keys(next).length > Object.keys(current).length;
}
function getImageGenerationCallStatusRank(status) {
    switch (status) {
        case 'completed':
        case 'succeeded':
            return 4;
        case 'generating':
            return 3;
        case 'in_progress':
            return 2;
        case 'queued':
            return 1;
        case 'failed':
        case 'cancelled':
            return 0;
        default:
            return -1;
    }
}
function toRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
function toRecordArray(value) {
    return Array.isArray(value)
        ? value
            .map(item => toRecord(item))
            .filter((item) => Boolean(item))
        : [];
}
function getNonEmptyString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
//# sourceMappingURL=openaiResponsesImageGenerationCalls.js.map