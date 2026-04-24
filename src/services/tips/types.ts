export type TipContext = {
  bashTools?: Set<string>
  readFileState?: unknown
  [key: string]: unknown
}

export type Tip = {
  id: string
  content: string | (() => string | Promise<string>)
  cooldownSessions?: number
  isRelevant?: (context?: TipContext) => boolean | Promise<boolean>
  [key: string]: unknown
}
