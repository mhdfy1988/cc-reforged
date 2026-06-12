import { createHash } from 'node:crypto';
import { open, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { jsonStringify } from '../../utils/slowOperations.js';
export class PluginPersistentOperationStore {
    session;
    constructor(session) {
        this.session = session;
    }
    async writeOperation(operation) {
        await atomicWriteJson(operationPath(this.session, operation.operationId), operation);
    }
    async readOperation(operationId) {
        return readJsonOrNull(operationPath(this.session, operationId));
    }
}
export async function acquirePluginScopeLock(session, input) {
    const key = [
        input.scope,
        input.workspaceRoot ?? '',
    ].join('::');
    const path = join(session.paths.lockDir, `${createHash('sha256').update(key).digest('hex').slice(0, 24)}.lock`);
    await mkdir(dirname(path), { recursive: true });
    let handle;
    try {
        handle = await open(path, 'wx');
    }
    catch (error) {
        if (getErrorCode(error) === 'EEXIST') {
            throw pluginPersistenceError('plugin-operation-conflict', 'Another Plugin operation is already modifying this target scope.');
        }
        throw error;
    }
    try {
        await handle.writeFile(`${jsonStringify({
            schemaVersion: 1,
            operationId: input.operationId,
            scope: input.scope,
            workspaceRoot: input.workspaceRoot,
            acquiredAt: new Date().toISOString(),
        }, null, 2)}\n`, 'utf8');
        await handle.datasync();
    }
    finally {
        await handle.close();
    }
    let released = false;
    return {
        path,
        async release() {
            if (released)
                return;
            released = true;
            await rm(path, { force: true });
        },
    };
}
export async function atomicWriteJson(path, value) {
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.tmp.${process.pid}.${Date.now()}`;
    const handle = await open(temporaryPath, 'w');
    try {
        await handle.writeFile(`${jsonStringify(value, null, 2)}\n`, 'utf8');
        await handle.datasync();
    }
    finally {
        await handle.close();
    }
    try {
        await rename(temporaryPath, path);
    }
    catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
    }
}
export async function readJsonOrNull(path) {
    try {
        return JSON.parse(await readFile(path, 'utf8'));
    }
    catch (error) {
        if (getErrorCode(error) === 'ENOENT')
            return null;
        throw error;
    }
}
export function journalPath(session, operationId) {
    return join(session.paths.journalDir, `${safeRecordName(operationId)}.json`);
}
function operationPath(session, operationId) {
    return join(session.paths.operationStoreDir, `${safeRecordName(operationId)}.json`);
}
function safeRecordName(id) {
    return createHash('sha256').update(id).digest('hex');
}
function getErrorCode(error) {
    return typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined;
}
function pluginPersistenceError(code, message) {
    return Object.assign(new Error(message), { code });
}
//# sourceMappingURL=pluginPersistence.js.map