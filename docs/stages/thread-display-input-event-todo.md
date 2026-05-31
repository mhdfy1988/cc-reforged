# ThreadDisplayReducerInputEvent Todo

## 目标文档

- [STD-HISTORY-16-0 ThreadDisplayReducerInputEvent](../goals/2026-05-28-std-history-16-0-thread-display-input-event.md)

## 当前任务列表

- [x] TDRIE-01 梳理历史 snapshot 与实时 patch 当前输入字段
- [x] TDRIE-02 定义 `ThreadDisplayReducerInputEvent` 类型
- [x] TDRIE-03 新增历史 adapter：`AppServerThreadMessage -> ThreadDisplayReducerInputEvent`
- [x] TDRIE-04 新增实时 adapter：`CoreTurnEvent -> ThreadDisplayReducerInputEvent`
- [x] TDRIE-05 补输入层覆盖 smoke，确认历史 adapter 覆盖 snapshot 用例
- [x] TDRIE-06 补输入层覆盖 smoke，确认实时 adapter 覆盖 patch 用例
- [x] TDRIE-07 确认本 goal 不改变 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 输出
- [x] TDRIE-08 阶段收口：更新 goal、CHANGELOG、验证记录

## 当前指针

已完成：统一输入事件层收口。下一轮已启动：[ThreadDisplayReducer State Machine Todo](./thread-display-reducer-state-machine-todo.md)。

## 约束

1. 本 goal 只做统一输入事件层，不合并两个 reducer 分支。
2. 不改变用户可见 UI 行为。
3. 不改变 Renderer 协议。
4. 不修改 `currentContextMessages` 链路。
5. 不允许 silent legacy fallback。
6. adapter 失败必须显式诊断，不允许静默回旧语义。
7. 历史和实时 input event 必须保留 source identity，便于下一轮状态机接入。

## 后续记录

- 2026-05-28：创建 goal / todo。当前从输入字段梳理开始，先固定 `ThreadDisplayReducerInputEvent` 边界，再写历史 / 实时 adapter。
- 2026-05-28：完成 `ThreadDisplayReducerInputEvent` 第一版。新增历史 / 实时 adapter，`createThreadDisplayReducer(...)` facade 会先生成统一 input event，再交给现有输出分支；本 goal 不合并旧分支，不改变 Renderer 协议。
- 2026-05-28：新增 `smoke:thread-display-input-event`，覆盖历史 adapter、实时 adapter、历史 snapshot 输出和实时 patch 输出。当前 `typecheck`、`typecheck:desktop`、`build`、新增 smoke 已通过。
