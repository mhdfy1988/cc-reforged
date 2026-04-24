export type ServerLogger = {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  printBanner: (...args: unknown[]) => void
}

export function createServerLogger(): ServerLogger {
  const noop = (..._args: unknown[]): void => {}
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    printBanner: noop,
  }
}
