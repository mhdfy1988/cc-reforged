export type FileSuggestionCommandInput = {
  query: string
  [key: string]: unknown
}

export type FileSuggestion = {
  path: string
  score?: number
  [key: string]: unknown
}
