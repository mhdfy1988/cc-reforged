import type {
  ImageBlockParam,
  TextBlockParam,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/index.mjs'
import { BASH_TOOL_NAME } from '../tools/BashTool/toolName.js'
import { formatOutput } from '../tools/BashTool/utils.js'
import type {
  NotebookCell,
} from '../types/notebook.js'
import { getFsImplementation } from './fsOperations.js'
import { expandPath } from './path.js'
import { jsonParse } from './slowOperations.js'

const LARGE_OUTPUT_THRESHOLD = 10000

type NotebookOutputImage = {
  image_data: string
  media_type: 'image/png' | 'image/jpeg'
}

type NotebookCellOutput =
  | {
      output_type: 'stream'
      text?: string | string[]
    }
  | {
      output_type: 'execute_result' | 'display_data'
      data?: Record<string, unknown>
    }
  | {
      output_type: 'error'
      ename?: string
      evalue?: string
      traceback: string[]
    }
  | NotebookUnsupportedOutput

type NotebookUnsupportedOutput = {
  output_type: string
  [key: string]: unknown
}

type NotebookCellSourceOutput = {
  output_type: string
  text?: string
  image?: NotebookOutputImage
}

type NotebookCellSource = {
  cellType?: string
  source?: string
  execution_count?: number
  cell_id: string
  language?: string
  outputs?: NotebookCellSourceOutput[]
}

type NotebookCellWithOutputs = NotebookCell & {
  id?: string
  execution_count?: number | null
  outputs?: NotebookCellOutput[]
}

type NotebookContent = {
  metadata: {
    language_info?: {
      name?: string
    }
  }
  cells: NotebookCellWithOutputs[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isNotebookCellOutput(value: unknown): value is NotebookCellOutput {
  if (!isRecord(value) || typeof value.output_type !== 'string') {
    return false
  }

  switch (value.output_type) {
    case 'stream':
      return (
        value.text === undefined ||
        typeof value.text === 'string' ||
        isStringArray(value.text)
      )
    case 'execute_result':
    case 'display_data':
      return value.data === undefined || isRecord(value.data)
    case 'error':
      return (
        isStringArray(value.traceback) &&
        (value.ename === undefined || typeof value.ename === 'string') &&
        (value.evalue === undefined || typeof value.evalue === 'string')
      )
    default:
      return true
  }
}

function isNotebookCell(value: unknown): value is NotebookCellWithOutputs {
  if (!isRecord(value)) {
    return false
  }
  if (value.cell_type !== undefined && typeof value.cell_type !== 'string') {
    return false
  }
  if (value.source !== undefined) {
    const hasValidSource =
      typeof value.source === 'string' || isStringArray(value.source)
    if (!hasValidSource) return false
  }
  if (value.id !== undefined && typeof value.id !== 'string') {
    return false
  }
  if (
    value.execution_count !== undefined &&
    value.execution_count !== null &&
    typeof value.execution_count !== 'number'
  ) {
    return false
  }
  if (
    value.outputs !== undefined &&
    (!Array.isArray(value.outputs) ||
      !value.outputs.every(isNotebookCellOutput))
  ) {
    return false
  }
  return true
}

function isNotebookContent(value: unknown): value is NotebookContent {
  if (!isRecord(value) || !isRecord(value.metadata)) {
    return false
  }
  if (
    value.metadata.language_info !== undefined &&
    (!isRecord(value.metadata.language_info) ||
      (value.metadata.language_info.name !== undefined &&
        typeof value.metadata.language_info.name !== 'string'))
  ) {
    return false
  }
  return Array.isArray(value.cells) && value.cells.every(isNotebookCell)
}

function isLargeOutputs(
  outputs: (NotebookCellSourceOutput | undefined)[],
): boolean {
  let size = 0
  for (const o of outputs) {
    if (!o) continue
    size += (o.text?.length ?? 0) + (o.image?.image_data.length ?? 0)
    if (size > LARGE_OUTPUT_THRESHOLD) return true
  }
  return false
}

function processOutputText(text: unknown): string {
  if (!text) return ''
  const rawText = isStringArray(text) ? text.join('') : text
  if (typeof rawText !== 'string') return ''
  const { truncatedContent } = formatOutput(rawText)
  return truncatedContent
}

function extractImage(
  data: Record<string, unknown>,
): NotebookOutputImage | undefined {
  if (typeof data['image/png'] === 'string') {
    return {
      image_data: data['image/png'].replace(/\s/g, ''),
      media_type: 'image/png',
    }
  }
  if (typeof data['image/jpeg'] === 'string') {
    return {
      image_data: data['image/jpeg'].replace(/\s/g, ''),
      media_type: 'image/jpeg',
    }
  }
  return undefined
}

function processOutput(output: NotebookCellOutput) {
  switch (output.output_type) {
    case 'stream':
      return {
        output_type: output.output_type,
        text: processOutputText(output.text),
      }
    case 'execute_result':
    case 'display_data':
      {
      const data = isRecord(output.data) ? output.data : undefined
      return {
        output_type: output.output_type,
        text: processOutputText(data?.['text/plain']),
        image: data && extractImage(data),
      }
      }
    case 'error':
      {
      const traceback = Array.isArray(output.traceback) ? output.traceback : []
      return {
        output_type: output.output_type,
        text: processOutputText(
          `${output.ename}: ${output.evalue}\n${traceback.join('\n')}`,
        ),
      }
      }
    default:
      return {
        output_type: output.output_type,
        text: processOutputText(
          `Unsupported notebook output type: ${output.output_type}`,
        ),
      }
  }
}

function processCell(
  cell: NotebookCellWithOutputs,
  index: number,
  codeLanguage: string,
  includeLargeOutputs: boolean,
): NotebookCellSource {
  const cellId = cell.id ?? `cell-${index}`
  const cellData: NotebookCellSource = {
    cellType: cell.cell_type,
    source: Array.isArray(cell.source) ? cell.source.join('') : cell.source,
    execution_count:
      cell.cell_type === 'code' ? cell.execution_count ?? undefined : undefined,
    cell_id: cellId,
  }
  // Avoid giving text cells the code language.
  if (cell.cell_type === 'code') {
    cellData.language = codeLanguage
  }

  if (cell.cell_type === 'code' && cell.outputs?.length) {
    const outputs = cell.outputs.map(processOutput)
    if (!includeLargeOutputs && isLargeOutputs(outputs)) {
      cellData.outputs = [
        {
          output_type: 'stream',
          text: `Outputs are too large to include. Use ${BASH_TOOL_NAME} with: cat <notebook_path> | jq '.cells[${index}].outputs'`,
        },
      ]
    } else {
      cellData.outputs = outputs
    }
  }

  return cellData
}

function cellContentToToolResult(cell: NotebookCellSource): TextBlockParam {
  const metadata = []
  if (cell.cellType !== 'code') {
    metadata.push(`<cell_type>${cell.cellType}</cell_type>`)
  }
  if (cell.language !== 'python' && cell.cellType === 'code') {
    metadata.push(`<language>${cell.language}</language>`)
  }
  const cellContent = `<cell id="${cell.cell_id}">${metadata.join('')}${cell.source}</cell id="${cell.cell_id}">`
  return {
    text: cellContent,
    type: 'text',
  }
}

function cellOutputToToolResult(output: NotebookCellSourceOutput) {
  const outputs: (TextBlockParam | ImageBlockParam)[] = []
  if (output.text) {
    outputs.push({
      text: `\n${output.text}`,
      type: 'text',
    })
  }
  if (output.image) {
    outputs.push({
      type: 'image',
      source: {
        data: output.image.image_data,
        media_type: output.image.media_type,
        type: 'base64',
      },
    })
  }
  return outputs
}

function getToolResultFromCell(cell: NotebookCellSource) {
  const contentResult = cellContentToToolResult(cell)
  const outputResults = cell.outputs?.flatMap(cellOutputToToolResult)
  return [contentResult, ...(outputResults ?? [])]
}

/**
 * Reads and parses a Jupyter notebook file into processed cell data
 */
export async function readNotebook(
  notebookPath: string,
  cellId?: string,
): Promise<NotebookCellSource[]> {
  const fullPath = expandPath(notebookPath)
  const buffer = await getFsImplementation().readFileBytes(fullPath)
  const content = buffer.toString('utf-8')
  const parsedNotebook: unknown = jsonParse(content)
  if (!isNotebookContent(parsedNotebook)) {
    throw new Error(`Invalid notebook content in "${notebookPath}"`)
  }
  const notebook = parsedNotebook
  const language = notebook.metadata.language_info?.name ?? 'python'
  if (cellId) {
    const cell = notebook.cells.find(c => c.id === cellId)
    if (!cell) {
      throw new Error(`Cell with ID "${cellId}" not found in notebook`)
    }
    return [processCell(cell, notebook.cells.indexOf(cell), language, true)]
  }
  return notebook.cells.map((cell, index) =>
    processCell(cell, index, language, false),
  )
}

/**
 * Maps notebook cell data to tool result block parameters with sophisticated text block merging
 */
export function mapNotebookCellsToToolResult(
  data: NotebookCellSource[],
  toolUseID: string,
): ToolResultBlockParam {
  const allResults = data.flatMap(getToolResultFromCell)

  // Merge adjacent text blocks
  return {
    tool_use_id: toolUseID,
    type: 'tool_result' as const,
    content: allResults.reduce<(TextBlockParam | ImageBlockParam)[]>(
      (acc, curr) => {
        if (acc.length === 0) return [curr]

        const prev = acc[acc.length - 1]
        if (prev && prev.type === 'text' && curr.type === 'text') {
          // Merge the text blocks
          prev.text += '\n' + curr.text
          return acc
        }

        acc.push(curr)
        return acc
      },
      [],
    ),
  }
}

export function parseCellId(cellId: string): number | undefined {
  const match = cellId.match(/^cell-(\d+)$/)
  if (match && match[1]) {
    const index = parseInt(match[1], 10)
    return isNaN(index) ? undefined : index
  }
  return undefined
}
