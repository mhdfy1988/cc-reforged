# UI Display Reducer Deepening Todo

## 目标文档

- [STD-HISTORY-15-0 UI display reducer deepening](../goals/2026-05-28-std-history-15-0-ui-display-reducer-deepening.md)

## 当前任务列表

- [x] UDRD-01 梳理 `threadDisplayProjection.ts` 中工具投影函数边界
- [x] UDRD-02 新建 `threadDisplayToolProjector.ts`
- [x] UDRD-03 将工具 snapshot / 工具分类 / 工具错误分类迁入 tool projector
- [x] UDRD-04 确认工具生命周期历史 snapshot 与实时 patch smoke 仍一致
- [x] UDRD-05 梳理 `threadDisplayProjection.ts` 中文件投影函数边界
- [x] UDRD-06 新建 `threadDisplayFileProjector.ts`
- [x] UDRD-07 将文件 snapshot / 路径安全 / 文件动作迁入 file projector
- [x] UDRD-08 补或复用文件 projection smoke
- [x] UDRD-09 评估真正单一 display reducer 状态机方案
- [x] UDRD-10 阶段收口：更新 goal、CHANGELOG、验证记录

## 当前指针

已完成：本轮深化收口。下一轮已启动：[ThreadDisplayReducerInputEvent Todo](./thread-display-input-event-todo.md)。

## 约束

1. 严格按 `tool projector -> file projector -> 单一 display reducer 状态机` 顺序推进。
2. 不允许 silent legacy fallback。
3. 不改变 `ThreadDisplayProjection` 协议字段。
4. 不改变用户可见工具卡 / 文件卡行为。
5. Renderer 不得重新解释 raw transcript 或 raw tool content。
6. 阶段 3 前必须先写状态机方案，不得直接大改。

## 后续记录

- 2026-05-28：创建 goal / todo。当前从 `tool projector` 开始，先拆结构，不改变行为。
- 2026-05-28：完成工具投影器拆分。`threadDisplayToolProjector.ts` 负责工具 snapshot、分类、状态、耗时、错误归因和主时间线隐藏策略；`threadDisplayProjection.ts` 只保留工具事件组装和文件投影调度。下一步验证历史 snapshot 与实时 patch 的工具生命周期一致性。
- 2026-05-28：工具阶段验证通过：`typecheck`、`typecheck:desktop`、`build`、`smoke:desktop-session-state`、`smoke:desktop-display-events`、`smoke:app-server`、`git diff --check` 均通过。下一步进入 `file projector`。
- 2026-05-28：完成文件投影器拆分。`threadDisplayFileProjector.ts` 负责文件 snapshot、搜索引用、路径安全、文本范围、diff 和文件动作；`threadDisplayProjection.ts` 只保留主消息投影分派。文件阶段验证通过：`typecheck`、`typecheck:desktop`、`build`、`smoke:desktop-session-state`、`smoke:desktop-display-events`、`smoke:app-server`。
- 2026-05-28：完成单一 display reducer 状态机评估。结论：下一步应先定义统一展示输入事件 `ThreadDisplayReducerInputEvent`，历史 snapshot 与实时 patch 分别作为输入适配器进入同一个 reducer；不要直接硬合并两个现有入口函数。
- 2026-05-28：阶段收口完成，CHANGELOG / goal / todo 均已更新。最终验证：`typecheck`、`typecheck:desktop`、`build`、`smoke:desktop-session-state`、`smoke:desktop-display-events`、`smoke:app-server`、`git diff --check` 通过。
