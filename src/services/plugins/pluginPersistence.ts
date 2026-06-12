import { createHash } from 'node:crypto'
import { open, mkdir, readFile, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { jsonStringify } from '../../utils/slowOperations.js'
import type { PluginDomainSession } from './pluginDomainSession.js'
import type { PluginOperationRecord } from './pluginActionService.js'

export class PluginPersistentOperationStore {
  constructor(private readonly session: PluginDomainSession) {}

  async writeOperation(operation: PluginOperationRecord): Promise<void> {
    await atomicWriteJson(
      operationPath(this.session, operation.operationId),
      operation,
    )
  }

  async readOperation(
    operationId: string,
  ): Promise<PluginOperationRecord | null> {
    return readJsonOrNull<PluginOperationRecord>(
      operationPath(this.session, operationId),
    )
  }
}

export type PluginScopeLock = {
  path: string
  release(): Promise<void>
}

export async function acquirePluginScopeLock(
  session: PluginDomainSession,
  input: {
    operationId: string
    scope: string
    workspaceRoot?: string
  },
): Promise<PluginScopeLock> {
  const key = [
    input.scope,
    input.workspaceRoot ?? '',
  ].join('::')
  const path = join(
    session.paths.lockDir,
    `${createHash('sha256').update(key).digest('hex').slice(0, 24)}.lock`,
  )
  await mkdir(dirname(path), { recursive: true })
  let handle
  try {
    handle = await open(path, 'wx')
  } catch (error) {
    if (getErrorCode(error) === 'EEXIST') {
      throw pluginPersistenceError(
        'plugin-operation-conflict',
        'Another Plugin operation is already modifying this target scope.',
      )
    }
    throw error
  }
  try {
    await handle.writeFile(
      `${jsonStringify(
        {
          schemaVersion: 1,
          operationId: input.operationId,
          scope: input.scope,
          workspaceRoot: input.workspaceRoot,
          acquiredAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    await handle.datasync()
  } finally {
    await handle.close()
  }
  let released = false
  return {
    path,
    async release() {
      if (released) return
      released = true
      await rm(path, { force: true })
    },
  }
}

export async function atomicWriteJson(
  path: string,
  value: unknown,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp.${process.pid}.${Date.now()}`
  const handle = await open(temporaryPath, 'w')
  try {
    await handle.writeFile(`${jsonStringify(value, null, 2)}\n`, 'utf8')
    await handle.datasync()
  } finally {
    await handle.close()
  }
  try {
    await rename(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

export async function readJsonOrNull<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') return null
    throw error
  }
}

export function journalPath(
  session: PluginDomainSession,
  operationId: string,
): string {
  return join(
    session.paths.journalDir,
    `${safeRecordName(operationId)}.json`,
  )
}

function operationPath(
  session: PluginDomainSession,
  operationId: string,
): string {
  return join(
    session.paths.operationStoreDir,
    `${safeRecordName(operationId)}.json`,
  )
}

function safeRecordName(id: string): string {
  return createHash('sha256').update(id).digest('hex')
}

function getErrorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : undefined
}

function pluginPersistenceError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}
