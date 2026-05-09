import { createInterface } from 'node:readline'
import { AppServerError, errorResponse } from './errors.js'
import { createAppServerContext, handleJsonRpcMessage } from './router.js'
import type { JsonRpcNotification, JsonRpcResponse } from './protocol.js'

type ReadableWithEncoding = NodeJS.ReadableStream & {
  setEncoding?: (encoding: BufferEncoding) => void
}

export type RunStdioAppServerOptions = {
  input?: ReadableWithEncoding
  output?: NodeJS.WritableStream
  errorOutput?: NodeJS.WritableStream
}

export async function runStdioAppServer(
  options: RunStdioAppServerOptions = {},
): Promise<void> {
  const input = options.input ?? process.stdin
  const output = options.output ?? process.stdout
  const errorOutput = options.errorOutput ?? process.stderr
  const context = createAppServerContext({
    emit: notification => writeProtocolMessage(output, notification),
  })

  input.setEncoding?.('utf8')

  const lineReader = createInterface({
    input,
    crlfDelay: Infinity,
    terminal: false,
  })

  try {
    for await (const line of lineReader) {
      if (!line.trim()) {
        continue
      }

      const response = await handleProtocolLine(context, line)
      writeProtocolResponse(output, response)

      if (context.shutdownRequested) {
        break
      }
    }
  } catch (error) {
    errorOutput.write(formatTransportError(error))
  } finally {
    lineReader.close()
  }
}

export async function handleProtocolLine(
  context: ReturnType<typeof createAppServerContext>,
  line: string,
): Promise<JsonRpcResponse> {
  let parsed: unknown

  try {
    parsed = JSON.parse(line)
  } catch (error) {
    return errorResponse(
      null,
      new AppServerError('parse_error', undefined, getParseErrorDetails(error)),
    )
  }

  return handleJsonRpcMessage(context, parsed)
}

export function writeProtocolResponse(
  output: NodeJS.WritableStream,
  response: JsonRpcResponse,
): void {
  writeProtocolMessage(output, response)
}

export function writeProtocolMessage(
  output: NodeJS.WritableStream,
  response: JsonRpcResponse | JsonRpcNotification,
): void {
  output.write(`${JSON.stringify(response)}\n`)
}

function getParseErrorDetails(error: unknown): Record<string, string> | undefined {
  if (error instanceof Error) {
    return {
      message: error.message,
    }
  }

  return undefined
}

function formatTransportError(error: unknown): string {
  if (error instanceof Error) {
    return `[ccr-app-server] ${error.stack ?? error.message}\n`
  }

  return `[ccr-app-server] ${String(error)}\n`
}
