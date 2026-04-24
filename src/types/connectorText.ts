export type ConnectorTextBlock = {
  type?: string
  connector_text: string
  [key: string]: unknown
}

export type ConnectorTextDelta = {
  type: 'connector_text_delta'
  connector_text: string
}

export function isConnectorTextBlock(value: unknown): value is ConnectorTextBlock {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.connector_text === 'string'
}
