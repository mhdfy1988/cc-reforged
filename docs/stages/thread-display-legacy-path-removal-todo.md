# ThreadDisplay Legacy Path Removal Todo

## 目标文档

- [STD-HISTORY-18-0 ThreadDisplay Legacy Path Removal](../goals/2026-05-28-std-history-18-0-thread-display-legacy-path-removal.md)

## 当前任务列表

- [x] TDLPR-01 检查旧 reducer 入口函数名是否仍存在
- [x] TDLPR-02 确认历史 snapshot 主路径只进入 `ThreadDisplayReducer.acceptMany(...)`
- [x] TDLPR-03 确认实时 patch 主路径只进入 `ThreadDisplayReducer.acceptOne(...)`
- [x] TDLPR-04 确认工具 lifecycle 状态由 reducer 实例维护
- [x] TDLPR-05 更新 smoke，固定旧 reducer 入口名称不得回归
- [x] TDLPR-06 更新 goal、todo、CHANGELOG
- [x] TDLPR-07 运行 typecheck / build / smoke / diff 验证

## 当前指针

已完成：ThreadDisplay 旧 reducer 路径删除与回归保护。

下一步如继续推进，应处理更大的 display reducer 状态机深化，而不是恢复旧历史 / 实时分支。

## 约束

1. 不允许 silent legacy fallback。
2. 不恢复 `reduceThreadMessagesToDisplayItems(...)` / `reduceCoreEventDisplayPatchOperations(...)`。
3. 历史和实时只能作为不同 adapter / 输出 view 进入同一个 reducer 状态机。
4. 不改变 Desktop Renderer 协议。
5. 不改变用户可见 UI 行为。

## 后续记录

- 2026-05-28：确认代码里已不存在旧 reducer 入口函数名；主路径为 `ThreadDisplayReducer.acceptMany(...)` 和 `ThreadDisplayReducer.acceptOne(...)`。
- 2026-05-28：`smoke:thread-display-input-event` 增加旧入口名称回归断言，防止后续重新引入两套逻辑并存。
- 2026-05-28：验证通过：`typecheck`、`typecheck:desktop`、`build`、`smoke:thread-display-input-event`、`smoke:desktop-session-state`、`smoke:desktop-display-events`、`smoke:app-server`、`git diff --check`。
