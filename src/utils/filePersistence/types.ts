export type TurnStartTime = number

export type PersistedFile = {
  path: string
  relativePath: string
  fileId?: string
  sizeBytes?: number
}

export type FailedPersistence = {
  filename: string
  error: string
}

export type FilesPersistedEventData = {
  files: PersistedFile[]
  failed: FailedPersistence[]
}

export const DEFAULT_UPLOAD_CONCURRENCY = 4
export const FILE_COUNT_LIMIT = 1000
export const OUTPUTS_SUBDIR = 'outputs'
