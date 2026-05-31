import type {
  ThreadDisplayFileSnapshot,
  ThreadDisplayFileToolSnapshot,
  ThreadDisplayProjectedEvent,
  ThreadDisplayToolSnapshot,
} from './threadDisplayProjection.js'

type JsonObject = Record<string, unknown>
type FileSnapshotSource =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'MultiEdit'
  | 'Glob'
  | 'Grep'
  | 'MCP'
  | 'Browser'
  | 'UserUpload'
  | 'ModelOutput'
  | 'Unknown'
type PathSafety = 'workspace' | 'outside_workspace' | 'remote' | 'unknown'
type TextRangeSnapshot = {
  startLine?: number
  startColumn?: number
  endLine?: number
  endColumn?: number
}

export function extractFileDisplaySnapshotsFromToolSnapshot(
  snapshot: ThreadDisplayToolSnapshot,
): Pick<
  ThreadDisplayProjectedEvent,
  'fileToolSnapshot' | 'fileSnapshot' | 'referenceSnapshot'
> {
  const source = getFileSnapshotSource(snapshot.name)
  if (!source) {
    return {}
  }
  const fileToolSnapshot = extractFileToolSnapshot(snapshot, source)
  if (source === 'Glob' || source === 'Grep') {
    return {
      fileToolSnapshot,
      ...extractSearchReferenceSnapshot(snapshot, source),
    }
  }
  const path = getPrimaryFilePath(snapshot)
  if (!path) {
    return { fileToolSnapshot }
  }
  return {
    fileToolSnapshot,
    fileSnapshot: {
      id: createSnapshotId(snapshot.id, 'file', path),
      source,
      kind: getFileSnapshotKind(source),
      path,
      ...getPathFields(path),
      range: getTextRange(snapshot),
      toolUseId: snapshot.identity?.toolUseId,
      identity: snapshot.identity,
      raw: {
        input: snapshot.input,
        result: snapshot.result,
      },
    },
  }
}

function getFileSnapshotSource(name: string): FileSnapshotSource | null {
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'Glob':
    case 'Grep':
      return name
    case 'NotebookEdit':
      return 'Edit'
    default:
      return null
  }
}

function extractFileToolSnapshot(
  snapshot: ThreadDisplayToolSnapshot,
  source: FileSnapshotSource,
): ThreadDisplayFileToolSnapshot {
  const path = getPrimaryFilePath(snapshot) ?? getSearchPath(snapshot)
  const pathFields = path ? getPathFields(path) : { safety: 'unknown' as const }
  const operation = getFileToolOperation(snapshot.name, source)
  return {
    id: `${snapshot.id}:file-tool`,
    source,
    operation,
    status: snapshot.status,
    summary: getFileToolSummary(operation, snapshot.status, path),
    path,
    ...pathFields,
    range: getTextRange(snapshot),
    diff: getFileToolDiff(snapshot),
    resultText: getFileToolResultText(snapshot.result),
    errorClass: snapshot.errorClass,
    actions: getFileToolActions(pathFields.safety, operation, path),
    toolUseId: snapshot.identity?.toolUseId,
    identity: snapshot.identity,
    raw: {
      input: snapshot.input,
      result: snapshot.result,
    },
  }
}

function extractSearchReferenceSnapshot(
  snapshot: ThreadDisplayToolSnapshot,
  source: 'Glob' | 'Grep',
): Pick<ThreadDisplayProjectedEvent, 'referenceSnapshot'> {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  const filenames = getStringArray(result, ['filenames'])
  const path =
    filenames[0] ??
    getString(input, ['path']) ??
    getString(input, ['glob']) ??
    getString(input, ['pattern'])
  return path
    ? {
        referenceSnapshot: {
          id: createSnapshotId(snapshot.id, 'reference', path),
          source,
          kind: source === 'Grep' ? 'search_match' : 'file',
          label: source === 'Grep' ? getString(input, ['pattern']) : undefined,
          path,
          ...getPathFields(path),
          range: getTextRange(snapshot),
          excerpt: getString(result, ['content']),
          toolUseId: snapshot.identity?.toolUseId,
          identity: snapshot.identity,
          raw: {
            input: snapshot.input,
            result: snapshot.result,
          },
        },
      }
    : {}
}

function getFileSnapshotKind(
  source: FileSnapshotSource,
): ThreadDisplayFileSnapshot['kind'] {
  if (source === 'Read') {
    return 'read_file'
  }
  if (source === 'Edit' || source === 'MultiEdit') {
    return 'edited_file'
  }
  if (source === 'Write') {
    return 'generated_file'
  }
  return 'reference'
}

function getFileToolOperation(
  name: string,
  source: FileSnapshotSource,
): ThreadDisplayFileToolSnapshot['operation'] {
  if (source === 'Read') {
    return 'read'
  }
  if (source === 'Write') {
    return 'write'
  }
  if (name === 'NotebookEdit') {
    return 'notebook_edit'
  }
  if (source === 'Edit' || source === 'MultiEdit') {
    return 'edit'
  }
  if (source === 'Glob' || source === 'Grep') {
    return 'search'
  }
  return 'unknown'
}

function getFileToolSummary(
  operation: ThreadDisplayFileToolSnapshot['operation'],
  status: string,
  path: string | undefined,
): string {
  const target = path ?? '未知路径'
  if (isFailureStatus(status)) {
    return `${getFileOperationText(operation)}失败：${target}`
  }
  if (['running', 'streaming', 'pending', 'waiting_permission'].includes(status)) {
    return `正在${getFileOperationText(operation)}：${target}`
  }
  return `${getFileOperationText(operation)}：${target}`
}

function isFailureStatus(statusText: string): boolean {
  const normalized = statusText.toLowerCase()
  return [
    'failed',
    'error',
    'timeout',
    'interrupted',
    'cancelled',
    'canceled',
    'denied',
  ].includes(normalized)
}

function getFileOperationText(
  operation: ThreadDisplayFileToolSnapshot['operation'],
): string {
  switch (operation) {
    case 'read':
      return '读取文件'
    case 'write':
      return '写入文件'
    case 'edit':
      return '编辑文件'
    case 'notebook_edit':
      return '编辑 Notebook'
    case 'search':
      return '搜索文件'
    default:
      return '文件操作'
  }
}

function getPrimaryFilePath(
  snapshot: ThreadDisplayToolSnapshot,
): string | undefined {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  return (
    getString(input, ['file_path', 'filePath', 'path']) ??
    getString(input, ['notebook_path', 'notebookPath']) ??
    getString(result, ['filePath', 'path']) ??
    getString(result, ['notebookPath', 'notebook_path']) ??
    getString(getJsonObject(result?.file), ['filePath', 'path'])
  )
}

function getSearchPath(snapshot: ThreadDisplayToolSnapshot): string | undefined {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  const filenames = getStringArray(result, ['filenames'])
  return (
    filenames[0] ??
    getString(input, ['path']) ??
    getString(input, ['glob']) ??
    getString(input, ['pattern'])
  )
}

function getTextRange(
  snapshot: ThreadDisplayToolSnapshot,
): TextRangeSnapshot | undefined {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  const startLine = getNumber(result, ['startLine']) ?? getNumber(input, ['offset'])
  const startColumn = getNumber(result, ['startColumn'])
  const endLine =
    getNumber(result, ['endLine']) ??
    inferEndLine(startLine, getNumber(result, ['numLines']))
  const endColumn = getNumber(result, ['endColumn'])
  const range = { startLine, startColumn, endLine, endColumn }
  return Object.values(range).some(value => value !== undefined) ? range : undefined
}

function inferEndLine(
  startLine: number | undefined,
  numLines: number | undefined,
): number | undefined {
  return startLine === undefined || numLines === undefined || numLines <= 0
    ? undefined
    : startLine + numLines - 1
}

function getFileToolDiff(snapshot: ThreadDisplayToolSnapshot): unknown {
  const input = getJsonObject(snapshot.input)
  const result = getJsonObject(snapshot.result)
  if (result && ('diff' in result || 'edits' in result)) {
    return { diff: result.diff, edits: result.edits }
  }
  if (input && ('old_string' in input || 'new_string' in input || 'edits' in input)) {
    return {
      oldString: input.old_string,
      newString: input.new_string,
      edits: input.edits,
    }
  }
  return undefined
}

function getFileToolResultText(value: unknown): string | undefined {
  const text = stringifyToolResult(value).trim()
  return text || undefined
}

function getFileToolActions(
  safety: PathSafety,
  operation: ThreadDisplayFileToolSnapshot['operation'],
  path?: string,
): ThreadDisplayFileToolSnapshot['actions'] {
  if (safety === 'remote' || operation === 'unknown') {
    return []
  }
  if (operation === 'search' && isGlobPatternPath(path)) {
    return ['copyReference']
  }
  const actions: ThreadDisplayFileToolSnapshot['actions'] = ['copyPath']
  if (safety !== 'unknown' && !isGlobPatternPath(path)) {
    actions.unshift('open')
    actions.push('reveal')
  }
  if (operation === 'search') {
    actions.push('copyReference')
  }
  return actions
}

function isGlobPatternPath(path: string | undefined): boolean {
  return Boolean(path && /[*?[\]{}]/.test(path))
}

function getPathFields(
  path: string,
): Pick<ThreadDisplayFileSnapshot, 'absolutePath' | 'workspaceRelativePath' | 'safety'> {
  const safety = getPathSafety(path)
  return {
    absolutePath: isAbsolutePath(path) ? path : undefined,
    workspaceRelativePath: safety === 'workspace' ? path : undefined,
    safety,
  }
}

function getPathSafety(path: string): PathSafety {
  if (/^https?:\/\//i.test(path)) {
    return 'remote'
  }
  if (path === '..' || path.startsWith('..\\') || path.startsWith('../')) {
    return 'outside_workspace'
  }
  if (path.includes('\\..\\') || path.includes('/../')) {
    return 'outside_workspace'
  }
  if (isAbsolutePath(path)) {
    return 'unknown'
  }
  return 'workspace'
}

function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\') || path.startsWith('/')
}

function createSnapshotId(
  eventId: string,
  kind: 'file' | 'reference',
  path: string,
): string {
  const normalizedPath = path.replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 80)
  return `${eventId}:${kind}:${normalizedPath || 'unknown'}`
}

function stringifyToolResult(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(stringifyToolResult).filter(Boolean).join('\\n')
  }
  if (value && typeof value === 'object') {
    const object = value as JsonObject
    const text = getString(object, ['text', 'content', 'message', 'output', 'stderr', 'stdout'])
    if (text) {
      return text
    }
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return value === undefined || value === null ? '' : String(value)
}

function getJsonObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null
}

function getString(
  input: JsonObject | null | undefined,
  keys: string[],
): string | undefined {
  if (!input) {
    return undefined
  }
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}

function getNumber(
  input: JsonObject | null | undefined,
  keys: string[],
): number | undefined {
  if (!input) {
    return undefined
  }
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return undefined
}

function getStringArray(
  input: JsonObject | null | undefined,
  keys: string[],
): string[] {
  if (!input) {
    return []
  }
  for (const key of keys) {
    const value = input[key]
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string')
    }
  }
  return []
}
