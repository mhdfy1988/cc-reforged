export function createServerLogger() {
    const noop = (..._args) => { };
    return {
        debug: noop,
        info: noop,
        warn: noop,
        error: noop,
        printBanner: noop,
    };
}
//# sourceMappingURL=serverLog.js.map