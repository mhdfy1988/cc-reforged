/**
 * SDK utility types that are shared between the public SDK surface and the
 * internal recovery bridge.
 *
 * The original generated file set is missing from this snapshot, so we keep a
 * minimal handwritten definition here to restore the public import path used
 * by the SDK and usage-accounting code.
 */

export type UsageIteration = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
  server_tool_use?: {
    web_search_requests?: number | null
    web_fetch_requests?: number | null
  } | null
  service_tier?: string | null
  inference_geo?: string | null
  speed?: string | null
  [key: string]: unknown
}

export type NonNullableUsage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  server_tool_use: {
    web_search_requests: number
    web_fetch_requests: number
  }
  service_tier: string | null
  cache_creation?: {
    ephemeral_1h_input_tokens?: number
    ephemeral_5m_input_tokens?: number
    [key: string]: number | undefined
  }
  inference_geo: string | null
  iterations: UsageIteration[]
  speed: string | null
  [key: string]: unknown
}
