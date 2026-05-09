import { WorkspaceOpenParamsSchema } from '../protocol.js';
export async function handleWorkspaceOpen(context, params) {
    const parsedParams = WorkspaceOpenParamsSchema.parse(params);
    const workspace = await context.core.workspace.openWorkspace({
        path: parsedParams.path,
        trust: parsedParams.trust,
    });
    return {
        workspace,
    };
}
//# sourceMappingURL=workspaceHandlers.js.map