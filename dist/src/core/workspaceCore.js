import { stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { CoreError } from './errors.js';
export class CoreWorkspaceService {
    #workspace = null;
    getWorkspace() {
        return this.#workspace;
    }
    async openWorkspace(input) {
        if (!isAbsolute(input.path)) {
            throw new CoreError('invalid_params', 'Workspace path must be absolute.');
        }
        const workspacePath = resolve(input.path);
        const stats = await stat(workspacePath).catch(error => {
            throw new CoreError('invalid_params', 'Workspace path is not readable.', {
                path: workspacePath,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        if (!stats.isDirectory()) {
            throw new CoreError('invalid_params', 'Workspace path must be a directory.', {
                path: workspacePath,
            });
        }
        this.#workspace = {
            path: workspacePath,
            trusted: input.trust === 'trusted',
        };
        return this.#workspace;
    }
}
//# sourceMappingURL=workspaceCore.js.map