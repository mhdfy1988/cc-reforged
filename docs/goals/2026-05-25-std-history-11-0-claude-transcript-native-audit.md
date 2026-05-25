# Goal: STD-HISTORY-11-0 Claude Code transcript 原生语义审计

## 目标

先确认 Claude Code 原生 transcript 的真实语义，再决定 CCR 适配层如何迁到 Codex-like 会话模型。

本 goal 解决的是“不要把原生存储语义误判成异常数据”的问题。它不做源码修改，只做源码审计和文档沉淀。

## 为什么先做这个

CCR 当前会话恢复问题不是单纯 UI 展示问题，而是物化层对 `parentUuid`、compact、并行工具和工具结果来源绑定的语义理解不完整。

如果没有审清 Claude Code 原生写入层，后续很容易继续把并行工具 DAG、`sourceToolAssistantUUID` 或 compact boundary 当成旧异常数据来补丁处理。

## 范围

1. 审计 transcript 增量写入和 parent 游标维护。
2. 审计 compact / snip / preservedSegment / legacy progress 的读写语义。
3. 审计 `sourceToolAssistantUUID` 和工具结果绑定来源。
4. 审计模型 API 对 `tool_use` / `tool_result` 配对的要求。
5. 把结论写入架构文档和实施计划。

## 明确不做

- 不修改 `sessionStorage.ts`、`messages.ts`、`query.ts`、`QueryEngine.ts`。
- 不改写 Claude Code 原始 transcript JSONL。
- 不开始迁移 `conversationMaterialization.ts` 主路径。
- 不删除 `buildConversationChain(...)`。

## 验收标准

- [x] 能解释为什么并行工具会形成 DAG。
- [x] 能解释为什么 `tool_result` 会指向不同 assistant sibling。
- [x] 能解释 compact boundary 为什么只截断当前模型上下文。
- [x] 能解释 current context 为什么仍要满足模型 API pairing。
- [x] 后续计划不再把 `sourceToolAssistantUUID` 当成脏数据。

## 完成结果

状态：已完成。

完成内容：

- 在 [session-semantics-codex-migration.md](../architecture/session-semantics-codex-migration.md) 增加“Claude Code transcript 原生语义边界”。
- 在 [session-semantics-codex-migration-plan.md](../stages/session-semantics-codex-migration-plan.md) 增加阶段 0 审计结论。
- 明确 Claude Code 原生层暂时只读：`sessionStorage.ts`、`messages.ts`、`query.ts`、`QueryEngine.ts` 不在本阶段修改。
- 明确 `buildConversationChain(...)` 有两类职责：leaf 选择要迁出正常路径；并行工具 sibling / tool_result 补回能力要保留或迁移。

## 完成后下一步

进入 [STD-HISTORY-11-1 物化层事件分类器](./2026-05-25-std-history-11-1-materialization-event-classifier.md)。
