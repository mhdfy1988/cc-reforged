# Goal: STD-HISTORY-09-4 Core resume 只消费物化结果

## 目标

让 Core 恢复继续对话时只消费共享 `MaterializedConversation`，不再自己从 transcript leaf 中计算最长链或最新链。

## 为什么先做这个

Core resume 决定下一轮真正发给模型的上下文。如果 Core 仍然用 `tipChainLength` 或最长链启发式，App Server 展示修得再好，压缩后切换回来仍可能把旧上下文送回模型。

Core 的正确行为应该是：拿到物化后的当前上下文，并用物化出的 canonical leaf 作为后续写入父节点。

## 第一版范围

1. 替换 `loadMessagesFromJsonlPath(...)` 的独立 leaf 选择。
2. `loadConversationForResume(...)` / resume 路径使用共享物化结果。
3. 删除正常路径里的 `tipChainLength` / 最长链优先。
4. 恢复后的 `lastParentUuid` 来自 canonical leaf。
5. `context/status` 看到的 message 数来自物化后的当前上下文。

## 明确不做

- 不让 Core 直接依赖 Renderer display item。
- 不把 App Server snapshot 反向作为 Core 事实源。
- 不更改 provider 历史协议。
- 不处理真实 Desktop 手工回归。

## 验收标准

- [x] Core resume 不再使用最长链选择作为正常策略。
- [x] 恢复后的上下文大小与物化结果一致。
- [x] 压缩后恢复不会把 boundary 前旧消息送回模型。
- [x] 新 turn 的第一条主线 user 消息接到 canonical leaf。
- [x] `context/status` 与物化消息数一致。

## 实施结果

Core 恢复入口已改为消费共享物化结果：

- `src/utils/conversationRecovery.ts` 的 `loadMessagesFromJsonlPath(...)` 不再读取 `leafUuids` 自己计算 `tipChainLength`，改为调用 `materializeConversationFromTranscript(...)`。
- `loadConversationForResume(...)` 在拿到 `LogOption` 后，如果存在 `fullPath`，优先重新物化 transcript；`loadFullLog(...)` 只保留为 metadata / 无路径兜底，不再作为 Core 当前上下文事实源。
- 物化结果的 `messages` 直接进入 Core thread memory，因此 `context/status` 的 message count 与恢复后的当前上下文一致。
- 恢复后的下一轮写入仍沿用 `getLastPersistedParentUuid(resumed.messages)`；由于 `resumed.messages` 已是物化链，第一条新 user 会接到 canonical leaf。

已扩展 `scripts/smoke-core-session-parent-chain.mjs`：磁盘 transcript 中保留 compact boundary 前旧消息，但 Core resume 后的 thread memory 只包含 boundary 后上下文；新 turn 的 user `parentUuid` 必须等于物化后的 assistant leaf。

## 验证结果

- `npm.cmd run typecheck` 通过。
- `npm.cmd run build` 通过。
- `npm.cmd run smoke:core-session-parent-chain` 通过。
- `npm.cmd run smoke:conversation-materialization` 通过。
- `git diff --check` 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:core-session-parent-chain
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-09-5 App Server 恢复展示消费同一物化结果](./2026-05-24-std-history-09-5-app-server-display-materialized-context.md)。
