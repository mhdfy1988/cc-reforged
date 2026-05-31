# CCR 当前上下文主链路 ordered reducer 化 Todo

本文承接 [STD-HISTORY-13-0 当前上下文主链路 ordered reducer 化](../goals/2026-05-28-std-history-13-0-current-context-ordered-reducer.md)，作为实现、验收和恢复接续的权威任务列表。

## 目标仓库

`D:\agent_project\claude-code-reforged`

## 总目标

让恢复后的 `currentContextMessages` 由 ordered transcript event reducer 直接产出，移除 `buildConversationChain(...)` 在当前上下文主路径里的隐式兜底角色。

目标链路：

```text
transcript JSONL
  -> ordered transcript events
  -> classified materialized events
  -> current context reducer
  -> currentContextMessages
  -> Core threadMessages
```

## 权威输入

- [STD-HISTORY-13-0 Goal](../goals/2026-05-28-std-history-13-0-current-context-ordered-reducer.md)
- [CCR 会话语义 Codex-like 适配层 Todo](./session-semantics-codex-migration-todo.md)
- [CCR 会话物化边界收口 Todo](./session-materialization-boundary-cleanup-todo.md)
- [CCR 历史恢复与实时展示统一协议实施计划](./realtime-history-display-contract-todo.md)
- [并行工具结果来源绑定 Todo](./parallel-tool-result-source-binding-todo.md)

## 当前任务列表（实时）

- [x] CCTX-01 只读盘点 `buildConversationChain(...)` 在当前上下文主路径承担的能力。
- [x] CCTX-02 设计 `currentContextReducer` 的输入、状态和输出。
- [x] CCTX-03 迁移 compact / snip / preservedSegment 当前上下文裁剪语义。
- [x] CCTX-04 迁移并行工具 sibling / `tool_result` 补回能力。
- [x] CCTX-05 接入 `currentContextMessages` 主路径，并移除 `buildConversationChain(...)` 静默兜底。
- [x] CCTX-06 补齐 smoke：并行工具、乱序结果、compact 组合、sidechain、孤立结果。
- [x] CCTX-07 文档、CHANGELOG 和后续风险回写。

## 当前指针

- 当前进行中：无。
- 当前正在做：本专项当前任务列表已完成。
- 完成后下一项：单独处理 Desktop `ThreadDisplaySnapshot` merge counts 语义修正，或继续评估 visible history / realtime patch 是否进一步收敛到同一个 ordered display reducer。

## 执行约束

1. 本专项只处理 `currentContextMessages` 主链路。
2. 不修改 UI 历史展示语义，不把 UI 历史和当前模型上下文混成同一个数组。
3. 不处理 Desktop snapshot merge counts，那个问题单独开后续 goal。
4. 不清理 `thread/messages/list` 兼容接口，除非它直接阻碍本专项验收。
5. 不修改原始 transcript 写入格式。
6. 不把 `buildConversationChain(...)` 作为 reducer 失败后的静默 fallback。
7. 如果必须保留 legacy helper，必须显式命名、记录诊断、写清触发条件和测试覆盖。
8. 所有通过 `cli.js`、`dist`、Electron main 或 App Server 构建产物运行的 smoke，必须先 `npm.cmd run build`。

## CCTX-01 只读盘点旧 helper 能力

Goal 文件：[STD-HISTORY-13-0](../goals/2026-05-28-std-history-13-0-current-context-ordered-reducer.md)

目标：确认 `buildConversationChain(...)` 和 `appendCurrentContextFollowers(...)` 当前到底为 `currentContextMessages` 补了哪些能力。

任务：

- [x] 精确阅读 `conversationMaterialization.ts` 中调用 `buildConversationChain(...)` 的上下文。
- [x] 精确阅读 `sessionStorage.ts` 中 `buildConversationChain(...)` 的行为。
- [x] 精确阅读 `appendCurrentContextFollowers(...)` 的并行工具补回逻辑。
- [x] 输出能力清单：必须迁移、可以删除、必须保留为显式 legacy helper。

验收：

- [x] 能列出旧 helper 对 compact、snip、preservedSegment、tool sibling、tool result pairing 的影响。
- [x] 每个能力都有目标落点。
- [x] 没有开始改代码。

## CCTX-02 设计 reducer 输入、状态和输出

目标：在实现前固定 `currentContextReducer` 的语义，避免边改边猜。

任务：

- [x] 定义 reducer 输入：`classifiedTranscriptEvents`、ordered raw messages、diagnostics。
- [x] 定义 reducer 状态：当前上下文消息、待绑定工具调用、待绑定工具结果、compact 边界、诊断。
- [x] 定义 reducer 输出：`currentContextMessages`、`coreContextMessages`、诊断、必要 metadata。
- [x] 明确哪些事件能进入 current context，哪些只进入 diagnostics。

验收：

- [x] 设计能覆盖现有 smoke fixture。
- [x] 不需要 `parentUuid` 决定正常主线。
- [x] 不需要旧 helper 静默兜底。

## CCTX-03 迁移 compact / snip / preservedSegment 语义

目标：确保 reducer 产出的当前模型上下文仍符合 compact 后继续对话语义。

任务：

- [x] 迁移 compact boundary 对当前上下文的裁剪。
- [x] 保留 snip / preservedSegment 对模型上下文的必要修复。
- [x] 确认 UI 可见历史不受本阶段改动影响。
- [x] 补或调整 compact 相关 smoke。

验收：

- [x] compact 后 `currentContextMessages` 变小。
- [x] compact 前 UI 历史仍由 display replay / snapshot 保留。
- [x] compact + 并行工具组合不退化。

## CCTX-04 迁移并行工具 sibling / tool_result 补回能力

目标：把旧 helper 中对并行工具的补回能力迁入 reducer。

任务：

- [x] 按 `tool_use_id` / `toolUseId` / `toolCallId` 绑定 `tool_result`。
- [x] 使用 `sourceToolAssistantUUID` 作为来源 assistant sibling 的辅助绑定信息。
- [x] 支持同轮多个 `tool_use`。
- [x] 支持乱序返回的 `tool_result`。
- [x] 对孤立 `tool_result` 输出明确 diagnostic。

验收：

- [x] 同轮 tool_use A/B、tool_result B/A 乱序返回仍能进入当前上下文。
- [x] `tool_result` 不推进当前上下文尾部。
- [x] 孤立工具结果不会被当成普通用户消息。

## CCTX-05 接入主路径并移除静默兜底

目标：`conversationMaterialization.ts` 的 `currentContextMessages` 主路径不再调用 `buildConversationChain(...)`。

任务：

- [x] 将 reducer 输出接入 `MaterializedConversation.currentContextMessages`。
- [x] 保持 `MaterializedConversation.messages` 兼容字段等同 `currentContextMessages`。
- [x] 移除主路径对 `buildConversationChain(...)` 的调用。
- [x] 如果保留 legacy helper，只能作为显式诊断或非主路径工具，不能静默兜底。

验收：

- [x] 搜索确认 `conversationMaterialization.ts` 主路径不再调用 `buildConversationChain(...)`。
- [x] reducer 失败时返回明确 diagnostic。
- [x] Core resume 仍能把 `currentContextMessages` 写入 `threadMessages`。

## CCTX-06 补齐 smoke 回归

目标：把本次主链路统一固化成自动回归。

任务：

- [x] 覆盖普通恢复。
- [x] 覆盖 compact 后恢复。
- [x] 覆盖同轮并行工具 A/B。
- [x] 覆盖 tool_result 乱序返回。
- [x] 覆盖 compact + 并行工具组合。
- [x] 覆盖 sidechain 不进入主线。
- [x] 覆盖孤立 tool_result diagnostic。

验收：

- [x] `npm.cmd run typecheck`
- [x] `npm.cmd run build`
- [x] `npm.cmd run smoke:conversation-materialization`
- [x] `npm.cmd run smoke:app-server`
- [x] 必要时 `npm.cmd run smoke:desktop-display-events`
- [x] `git diff --check`

## CCTX-07 文档和发布说明收口

目标：让后续不会再把旧 helper 当主路径。

任务：

- [x] 更新本 todo 当前指针和完成记录。
- [x] 更新 Goal / todo 中的 ordered reducer 状态。
- [x] 更新 CHANGELOG。
- [x] 确认无新增长期规则，不需要补项目 `AGENTS.md`。

验收：

- [x] 文档明确 `buildConversationChain(...)` 已退出当前上下文主路径。
- [x] 文档明确 legacy helper 的保留边界。
- [x] 后续 snapshot counts / `thread/messages/list` 问题没有混入本专项。

## 后续记录（追加）

### 2026-05-28

- 新建本 todo，当前目标只锁定 `currentContextMessages` 主链路。
- 明确不处理 Desktop snapshot merge counts 和 `thread/messages/list` 兼容接口。
- CCTX-01 完成前的起始指针曾是“只读盘点旧 helper 能力”；本 todo 当前已完成并收口。
- CCTX-01 完成：确认旧 helper 在当前主路径中承担 parent walk、并行工具 sibling 和 `tool_result` 补回；compact / preservedSegment 裁剪已经由 `conversationMaterialization.ts` 先行应用。
- CCTX-02 到 CCTX-05 完成：`conversationMaterialization.ts` 新增 ordered current context reducer，按 transcript 物理顺序生成 `currentContextMessages`；同一主线 root 之后的消息进入当前上下文，新的主线 root 会切换当前段；tail 后只保留 attachment / system 附属上下文。
- `buildConversationChain(...)` 已退出 `currentContextMessages` 主路径；`sessionStorage.ts` 中该函数仍作为 legacy/native helper 保留给其它旧调用方，不作为本专项兜底。
- current context reducer 已增加显式工具配对过滤：无法匹配当前上下文段内已见 `tool_use` 的 `tool_result` 不进入 `currentContextMessages`，并记录 `orphan_tool_result_dropped_from_current_context` 诊断；对应内容仍保留在 `displayReplayEvents` 供 UI 展示和排查。
- CCTX-06 验证通过：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:desktop-display-events`、`git diff --check`。
- CCTX-07 完成：Goal、todo 和 CHANGELOG 已回写；未把 Desktop snapshot counts 或 `thread/messages/list` 兼容问题混入本专项。
