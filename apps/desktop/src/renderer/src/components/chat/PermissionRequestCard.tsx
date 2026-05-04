import type { PermissionCard } from '../../domain/displayTypes.js'

export function PermissionRequestCard(props: {
  permission: PermissionCard
  onRespond: (
    permissionRequestId: string,
    behavior: 'allow' | 'deny',
  ) => Promise<void>
}) {
  const permission = props.permission

  return (
    <div className="permission-card">
      <div>
        <b>权限请求</b>
        <strong>{permission.toolName}</strong>
        <span>{permission.status}</span>
      </div>
      {permission.toolUseId ? (
        <small>关联工具：{permission.toolUseId}</small>
      ) : null}
      <pre>{JSON.stringify(permission.input, null, 2)}</pre>
      <div className="permission-actions">
        <button
          disabled={permission.status !== 'pending'}
          onClick={() => props.onRespond(permission.permissionRequestId, 'allow')}
        >
          允许一次
        </button>
        <button
          className="danger"
          disabled={permission.status !== 'pending'}
          onClick={() => props.onRespond(permission.permissionRequestId, 'deny')}
        >
          拒绝
        </button>
      </div>
    </div>
  )
}
