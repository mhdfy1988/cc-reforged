export function isConnectorTextBlock(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const record = value;
    return typeof record.connector_text === 'string';
}
//# sourceMappingURL=connectorText.js.map