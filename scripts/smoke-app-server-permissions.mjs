import assert from 'node:assert/strict'

const notifications = []
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

const requested = await waitForNotification(
  notification => notification.method === 'permission/requested',
)
assert.equal(requested.params.threadId, 'thread_smoke_permissions')
assert.equal(requested.params.turnId, 'turn_smoke_permissions')
assert.equal(requested.params.tool.name, 'Bash')
assert.equal(requested.params.input.command, 'npm.cmd test')

const permissionRequestId = requested.params.permissionRequestId
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

const cancelRequested = await waitForNotification(
  notification =>
    notification.method === 'permission/requested' &&
    notification.params.threadId === 'thread_smoke_cancel',
)
context.core.permission.cancelForTurn({
  threadId: 'thread_smoke_cancel',
  turnId: 'turn_smoke_cancel',
  reason: 'smoke_cancel',
})
const cancelled = await waitForNotification(
  notification =>
    notification.method === 'permission/cancelled' &&
    notification.params.permissionRequestId ===
      cancelRequested.params.permissionRequestId,
)
assert.equal(cancelled.params.reason, 'smoke_cancel')
const cancelError = await cancelPromise
assert.equal(cancelError.kind, 'turn_not_active')

console.log(
  JSON.stringify({
    ok: true,
    checked: [
      'permission/requested',
      'permission/respond_allow',
      'permission/respond_duplicate',
      'permission/respond_missing',
      'permission/cancelled',
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
