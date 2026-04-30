export class AppServerClientError extends Error {
    kind;
    details;
    constructor(kind, message, details) {
        super(message);
        this.name = 'AppServerClientError';
        this.kind = kind;
        this.details = details;
    }
}
export function jsonRpcErrorToClientError(response) {
    const kind = response.error.data.kind === 'not_initialized'
        ? 'not_initialized'
        : 'server_error';
    return new AppServerClientError(kind, response.error.message, {
        code: response.error.code,
        kind: response.error.data.kind,
        details: response.error.data.details,
    });
}
//# sourceMappingURL=errors.js.map