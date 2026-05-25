# Goal: STD-HISTORY-12-8 buildConversationChain helper 边界

## 目标

短期保留 `buildConversationChain(...)` 作为 helper，保留并行工具和 tool_result 补回能力，但不继续强化第 2 层。

本 goal 解决的是“降低一次性迁移风险，同时防止第 2 层继续变成恢复主路径”的问题。

## 为什么要做

`buildConversationChain(...)` 仍包含并行工具 sibling、tool_result 补回等模型 payload 正确性能力。直接删除风险高，但继续把 current tail、ordered/rawIndex、UI replay 塞进去会扩大边界混乱。

## 范围

1. 明确 `buildConversationChain(...)` 当前仍被第 3 层临时复用的能力。
2. 禁止它决定 current tail。
3. 禁止新增 UI replay / ordered/rawIndex / currentContextTail 相关职责。
4. 设计后续 ordered reducer 完全替代 helper 的路径。

## 明确不做

- 不立刻重写全部并行工具补回逻辑。
- 不删除 tool_result 配对保护。
- 不恢复 longest-chain / latest leaf 兜底。
- 不让 helper 输出 UI 展示 projection。

## 验收标准

- [x] 第 2 层只作为 helper，不是恢复主路径。
- [x] 并行工具和 tool_result 不丢失。
- [x] 文档能说明 helper 退场条件。
- [x] 第 3 层 current tail 不依赖 helper 决定。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-12-9 smoke 回归覆盖](./2026-05-25-std-history-12-9-smoke-regression-coverage.md)。

## 执行结果

状态：已完成。

### 当前调用点

| 调用点 | 当前用途 | 是否恢复主路径 |
| --- | --- | --- |
| `src/utils/conversationMaterialization.ts` | 第 3 层已经先通过 classified ordered events 解析 `currentContextTail`，再调用 helper 重建模型 payload 链，并复用并行 tool sibling / tool_result 补回。 | 是第 3 层内部临时 helper，不负责选 tail。 |
| `src/utils/sessionStorage.ts` 的 `loadTranscriptFromFile(...)` | legacy 文件导入 / TUI 日志转换。 | 否。 |
| `src/utils/sessionStorage.ts` 的 `loadLastSessionLog(...)` | legacy REPL/TUI 最近会话日志。 | 否，CCR Desktop/App Server 恢复已走第 3 层。 |
| `src/utils/sessionStorage.ts` 的 agent transcript 读取 | agent / sidechain 辅助读法。 | 否。 |
| `src/utils/sessionStorage.ts` 的 session history list | 生成历史列表候选和预览。 | 否。 |

### 源码边界已补

已在 `src/utils/sessionStorage.ts` 的 `buildConversationChain(...)` JSDoc 写明：

- caller 必须先选择好 leaf/tail。
- helper 只允许重建 parent 链和恢复 orphaned parallel tool sibling / tool_result。
- helper 不允许决定 CCR current context tail。
- helper 不允许暴露 ordered/rawIndex。
- helper 不允许生成 UI replay projection。

已在 `src/utils/conversationMaterialization.ts` 调用点写明：

- `currentContextTail` 已经由第 3 层 ordered materialized events 解析完成。
- `buildConversationChain(...)` 只是临时 chain rebuild / parallel-tool recovery helper。

### 保留能力

短期必须保留：

1. parentUuid 反向链重建。
2. parent 链 cycle 诊断。
3. `recoverOrphanedParallelToolResults(...)` 对同一个 assistant `message.id` 下 sibling tool_use 的补回。
4. 旧 progress-fork transcript 里的 tool_result 补回。

这些是模型 payload 正确性能力，不是 UI 展示能力。

### 禁止新增职责

后续不得再向 `buildConversationChain(...)` 增加：

- longest-chain / latest leaf 选择。
- current context tail 解析。
- transcript `rawIndex` / ordered view。
- display replay / Desktop UI projection。
- compact boundary 当前上下文裁剪策略。

如果后续出现恢复异常，应优先在 `conversationMaterialization.ts` 的 ordered reducer / classifier / diagnostics 中解决，而不是增强第 2 层 helper。

### 退场条件

`buildConversationChain(...)` 可以从第 3 层退场的条件：

1. 第 3 层 ordered reducer 能按 JSONL 物理顺序生成 current context message list。
2. ordered reducer 能按 `tool_use_id` / `sourceToolAssistantUUID` 补回并行 tool_result。
3. ordered reducer 能覆盖旧 progress-fork fixture。
4. smoke 固化普通恢复、并行工具、tool_result 乱序、compact 后恢复、legacy 多 leaf 诊断。

在这些条件满足前，helper 可以保留，但只能作为第 3 层内部临时 helper。

### 验证记录

本 goal 只补源码边界注释和文档，不改变 runtime 行为。已通过：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
git diff --check
```
