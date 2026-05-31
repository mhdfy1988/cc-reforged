# UI Display Reducer Unification Todo

## 目标文档

- [STD-HISTORY-14-0 UI display reducer unification](../goals/2026-05-28-std-history-14-0-ui-display-reducer-unification.md)

## 当前任务列表

- [x] UDR-01 建立第一阶段公共 display item factory / projector
- [x] UDR-02 让历史普通消息复用公共 factory
- [x] UDR-03 让实时 started item 复用公共 factory
- [x] UDR-04 让实时 completed item 复用公共 factory
- [x] UDR-05 保持 ThreadDisplay 协议路径不走 Renderer raw merge
- [x] UDR-06 补 smoke / 更新断言
- [x] UDR-07 文档和 CHANGELOG 收口
- [x] UDR-08 让工具生命周期展示项复用公共 factory
- [x] UDR-09 让系统类特殊项复用公共 factory
- [x] UDR-10 补普通图片/附件 projection smoke
- [x] UDR-11 让历史 snapshot 和实时 patch 入口委托同一个 display reducer
- [x] UDR-12 抽出附件 / 错误 projection projector

## 当前指针

无。入口 reducer 和附件 / 错误 projector 已完成第一轮收敛。

## 约束

1. 第一阶段只抽公共基础 factory，不重写所有实时 patch。
2. 附件、错误详情、图片等内容型特殊项放到后续阶段。
3. 不允许引入 silent legacy fallback。
4. Renderer 不得重新解释 raw transcript 或 raw tool content。

## 后续记录

- 2026-05-28：创建 goal / todo。第一阶段目标是先收敛普通消息和 core item 的基础 `ThreadDisplayItem` 构造，避免历史 snapshot 和实时 patch 各自生成 projection。
- 2026-05-28：第一阶段完成。`threadDisplay.ts` 新增公共基础 `createProjectedDisplayItem(...)`，历史普通消息、实时 started item、实时 completed item 已复用该 factory；工具生命周期 reducer、附件、错误、图片等特殊项保留到后续阶段。
- 2026-05-28：第二阶段先小步收敛工具生命周期展示项。`createToolLifecycleDisplayItem(...)` 已复用公共 factory，同时保留 existing item 合并和 tool lifecycle metadata；附件、错误、图片等特殊项尚未迁移。
- 2026-05-28：第二阶段继续收敛系统类特殊项。turn failed、permission request、reasoning-only notice、context compaction started / completed 已复用公共 factory；`withThreadDisplayProjection(...)` 只保留为公共 factory 内部实现。
- 2026-05-28：补普通图片/附件 projection smoke。历史 snapshot 和实时 patch 都固定验证普通消息中的用户上传图片、模型输出图片会生成 `attachmentSnapshots`，并移除 `[图片]` 占位或本地生成路径正文。
- 2026-05-28：历史 snapshot 与实时 patch 入口开始委托同一个 `createThreadDisplayReducer(...)`，旧的 `threadMessagesToDisplayItems(...)` / `getCoreEventDisplayPatchOperations(...)` 改为 reducer 内部 helper，不再作为入口口径。
- 2026-05-28：从 `threadDisplayProjection.ts` 拆出 `threadDisplayAttachmentProjector.ts` 和 `threadDisplayErrorProjector.ts`。附件快照、模型输出图片路径清理、用户 `[图片]` 占位清理、工具错误 / App Server 错误 snapshot 构造进入独立 projector。
- 2026-05-28：后续深化已迁移到 [UI Display Reducer Deepening Todo](./ui-display-reducer-deepening-todo.md)，按 `tool projector -> file projector -> 单一 display reducer 状态机` 继续。
