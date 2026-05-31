export function selectConfirmedProjectionBlock(blocks, item, predicate) {
    const identityIndex = item.identity?.contentIndex;
    const identityBlock = identityIndex !== undefined ? blocks[identityIndex] : undefined;
    if (identityIndex !== undefined && identityBlock && predicate(identityBlock)) {
        return {
            block: identityBlock,
            contentIndex: identityIndex,
        };
    }
    const primaryBlock = getJsonObject(item.metadata?.primaryBlock);
    if (primaryBlock && predicate(primaryBlock)) {
        return {
            block: primaryBlock,
            contentIndex: identityIndex ?? 0,
        };
    }
    if (blocks.length === 1 && predicate(blocks[0])) {
        return {
            block: blocks[0],
            contentIndex: identityIndex ?? 0,
        };
    }
    return null;
}
export function createProjectionIdentityFromItem(item, block, contentIndex) {
    const identity = {
        itemId: item.identity?.itemId ?? item.id,
        threadId: item.identity?.threadId,
        turnId: item.identity?.turnId,
        sourceIndex: item.identity?.sourceIndex,
        rawIndex: item.identity?.rawIndex,
        materializedIndex: item.identity?.materializedIndex,
        contentIndex: item.identity?.contentIndex ?? contentIndex,
        toolUseId: item.identity?.toolUseId,
        parentToolUseId: item.identity?.parentToolUseId,
        provider: getString(item.metadata, ['provider']),
        model: getString(item.metadata, ['model']),
        missingFields: [],
        raw: {
            item: item,
            block,
        },
    };
    identity.missingFields = ['threadId', 'turnId'].filter(field => !identity[field]);
    return identity;
}
function getJsonObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
function getString(object, keys) {
    if (!object) {
        return undefined;
    }
    for (const key of keys) {
        const value = object[key];
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }
    return undefined;
}
//# sourceMappingURL=threadDisplayProjectorFacts.js.map