export type RemoteSkillLoadTelemetry = {
  slug: string
  cacheHit: boolean
  latencyMs: number
  urlScheme: 'gs' | 'http' | 'https' | 's3'
  fileCount?: number
  totalBytes?: number
  fetchMethod?: string
  error?: string
}

export function logRemoteSkillLoaded(
  _event: RemoteSkillLoadTelemetry,
): void {}
