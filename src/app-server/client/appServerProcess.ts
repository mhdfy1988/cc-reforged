import { execa, type ResultPromise } from 'execa'
import type { Options } from 'execa'
import type { JsonRpcLineTransport, TransportCloseEvent, Unsubscribe } from './types.js'

export type AppServerProcessOptions = {
  command?: string
  args?: readonly string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export type AppServerProcess = JsonRpcLineTransport & {
  pid?: number
  getStderr: () => string
  onStderr: (listener: (chunk: string) => void) => Unsubscribe
  waitForExit: () => Promise<TransportCloseEvent>
}

type ExecaProcess = ResultPromise<Options>

export function startAppServerProcess(
  options: AppServerProcessOptions = {},
): AppServerProcess {
  const command = options.command ?? process.execPath
  const args = options.args ?? ['cli.js', 'app-server', '--listen', 'stdio']
  const child = execa(command, [...args], {
    cwd: options.cwd,
    env: options.env,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    buffer: false,
    cleanup: true,
    reject: false,
  })

  const lineListeners = new Set<(line: string) => void>()
  const stderrListeners = new Set<(chunk: string) => void>()
  const closeListeners = new Set<(event: TransportCloseEvent) => void>()
  let stdoutBuffer = ''
  let stderr = ''
  let closeEvent: TransportCloseEvent | null = null

  child.stdout?.setEncoding('utf8')
  child.stderr?.setEncoding('utf8')

  child.stdout?.on('data', chunk => {
    stdoutBuffer += String(chunk)
    for (;;) {
      const newline = stdoutBuffer.indexOf('\n')
      if (newline === -1) {
        break
      }
      const line = stdoutBuffer.slice(0, newline)
      stdoutBuffer = stdoutBuffer.slice(newline + 1)
      for (const listener of lineListeners) {
        listener(line)
      }
    }
  })

  child.stderr?.on('data', chunk => {
    const text = String(chunk)
    stderr += text
    for (const listener of stderrListeners) {
      listener(text)
    }
  })

  child.on('error', error => {
    emitClose({
      code: null,
      signal: null,
      stderr,
      error,
    })
  })

  child.then(
    result => {
      emitClose({
        code: result.exitCode ?? null,
        signal: (result.signal as NodeJS.Signals | undefined) ?? null,
        stderr,
        failed: result.failed,
        isMaxBuffer: result.isMaxBuffer,
        ...(result.failed ? { error: result } : {}),
      })
    },
    error => {
      emitClose({
        code: null,
        signal: null,
        stderr,
        error,
      })
    },
  )

  function emitClose(event: TransportCloseEvent): void {
    if (closeEvent) {
      return
    }

    closeEvent = event
    for (const listener of closeListeners) {
      listener(event)
    }
  }

  return {
    pid: child.pid,
    sendLine(line: string): void {
      if (!child.stdin) {
        throw new Error('App Server stdin is not available.')
      }
      child.stdin.write(`${line}\n`)
    },
    close(): void {
      if (closeEvent) {
        return
      }
      child.kill('SIGTERM')
    },
    onLine(listener: (line: string) => void): Unsubscribe {
      lineListeners.add(listener)
      return () => lineListeners.delete(listener)
    },
    onClose(listener: (event: TransportCloseEvent) => void): Unsubscribe {
      closeListeners.add(listener)
      if (closeEvent) {
        listener(closeEvent)
      }
      return () => closeListeners.delete(listener)
    },
    getStderr(): string {
      return stderr
    },
    onStderr(listener: (chunk: string) => void): Unsubscribe {
      stderrListeners.add(listener)
      return () => stderrListeners.delete(listener)
    },
    async waitForExit(): Promise<TransportCloseEvent> {
      if (closeEvent) {
        return closeEvent
      }

      return new Promise(resolve => {
        const unsubscribe = this.onClose(event => {
          unsubscribe()
          resolve(event)
        })
      })
    },
  }
}
