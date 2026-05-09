import { feature } from 'bun:bundle';
import { initSessionMemory } from '../services/SessionMemory/sessionMemory.js';
import { logForDiagnosticsNoPII } from '../utils/diagLogs.js';
let initialized = false;
export async function setupAppServerRuntime() {
    if (initialized) {
        return {
            initialized: true,
            alreadyInitialized: true,
        };
    }
    logForDiagnosticsNoPII('info', 'app_server_runtime_setup_started');
    initSessionMemory();
    if (feature('CONTEXT_COLLAPSE')) {
        await import('../services/contextCollapse/index.js');
    }
    initialized = true;
    logForDiagnosticsNoPII('info', 'app_server_runtime_setup_completed');
    return {
        initialized: true,
        alreadyInitialized: false,
    };
}
//# sourceMappingURL=setup.js.map