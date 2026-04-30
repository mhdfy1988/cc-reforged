import { PermissionRespondParamsSchema } from '../protocol.js';
export function handlePermissionRespond(context, params) {
    const parsedParams = PermissionRespondParamsSchema.parse(params);
    return context.core.permission.respondPermission({
        permissionRequestId: parsedParams.permissionRequestId,
        result: parsedParams.behavior === 'allow'
            ? {
                behavior: 'allow',
                updatedInput: parsedParams.updatedInput ?? {},
                ...(parsedParams.updatedPermissions
                    ? { updatedPermissions: parsedParams.updatedPermissions }
                    : {}),
                ...(parsedParams.toolUseID
                    ? { toolUseID: parsedParams.toolUseID }
                    : {}),
                ...(parsedParams.decisionClassification
                    ? { decisionClassification: parsedParams.decisionClassification }
                    : {}),
            }
            : {
                behavior: 'deny',
                message: parsedParams.message ?? 'User denied permission.',
                ...(parsedParams.interrupt === undefined
                    ? {}
                    : { interrupt: parsedParams.interrupt }),
                ...(parsedParams.toolUseID
                    ? { toolUseID: parsedParams.toolUseID }
                    : {}),
                ...(parsedParams.decisionClassification
                    ? { decisionClassification: parsedParams.decisionClassification }
                    : {}),
            },
    });
}
//# sourceMappingURL=permissionHandlers.js.map