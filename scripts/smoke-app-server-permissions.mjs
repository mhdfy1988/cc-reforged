import assert from 'node:assert/strict'

const notifications = []
const { enableConfigs } = await import('../dist/src/utils/config.js')
enableConfigs()
const { createAppServerContext, handleJsonRpcMessage } = await import(
  '../dist/src/app-server/router.js'
)

const context = createAppServerContext({
  emit: notification => notifications.push(notification),
})

const initializeResponse = await handleJsonRpcMessage(context, {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { clientInfo: { name: 'smoke-app-server-permissions' } },
})
assert.equal(initializeResponse.result.capabilities.permissions, true)

const allowPromise = context.core.permission.requestPermission({
  threadId: 'thread_smoke_permissions',
  turnId: 'turn_smoke_permissions',
  request: {
    subtype: 'can_use_tool',
    tool_name: 'Bash',
    input: { command: 'npm.cmd test' },
    permission_suggestions: [],
    decision_reason: 'Command execution requires approval.',
    tool_use_id: 'toolu_smoke_permissions',
    description: 'Run npm.cmd test',
  },
})

const requestedPatch = await waitForNotification(
  notification =>
    notification.method === 'thread/display/patch' &&
    notification.params.operations?.some(
      operation =>
        operation.op === 'append_item' &&
        operation.item?.type === 'permission_request' &&
        operation.item?.content?.threadId === 'thread_smoke_permissions',
    ),
)
const requestedItem = requestedPatch.params.operations.find(
  operation =>
    operation.op === 'append_item' &&
    operation.item?.type === 'permission_request' &&
    operation.item?.content?.threadId === 'thread_smoke_permissions',
)?.item
assert.equal(requestedItem.projection?.version, 1)
assert.equal(requestedItem.projection?.event?.type, 'permission_request')
assert.equal(requestedItem.content.threadId, 'thread_smoke_permissions')
assert.equal(requestedItem.content.turnId, 'turn_smoke_permissions')
assert.equal(requestedItem.content.tool.name, 'Bash')
assert.equal(requestedItem.content.input.command, 'npm.cmd test')

const permissionRequestId = requestedItem.content.permissionRequestId
const pendingListResponse = await handleJsonRpcMessage(context, {
  jsonrpc: '2.0',
  id: 20,
  method: 'permission/pending/list',
  params: {},
})
assert.equal(pendingListResponse.result.permissions.length, 1)
assert.equal(
  pendingListResponse.result.permissions[0].permissionRequestId,
  permissionRequestId,
)
assert.equal(pendingListResponse.result.permissions[0].tool.name, 'Bash')

const allowResponse = await handleJsonRpcMessage(context, {
  jsonrpc: '2.0',
  id: 2,
  method: 'permission/respond',
  params: {
    permissionRequestId,
    behavior: 'allow',
    updatedInput: { command: 'npm.cmd test' },
    decisionClassification: 'user_temporary',
  },
})
assert.equal(allowResponse.result.accepted, true)
const allowResult = await allowPromise
assert.equal(allowResult.behavior, 'allow')
assert.equal(allowResult.updatedInput.command, 'npm.cmd test')
const emptyPendingListResponse = await handleJsonRpcMessage(context, {
  jsonrpc: '2.0',
  id: 21,
  method: 'permission/pending/list',
  params: {},
})
assert.equal(emptyPendingListResponse.result.permissions.length, 0)

const duplicateResponse = await handleJsonRpcMessage(context, {
  jsonrpc: '2.0',
  id: 3,
  method: 'permission/respond',
  params: {
    permissionRequestId,
    behavior: 'deny',
    message: 'duplicate',
  },
})
assert.equal(duplicateResponse.error.data.kind, 'permission_not_pending')

const missingResponse = await handleJsonRpcMessage(context, {
  jsonrpc: '2.0',
  id: 4,
  method: 'permission/respond',
  params: {
    permissionRequestId: 'perm_missing',
    behavior: 'deny',
    message: 'missing',
  },
})
assert.equal(missingResponse.error.data.kind, 'permission_not_found')

const cancelPromise = context.core.permission
  .requestPermission({
    threadId: 'thread_smoke_cancel',
    turnId: 'turn_smoke_cancel',
    request: {
      subtype: 'can_use_tool',
      tool_name: 'Bash',
      input: { command: 'npm.cmd publish' },
      tool_use_id: 'toolu_smoke_cancel',
      description: 'Run npm.cmd publish',
    },
  })
  .then(
    () => {
      throw new Error('cancelled permission unexpectedly resolved')
    },
    error => error,
  )

const cancelRequestedPatch = await waitForNotification(
  notification =>
    notification.method === 'thread/display/patch' &&
    notification.params.operations?.some(
      operation =>
        operation.op === 'append_item' &&
        operation.item?.type === 'permission_request' &&
        operation.item?.content?.threadId === 'thread_smoke_cancel',
    ),
)
const cancelRequestedItem = cancelRequestedPatch.params.operations.find(
  operation =>
    operation.op === 'append_item' &&
    operation.item?.type === 'permission_request' &&
    operation.item?.content?.threadId === 'thread_smoke_cancel',
)?.item
context.core.permission.cancelForTurn({
  threadId: 'thread_smoke_cancel',
  turnId: 'turn_smoke_cancel',
  reason: 'smoke_cancel',
})
const cancelled = await waitForNotification(
  notification =>
    notification.method === 'thread/display/patch' &&
    notification.params.operations?.some(
      operation =>
        operation.op === 'update_item' &&
        operation.itemId === cancelRequestedItem.content.permissionRequestId &&
        operation.item?.status === 'cancelled' &&
        operation.item?.metadata?.coreEventType === 'permission_cancelled',
    ),
)
const cancelledOperation = cancelled.params.operations.find(
  operation =>
    operation.op === 'update_item' &&
    operation.itemId === cancelRequestedItem.content.permissionRequestId,
)
assert.equal(cancelledOperation.item.metadata.reason, 'smoke_cancel')
const cancelError = await cancelPromise
assert.equal(cancelError.kind, 'turn_not_active')

assert.equal(
  notifications.some(
    notification => notification.method === 'permission/requested',
  ),
  false,
)
assert.equal(
  notifications.some(
    notification => notification.method === 'permission/cancelled',
  ),
  false,
)

console.log(
  JSON.stringify({
    ok: true,
    checked: [
      'thread/display/patch_permission_requested',
      'permission/pending/list',
      'permission/respond_allow',
      'permission/respond_duplicate',
      'permission/respond_missing',
      'thread/display/patch_permission_cancelled',
    ],
  }),
)

function waitForNotification(predicate) {
  const existing = notifications.find(predicate)
  if (existing) {
    return Promise.resolve(existing)
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const timer = setInterval(() => {
      const notification = notifications.find(predicate)
      if (notification) {
        clearInterval(timer)
        resolve(notification)
        return
      }
      if (Date.now() - startedAt > 5000) {
        clearInterval(timer)
        reject(new Error('Timed out waiting for permission notification'))
      }
    }, 10)
  })
}
