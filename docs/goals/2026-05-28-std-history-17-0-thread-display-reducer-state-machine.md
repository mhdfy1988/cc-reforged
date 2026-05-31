# Goal: STD-HISTORY-17-0 ThreadDisplayReducer State Machine

## 目标

完成 `ThreadDisplayReducer` 统一状态机收口。

上一轮 `STD-HISTORY-16-0` 已经把历史 `AppServerThreadMessage` 和实时 `CoreTurnEvent` 标准化为同一种 `ThreadDisplayReducerInputEvent`。本 goal 在这个基础上，让历史 snapshot 与实时 patch 都通过同一个 ordered display reducer 实例处理。

## 为什么要做

当前 `createThreadDisplayReducer(...)` 已经能先生成统一 input event，但内部仍只是把 input event 拆回旧分支：

- 历史输出仍由 `reduceThreadMessagesToDisplayItems(...)` 完成。
- 实时输出仍由 `reduceCoreEventDisplayPatchOperations(...)` 完成。

这说明输入层已经统一，但 reducer 内部状态还没有统一。工具 lifecycle、历史 item 顺序、实时 patch 输出仍分散在不同函数里。

本 goal 要把“状态”收进同一个 reducer 实例里，并清理历史 / 实时主路径上残留的独立 reducer 分支入口。

## 范围

### 1. 收口真正的 ThreadDisplayReducer

新增或改造 `ThreadDisplayReducer`，让它直接接收 `ThreadDisplayReducerInputEvent`。

状态机应提供：

- `acceptMany(inputEvents)`：用于历史 snapshot。
- `acceptOne(inputEvent)`：用于实时 patch。
- `toSnapshotItems()`：输出历史 snapshot items。
- `toPatchOperations()` 或等价机制：输出实时 patch operations。

### 2. reducer 内部维护统一状态

统一状态至少包括：

- `threadId`
- `sessionId`
- ordered input event 计数 / source identity
- snapshot items
- pending patch operations
- 工具 lifecycle 状态
- 工具 item index / toolUseId 绑定状态

### 3. 工具 lifecycle 接入统一 reducer

工具生命周期不再散落在历史和实时两个函数中独立初始化。

要求：

- 历史工具 lifecycle 使用 reducer 实例内的 lifecycle。
- 实时工具 lifecycle 使用 reducer 实例内或明确管理的 lifecycle。
- 同一个 `toolUseId` 的 `tool_use` / `tool_result` 仍稳定绑定到同一工具卡。
- 并行工具和乱序 `tool_result` smoke 仍通过。

### 4. 历史输出 snapshot items

历史路径应变成：

```text
AppServerThreadMessage[]
-> ThreadDisplayReducerInputEvent[]
-> ThreadDisplayReducer.acceptMany(...)
-> snapshot items
```

要求最终 `ThreadDisplaySnapshot.items` 与当前行为一致。

### 5. 实时输出 patch operations

实时路径应变成：

```text
CoreTurnEvent
-> ThreadDisplayReducerInputEvent
-> ThreadDisplayReducer.acceptOne(...)
-> patch operations
```

要求最终 `ThreadDisplayPatch.operations` 与当前行为一致。

## 明确不做

- 不改变 Desktop Renderer 协议。
- 不改变 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 字段。
- 不改变工具 / 文件 / 附件 / 错误 projector 行为。
- 不修改 `currentContextMessages` 链路。
- 不引入 silent legacy fallback。

## 不变式

1. `ThreadDisplayReducerInputEvent` 仍是唯一输入事实层。
2. 历史和实时都必须进入同一个 reducer 类型，而不是 facade 里再各自处理。
3. reducer 内部状态必须可追踪，不允许靠当前 config 或 raw fallback 重新解释历史。
4. 工具 lifecycle 绑定以 `toolUseId` / source identity 为准。
5. 用户可见输出必须不变。
6. 如果某个 input event 无法被 reducer 表达，必须显式诊断，不允许静默回旧逻辑。

## 验收标准

- [x] 存在真正的 `ThreadDisplayReducer` 状态机实现。
- [x] 历史 snapshot 通过 `ThreadDisplayReducerInputEvent[]` 进入 `ThreadDisplayReducer`。
- [x] 实时 patch 通过 `ThreadDisplayReducerInputEvent` 进入 `ThreadDisplayReducer`。
- [x] reducer 内部维护 snapshot items、pending patch operations、工具 lifecycle 和工具绑定状态。
- [x] 历史 input event 处理逻辑收进 `ThreadDisplayReducer.acceptHistoryInputEvent(...)`，不再保留独立历史 reducer 分支入口。
- [x] 实时 input event 处理逻辑收进 `ThreadDisplayReducer.createPatchOperations(...)`，不再保留独立实时 reducer 分支入口。
- [x] 工具 lifecycle 历史 / 实时 smoke 仍通过。
- [x] 新增或更新 smoke，固定统一 reducer 状态机路径。
- [x] 文档和 CHANGELOG 更新。
- [x] `typecheck`、`typecheck:desktop`、`build`、`smoke:thread-display-input-event`、`smoke:desktop-session-state`、`smoke:desktop-display-events`、`smoke:app-server`、`git diff --check` 通过。

## 当前状态

状态：完成。

当前指针：本 goal 已收口。下一步如继续 display reducer 深化，应进入“统一 display reducer 状态机”后续 goal，而不是恢复旧分支。

已完成：

- `ThreadDisplayReducer` 已成为真实状态机类，直接接收 `ThreadDisplayReducerInputEvent`。
- reducer 实例维护 `snapshotItems`、`pendingPatchOperations`、工具 lifecycle 和 `toolUseId -> item index` 绑定表。
- 历史路径改为 `ThreadDisplayReducerInputEvent[] -> acceptMany(...) -> toSnapshotItems()`。
- 实时路径改为 `ThreadDisplayReducerInputEvent -> acceptOne(...) -> consumePatchOperations()`。
- live 实时路径按 thread / turn 复用同一个 `ThreadDisplayReducer`，工具 lifecycle 不再单独散落在全局 lifecycle map。
- 历史 input event 处理逻辑已收进 reducer class 内部，`acceptMany(...)` 直接驱动 `snapshotItems`。
- 实时 input event 处理逻辑已收进 reducer class 内部，`acceptOne(...)` 直接驱动 `pendingPatchOperations`。
- `smoke:thread-display-input-event` 已直接验证统一 reducer 状态机路径：历史输出与 snapshot 一致，实时 started/completed 在同一个 reducer 实例中保留工具状态并输出 patch operations。
- 本 goal 没有改变 Renderer 协议，也没有改变 projector 展示语义；清理范围限定在主路径分派边界。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:thread-display-input-event
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server
git diff --check
```
