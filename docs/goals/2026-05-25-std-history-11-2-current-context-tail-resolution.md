# Goal: STD-HISTORY-11-2 当前上下文尾部解析

## 目标

正常恢复路径不再通过 `getCanonicalMainLeaf(...)`、terminal leaves 或最长链决定当前上下文尾部。

当前尾部应来自 ordered classified events：最后一个可推进当前会话的用户输入或助手回复。

## 为什么要做

并行工具结果、compact boundary、sidechain sibling 和系统辅助事件都可能出现在 transcript parent 图里。如果继续用 leaf 选择主线，恢复逻辑会把原生 DAG 或辅助事件误判成多个主线。

## 范围

1. 新增 `resolveCurrentContextTail(...)` 或等价函数。
2. 输入使用 Goal 1 的 ordered classified events。
3. 输出 `currentContextTailUuid`、tail event、诊断信息。
4. `getCanonicalMainLeaf(...)` 降级为异常诊断工具，不参与正常恢复。
5. 对外兼容字段如 `canonicalLeafUuid` 如暂时保留，必须明确它不再表示 graph leaf。

## 明确不做

- 不删除 `buildConversationChain(...)`。
- 不为了旧异常 transcript 恢复最长链兜底。
- 不把 `tool_result`、compact boundary、sidechain 当普通 tail。
- 不改 UI 展示协议。

## 验收标准

- [x] 并行工具结果 sibling 不会触发普通恢复失败。
- [x] 当前上下文尾部不会是 `tool_result`。
- [x] 当前上下文尾部不会是 compact boundary。
- [x] 当前上下文尾部不会是 sidechain 或系统辅助事件。
- [x] 真实失败样本可以完成物化，不再报 `multiple_main_leaves`。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:conversation-materialization
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-11-3 当前上下文组装过渡护栏](./2026-05-25-std-history-11-3-context-assembly-transition-guard.md)。

## 执行结果

状态：已完成。

完成内容：

- 新增 `resolveCurrentContextTail(...)`，从 `classifiedTranscriptEvents` 逆序寻找最后一个可推进当前上下文的用户输入或助手回复。
- `MaterializedConversation` 新增 `currentContextTailUuid` 和 `currentContextTailEvent`。
- `canonicalLeafUuid` 保留为兼容字段，但语义改为等同 `currentContextTailUuid`，不再表示 parent graph leaf。
- 正常恢复路径不再调用 leaf 选择决定是否成功。
- 旧 parent leaf 判断降级为 `legacy_multiple_main_leaves_diagnostic`，只做 warning 诊断，不阻断恢复。
- 新增 `current_context_tail_resolved` 诊断，记录 tail UUID、事件类型、`rawIndex` 和 `materializedIndex`。
- smoke 将原 `multiple_main_leaves` 失败用例改为 tail 解析成功用例，确认恢复不再被多个旧 leaf 候选阻断。

验证：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:conversation-materialization`：通过。
- `git diff --check`：通过。
