# Goal: STD-HISTORY-18-0 ThreadDisplay Legacy Path Removal

## 目标

删除 ThreadDisplay 展示链路中的重复旧路径，防止历史展示和实时展示再次变成“两套逻辑并存”。

最终代码里只保留一个 display reducer 主状态机：历史和实时只是不同输入 adapter / 不同输出 view，不允许保留 silent legacy fallback。

## 范围

### 1. 删除或内联旧 reducer 入口

以下旧入口不得作为代码路径继续存在：

- `reduceThreadMessagesToDisplayItems(...)`
- `reduceCoreEventDisplayPatchOperations(...)`
- `threadMessagesToDisplayItems(...)`
- `getCoreEventDisplayPatchOperations(...)`
- `reduceThreadDisplayInputEventsToDisplayItems(...)`
- `reduceThreadDisplayInputEventPatchOperations(...)`

### 2. 保留唯一主状态机

唯一主路径为：

```text
历史 AppServerThreadMessage[]
-> appServerThreadMessagesToDisplayReducerInputEvents(...)
-> ThreadDisplayReducer.acceptMany(...)
-> ThreadDisplayReducer.toSnapshotItems()
```

```text
实时 CoreTurnEvent
-> coreTurnEventToDisplayReducerInputEvent(...)
-> ThreadDisplayReducer.acceptOne(...)
-> ThreadDisplayReducer.consumePatchOperations()
```

### 3. 清理重复组装逻辑

`ThreadDisplayReducer` 可以继续调用独立 helper / projector，但这些 helper 不能变成第二套 reducer：

- factory 统一从 `createProjectedDisplayItem(...)` / `createToolLifecycleDisplayItem(...)` 出口进入 projection。
- 工具 lifecycle 由 reducer 实例维护。
- patch 组装由 reducer 的实时 view 输出，不在外部再分派旧分支。

## 不变式

1. 历史和实时必须先转成 `ThreadDisplayReducerInputEvent`。
2. `ThreadDisplayReducer` 是唯一维护展示状态的 reducer。
3. 旧函数不得以兼容 fallback、try/catch fallback、备用 helper 的形式静默保留。
4. 如果未来某类事件无法表达，应显式失败或显式诊断，不允许退回旧逻辑。
5. 用户可见输出必须保持不变。

## 验收标准

- [x] 代码中不存在旧 reducer 入口函数名。
- [x] 历史 snapshot 主路径进入 `ThreadDisplayReducer.acceptMany(...)`。
- [x] 实时 patch 主路径进入 `ThreadDisplayReducer.acceptOne(...)`。
- [x] 工具 lifecycle 状态由 reducer 实例维护。
- [x] smoke 固定检查旧 reducer 入口名称不得回归。
- [x] 文档、todo、CHANGELOG 更新。
- [x] `typecheck`、`typecheck:desktop`、`build`、`smoke:thread-display-input-event`、`smoke:desktop-session-state`、`smoke:desktop-display-events`、`smoke:app-server`、`git diff --check` 通过。

## 当前状态

状态：完成。

已完成：

- 代码确认已不存在 `reduceThreadMessagesToDisplayItems(...)` / `reduceCoreEventDisplayPatchOperations(...)` 及其迁移期别名。
- `smoke:thread-display-input-event` 增加旧 reducer 入口名称回归断言。
- `ThreadDisplayReducer` 内部仍保留必要 helper，但这些 helper 不再作为状态机外的第二套 reducer 入口。

## 验证命令

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
