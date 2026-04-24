export function isSnipBoundaryMessage(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return record.subtype === 'snip_boundary' || record.type === 'snip_boundary';
}
export function projectView(value) {
    return value;
}
//# sourceMappingURL=snipProjection.js.map