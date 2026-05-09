import {
  PermissionRespondParamsSchema,
  PermissionSettingsGetParamsSchema,
  PermissionSettingsUpdateParamsSchema,
} from '../protocol.js'
import type { AppServerContext } from '../router.js'

export function handlePermissionRespond(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = PermissionRespondParamsSchema.parse(params)
  return context.core.permission.respondPermission({
    permissionRequestId: parsedParams.permissionRequestId,
    result:
      parsedParams.behavior === 'allow'
        ? {
            behavior: 'allow',
            updatedInput: parsedParams.updatedInput ?? {},
            ...(parsedParams.updatedPermissions
              ? { updatedPermissions: parsedParams.updatedPermissions }
              : {}),
            ...(parsedParams.acceptFeedback
              ? { acceptFeedback: parsedParams.acceptFeedback }
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
  })
}

export function handlePermissionSettingsGet(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  PermissionSettingsGetParamsSchema.parse(params ?? {})
  return context.core.permission.getSettingsSnapshot()
}

export function handlePermissionSettingsUpdate(
  context: AppServerContext,
  params: unknown,
): Record<string, unknown> {
  const parsedParams = PermissionSettingsUpdateParamsSchema.parse(params)
  if (!parsedParams.source || !parsedParams.permissions) {
    throw new Error('Permission settings update requires source and permissions.')
  }
  return context.core.permission.updateSettings({
    source: parsedParams.source,
    permissions: parsedParams.permissions,
  })
}
