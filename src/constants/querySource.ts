// Query sources are used as opaque identifiers in caching, telemetry and
// routing. Keep the bridge permissive during recovery.
export type QuerySource = string

export const APP_SERVER_QUERY_SOURCE: QuerySource = 'repl_main_thread:app_server'

export function isMainThreadQuerySource(
  querySource: QuerySource | undefined,
): boolean {
  return typeof querySource === 'string' && querySource.startsWith('repl_main_thread')
}
