export class CoreError extends Error {
    kind;
    details;
    constructor(kind, message, details) {
        super(message);
        this.name = 'CoreError';
        this.kind = kind;
        this.details = details;
    }
}
//# sourceMappingURL=errors.js.map