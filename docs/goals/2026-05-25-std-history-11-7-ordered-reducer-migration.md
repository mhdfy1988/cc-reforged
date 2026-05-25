# Goal: STD-HISTORY-11-7 有序 reducer 迁移设计

## 目标

把过渡期仍依赖 parent walk 的上下文组装，设计成后续可迁移到 ordered event reducer 的清晰路径。

这个 goal 不是立刻推翻现有实现，而是把 CCR 适配层最终形态定义清楚：从 ordered transcript events 派生 current context、visible history、diagnostics 和 tool lifecycle。

## 为什么要做

只把 leaf 选择替换掉还不够。只要 current context 组装仍然散落在多个 helper 和兼容路径里，后续还可能继续出现“同一事实源，不同入口解释不同”的问题。

## 范围

1. 设计 `MaterializedConversationEvent`。
2. 设计 `MaterializedConversationModel`。
3. 明确 current context 从 ordered reducer 产出。
4. 明确 visible history 从同一 reducer 的展示投影产出。
5. 明确 `parentUuid` 只作为 source metadata 和 legacy diagnostic。
6. 明确 `buildConversationChain(...)` 退到 legacy helper 的条件。

## 明确不做

- 不改 Claude Code 原生 transcript 写入层。
- 不逐行复刻 Codex Rust 实现。
- 不把 Codex rollout 数据结构直接强塞进 CCR。
- 不在设计没通过前删除现有 parent walk helper。

## 验收标准

- [x] 文档能说明如何从当前过渡实现迁到 ordered reducer。
- [x] 后续不需要再引入新的 leaf / longest-chain 兜底。
- [x] current context 与 UI history 的边界清楚。
- [x] 该设计经过 Goal 1-6 的实现结果回填修订。

## 建议验证命令

```powershell
npm.cmd run typecheck
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-11-8 文档规则和发布说明收口](./2026-05-25-std-history-11-8-doc-rules-closeout.md)。

## 执行结果

状态：已完成。

完成内容：

- 在 [session-semantics-codex-migration.md](../architecture/session-semantics-codex-migration.md) 增加 “Ordered Reducer 目标模型”。
- 明确 `MaterializedConversationEvent` 的建议字段、来源信息和 `advancesMainTail` 语义。
- 明确 `MaterializedConversationModel` 作为 Core 和 App Server 的统一消费结果。
- 明确投影边界：Core 消费 current context，App Server 消费 display replay / snapshot，Renderer 只消费 snapshot / patch。
- 明确 `canonicalLeafUuid` 只是兼容字段，后续应退场。
- 明确 current context reducer、展示 reducer、legacy helper 退场步骤和回滚点。

验证：

- `git diff --check`：通过。
