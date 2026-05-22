import { lstat, readdir, readFile, realpath, stat } from 'fs/promises'
import path from 'path'
import picomatch from 'picomatch'
import { logForDebugging } from './debug.js'

const MAX_NATIVE_SEARCH_FILES = 200_000
const MAX_NATIVE_GREP_RESULTS = 50_000
const MAX_NATIVE_GREP_FILE_BYTES = 5 * 1024 * 1024

type RipgrepOutputMode = 'files' | 'content' | 'files_with_matches' | 'count'

type ParsedRipgrepArgs = {
  outputMode: RipgrepOutputMode
  pattern: string | null
  literal: boolean
  caseInsensitive: boolean
  showLineNumbers: boolean
  followSymlinks: boolean
  sortModified: boolean
  maxColumns: number | null
  maxMatchesPerFile: number | null
  includeGlobs: string[]
  excludeGlobs: string[]
  typeGlobs: string[]
  beforeContext: number
  afterContext: number
  multiline: boolean
}

type FileEntry = {
  absolutePath: string
  outputPath: string
  relativePath: string
  mtimeMs: number
}

const MATCH_OPTIONS = {
  dot: true,
  nocase: process.platform === 'win32',
}

const TYPE_GLOBS: Record<string, string[]> = {
  c: ['*.c', '*.h'],
  cpp: ['*.cc', '*.cpp', '*.cxx', '*.hpp', '*.hh', '*.hxx'],
  cs: ['*.cs'],
  css: ['*.css'],
  go: ['*.go'],
  html: ['*.html', '*.htm'],
  java: ['*.java'],
  js: ['*.js', '*.jsx', '*.mjs', '*.cjs'],
  json: ['*.json', '*.jsonc'],
  kt: ['*.kt', '*.kts'],
  md: ['*.md', '*.markdown'],
  php: ['*.php'],
  py: ['*.py', '*.pyw'],
  rb: ['*.rb'],
  rs: ['*.rs'],
  sh: ['*.sh', '*.bash', '*.zsh'],
  toml: ['*.toml'],
  ts: ['*.ts', '*.tsx', '*.mts', '*.cts'],
  txt: ['*.txt'],
  xml: ['*.xml'],
  yaml: ['*.yaml', '*.yml'],
}

export function isNativeFileSearchFallbackAvailable(): boolean {
  return true
}

export function isRipgrepUnavailableError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  if (code === 'ENOENT' || code === 'EACCES' || code === 'EPERM') {
    return true
  }

  const message = error instanceof Error ? error.message : String(error)
  return /\b(ENOENT|EACCES|EPERM)\b/.test(message)
}

export async function nativeRipGrep(
  args: string[],
  target: string,
  abortSignal: AbortSignal,
): Promise<string[]> {
  const parsed = parseRipgrepArgs(args)
  if (parsed.outputMode === 'files') {
    return nativeListFilesForRipgrep(target, parsed, abortSignal)
  }

  if (!parsed.pattern) {
    return []
  }

  return nativeSearchFileContents(target, parsed, abortSignal)
}

export async function nativeRipGrepStream(
  args: string[],
  target: string,
  abortSignal: AbortSignal,
  onLines: (lines: string[]) => void,
): Promise<void> {
  const parsed = parseRipgrepArgs(args)
  if (!parsed.pattern || parsed.outputMode === 'files') {
    return
  }

  const results = await nativeSearchFileContents(target, parsed, abortSignal)
  const chunkSize = 50
  for (let i = 0; i < results.length; i += chunkSize) {
    if (abortSignal.aborted) return
    onLines(results.slice(i, i + chunkSize))
  }
}

export async function nativeListFilesForRipgrep(
  target: string,
  parsed: Pick<
    ParsedRipgrepArgs,
    | 'includeGlobs'
    | 'excludeGlobs'
    | 'typeGlobs'
    | 'followSymlinks'
    | 'sortModified'
  >,
  abortSignal: AbortSignal,
): Promise<string[]> {
  const entries = await collectFiles(target, parsed, abortSignal)
  const sorted = parsed.sortModified
    ? entries.sort((a, b) => a.mtimeMs - b.mtimeMs)
    : entries
  return sorted.map(entry => entry.outputPath)
}

function parseRipgrepArgs(args: string[]): ParsedRipgrepArgs {
  const parsed: ParsedRipgrepArgs = {
    outputMode: 'content',
    pattern: null,
    literal: false,
    caseInsensitive: false,
    showLineNumbers: false,
    followSymlinks: false,
    sortModified: false,
    maxColumns: null,
    maxMatchesPerFile: null,
    includeGlobs: [],
    excludeGlobs: [],
    typeGlobs: [],
    beforeContext: 0,
    afterContext: 0,
    multiline: false,
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue

    switch (arg) {
      case '--files':
        parsed.outputMode = 'files'
        break
      case '--glob':
      case '-g': {
        const pattern = args[++i]
        if (pattern) addGlob(pattern, parsed)
        break
      }
      case '--type': {
        const type = args[++i]
        if (type) parsed.typeGlobs.push(...(TYPE_GLOBS[type] ?? []))
        break
      }
      case '--follow':
        parsed.followSymlinks = true
        break
      case '--sort=modified':
        parsed.sortModified = true
        break
      case '--max-columns': {
        const value = Number(args[++i])
        parsed.maxColumns = Number.isFinite(value) ? value : null
        break
      }
      case '-m': {
        const value = Number(args[++i])
        parsed.maxMatchesPerFile = Number.isFinite(value) ? value : null
        break
      }
      case '-F':
        parsed.literal = true
        break
      case '-i':
        parsed.caseInsensitive = true
        break
      case '-l':
        parsed.outputMode = 'files_with_matches'
        break
      case '-c':
        parsed.outputMode = 'count'
        break
      case '-n':
        parsed.showLineNumbers = true
        break
      case '-U':
      case '--multiline-dotall':
        parsed.multiline = true
        break
      case '-A':
        parsed.afterContext = readPositiveNumber(args[++i])
        break
      case '-B':
        parsed.beforeContext = readPositiveNumber(args[++i])
        break
      case '-C': {
        const context = readPositiveNumber(args[++i])
        parsed.beforeContext = context
        parsed.afterContext = context
        break
      }
      case '-e': {
        const pattern = args[++i]
        if (pattern !== undefined) parsed.pattern = pattern
        break
      }
      case '--hidden':
      case '--no-heading':
      case '--no-ignore':
      case '--no-ignore-vcs':
        break
      default:
        if (arg.startsWith('--sort=')) {
          parsed.sortModified = arg === '--sort=modified'
        } else if (!arg.startsWith('-') && parsed.pattern === null) {
          parsed.pattern = arg
        }
    }
  }

  return parsed
}

function addGlob(pattern: string, parsed: ParsedRipgrepArgs): void {
  const normalized = normalizeGlobPattern(pattern)
  if (!normalized) return

  if (normalized.startsWith('!')) {
    const exclude = normalizeGlobPattern(normalized.slice(1))
    if (exclude) parsed.excludeGlobs.push(exclude)
  } else {
    parsed.includeGlobs.push(normalized)
  }
}

function readPositiveNumber(value: string | undefined): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

async function collectFiles(
  target: string,
  parsed: Pick<
    ParsedRipgrepArgs,
    'includeGlobs' | 'excludeGlobs' | 'typeGlobs' | 'followSymlinks'
  >,
  abortSignal: AbortSignal,
): Promise<FileEntry[]> {
  const targetWasAbsolute = path.isAbsolute(target)
  const targetPath = path.resolve(target)
  const entries: FileEntry[] = []
  const visitedDirectories = new Set<string>()
  let visitedFiles = 0

  const targetStats = await stat(targetPath).catch(() => null)
  if (!targetStats) return entries

  const rootDir = targetStats.isDirectory() ? targetPath : path.dirname(targetPath)

  const addFile = async (absolutePath: string): Promise<void> => {
    if (abortSignal.aborted || visitedFiles >= MAX_NATIVE_SEARCH_FILES) return
    visitedFiles += 1

    const fileStats = await stat(absolutePath).catch(() => null)
    if (!fileStats?.isFile()) return

    const relativePath = normalizePath(path.relative(rootDir, absolutePath))
    if (!matchesFileGlobs(relativePath, parsed)) return

    entries.push({
      absolutePath,
      outputPath: targetWasAbsolute ? absolutePath : relativePath,
      relativePath,
      mtimeMs: fileStats.mtimeMs ?? 0,
    })
  }

  const walk = async (currentDir: string): Promise<void> => {
    if (abortSignal.aborted || visitedFiles >= MAX_NATIVE_SEARCH_FILES) return

    const directoryKey = await realpath(currentDir).catch(() => currentDir)
    if (visitedDirectories.has(directoryKey)) return
    visitedDirectories.add(directoryKey)

    const dirents = await readdir(currentDir, { withFileTypes: true }).catch(
      error => {
        logForDebugging(
          `Native file search skipped unreadable directory ${currentDir}: ${String(error)}`,
        )
        return []
      },
    )

    for (const dirent of dirents) {
      if (abortSignal.aborted || visitedFiles >= MAX_NATIVE_SEARCH_FILES) break

      const absolutePath = path.join(currentDir, dirent.name)
      const relativePath = normalizePath(path.relative(rootDir, absolutePath))

      if (dirent.isDirectory()) {
        if (!matchesExcludedDirectory(relativePath, parsed.excludeGlobs)) {
          await walk(absolutePath)
        }
        continue
      }

      if (dirent.isSymbolicLink()) {
        if (!parsed.followSymlinks) continue

        const linkedStats = await lstat(absolutePath)
          .then(() => stat(absolutePath))
          .catch(() => null)
        if (linkedStats?.isDirectory()) {
          if (!matchesExcludedDirectory(relativePath, parsed.excludeGlobs)) {
            await walk(absolutePath)
          }
        } else if (linkedStats?.isFile()) {
          await addFile(absolutePath)
        }
        continue
      }

      if (dirent.isFile()) {
        await addFile(absolutePath)
      }
    }
  }

  if (targetStats.isDirectory()) {
    await walk(targetPath)
  } else if (targetStats.isFile()) {
    await addFile(targetPath)
  }

  if (visitedFiles >= MAX_NATIVE_SEARCH_FILES) {
    logForDebugging(
      `Native file search stopped after ${MAX_NATIVE_SEARCH_FILES} files under ${targetPath}`,
    )
  }

  return entries
}

async function nativeSearchFileContents(
  target: string,
  parsed: ParsedRipgrepArgs,
  abortSignal: AbortSignal,
): Promise<string[]> {
  const matcher = buildPatternMatcher(parsed)
  const files = await collectFiles(target, parsed, abortSignal)
  const results: string[] = []

  for (const file of files) {
    if (abortSignal.aborted || results.length >= MAX_NATIVE_GREP_RESULTS) break

    const fileStats = await stat(file.absolutePath).catch(() => null)
    if (!fileStats?.isFile() || fileStats.size > MAX_NATIVE_GREP_FILE_BYTES) {
      continue
    }

    const content = await readFile(file.absolutePath, 'utf8').catch(() => null)
    if (content === null || content.includes('\0')) continue

    const lines = content.split(/\r?\n/)
    const matchingLineIndexes: number[] = []
    let matchesInFile = 0

    for (let i = 0; i < lines.length; i += 1) {
      if (matcher(lines[i] ?? '')) {
        matchingLineIndexes.push(i)
        matchesInFile += 1
        if (
          parsed.maxMatchesPerFile !== null &&
          matchesInFile >= parsed.maxMatchesPerFile
        ) {
          break
        }
      }
    }

    if (matchingLineIndexes.length === 0) continue

    if (parsed.outputMode === 'files_with_matches') {
      results.push(file.absolutePath)
      continue
    }

    if (parsed.outputMode === 'count') {
      results.push(`${file.absolutePath}:${matchingLineIndexes.length}`)
      continue
    }

    for (const lineIndex of expandContextLines(
      matchingLineIndexes,
      lines.length,
      parsed.beforeContext,
      parsed.afterContext,
    )) {
      const line = applyMaxColumns(lines[lineIndex] ?? '', parsed.maxColumns)
      const lineNumber = lineIndex + 1
      results.push(
        parsed.showLineNumbers
          ? `${file.absolutePath}:${lineNumber}:${line}`
          : `${file.absolutePath}:${line}`,
      )
      if (results.length >= MAX_NATIVE_GREP_RESULTS) break
    }
  }

  if (results.length >= MAX_NATIVE_GREP_RESULTS) {
    logForDebugging(
      `Native grep fallback stopped after ${MAX_NATIVE_GREP_RESULTS} results`,
    )
  }

  return results
}

function buildPatternMatcher(
  parsed: Pick<
    ParsedRipgrepArgs,
    'pattern' | 'literal' | 'caseInsensitive' | 'multiline'
  >,
): (line: string) => boolean {
  const pattern = parsed.pattern ?? ''
  if (parsed.literal) {
    const needle = parsed.caseInsensitive ? pattern.toLowerCase() : pattern
    return line => {
      const haystack = parsed.caseInsensitive ? line.toLowerCase() : line
      return haystack.includes(needle)
    }
  }

  const flags = `${parsed.caseInsensitive ? 'i' : ''}${parsed.multiline ? 's' : ''}`
  const regex = new RegExp(pattern, flags)
  return line => regex.test(line)
}

function expandContextLines(
  matchIndexes: number[],
  lineCount: number,
  before: number,
  after: number,
): number[] {
  if (before === 0 && after === 0) return matchIndexes

  const indexes = new Set<number>()
  for (const matchIndex of matchIndexes) {
    const start = Math.max(0, matchIndex - before)
    const end = Math.min(lineCount - 1, matchIndex + after)
    for (let i = start; i <= end; i += 1) {
      indexes.add(i)
    }
  }
  return [...indexes].sort((a, b) => a - b)
}

function applyMaxColumns(line: string, maxColumns: number | null): string {
  if (maxColumns === null || line.length <= maxColumns) return line
  return `${line.slice(0, maxColumns)}...`
}

function matchesFileGlobs(
  relativePath: string,
  parsed: Pick<ParsedRipgrepArgs, 'includeGlobs' | 'excludeGlobs' | 'typeGlobs'>,
): boolean {
  if (matchesAnyGlob(relativePath, parsed.excludeGlobs)) return false

  const includeGlobs = [...parsed.includeGlobs, ...parsed.typeGlobs]
  if (includeGlobs.length === 0) return true
  return matchesAnyGlob(relativePath, includeGlobs)
}

function matchesExcludedDirectory(
  relativePath: string,
  excludeGlobs: string[],
): boolean {
  if (!relativePath || relativePath === '.') return false
  const directoryPath = relativePath.endsWith('/')
    ? relativePath
    : `${relativePath}/`
  return matchesAnyGlob(directoryPath, excludeGlobs)
}

function matchesAnyGlob(relativePath: string, patterns: string[]): boolean {
  const normalizedPath = normalizePath(relativePath)
  const basename = normalizedPath.split('/').pop() ?? normalizedPath

  return patterns.some(pattern => {
    const normalizedPattern = normalizeGlobPattern(pattern)
    if (!normalizedPattern) return false

    if (normalizedPattern.endsWith('/')) {
      const directoryPattern = `${normalizedPattern}**`
      return picomatch.isMatch(normalizedPath, directoryPattern, MATCH_OPTIONS)
    }

    if (!normalizedPattern.includes('/')) {
      return (
        picomatch.isMatch(basename, normalizedPattern, MATCH_OPTIONS) ||
        picomatch.isMatch(normalizedPath, `**/${normalizedPattern}`, MATCH_OPTIONS)
      )
    }

    return picomatch.isMatch(normalizedPath, normalizedPattern, MATCH_OPTIONS)
  })
}

function normalizeGlobPattern(pattern: string): string {
  let normalized = normalizePath(pattern.trim())
  if (normalized.startsWith('./')) normalized = normalized.slice(2)
  if (normalized.startsWith('/')) normalized = normalized.slice(1)
  return normalized
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/').split(path.sep).join('/')
}
