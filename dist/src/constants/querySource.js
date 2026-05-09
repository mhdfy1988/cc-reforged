export const APP_SERVER_QUERY_SOURCE = 'repl_main_thread:app_server';
export function isMainThreadQuerySource(querySource) {
    return typeof querySource === 'string' && querySource.startsWith('repl_main_thread');
}
//# sourceMappingURL=querySource.js.map