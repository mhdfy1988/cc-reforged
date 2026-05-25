# Goal: STD-HISTORY-09-1 会话物化源码入口核对

## 目标

在开始实现当前上下文物化前，先基于真实源码确认所有会影响恢复、展示、压缩和缓存的入口。

本 goal 的核心是避免凭文档或印象改恢复链路。实现前必须先知道哪些入口仍在选最长链，哪些入口已经有可复用逻辑，哪些入口属于原始 Claude Code 共享基线。

## 为什么先做这个

会话恢复问题跨越 Core、App Server、Desktop main、Renderer、transcript 读取和缓存。如果没有先核对入口，容易出现：

- Core resume 修了，但 App Server replay 还在独立选 leaf。
- 小文件 compact 修了，但大文件 `readTranscriptForLoad(...)` 路径语义又不同。
- 修复 compact 时破坏已有 snip / metadata / content replacement 读取。
- 为展示问题误改原始 Claude Code transcript 语义。

因此第一步必须只做源码核对和入口地图，不先动实现。

## 第一版范围

1. 核对 Core resume 入口：
   - `loadMessagesFromJsonlPath(...)`
   - `loadConversationForResume(...)`
   - `sessionCore.resumeThread(...)`
   - `context/status`
2. 核对 App Server 恢复展示入口：
   - `loadThreadResumeReplayPayload(...)`
   - `thread/resume`
   - `thread/messages/list`
   - `buildThreadDisplaySnapshot(...)`
3. 核对历史列表 / sidebar 入口：
   - `loadFullLog(...)`
   - session list / history lazy load 相关路径。
4. 核对状态语义入口：
   - `applyPreservedSegmentRelinks(...)`
   - `applySnipRemovals(...)`
   - `readTranscriptForLoad(...)`
   - `walkChainBeforeParse(...)`
5. 核对缓存和 compact 成功事件：
   - `getSessionMessages.cache`
   - 线程内存消息。
   - `context_compacted` 和 compact 成功卡片发出时机。

## 明确不做

- 不修改源码。
- 不设计最终类型。
- 不移动恢复逻辑。
- 不改原始 Claude Code transcript 语义。
- 不处理旧异常 transcript 兼容。

## 验收标准

- [x] 已列出每个入口的源码路径和当前行为。
- [x] 已标注仍在使用最长链 / 最新 leaf / fallback 的位置。
- [x] 已标注 compact、snip、sidechain、metadata、cache 的现有职责。
- [x] 已区分 CCR 适配层和原始 Claude Code 共享基线。
- [x] 已把核对结论同步到阶段 9 todo 或实现笔记。

## 建议验证命令

```powershell
npm.cmd run typecheck
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-09-2 物化协议定型](./2026-05-24-std-history-09-2-materialized-conversation-contract.md)。

## 执行结果

状态：已完成源码入口核对。

### 入口地图

| 入口 | 源码位置 | 当前行为 | 后续处理 |
| --- | --- | --- | --- |
| Core thread messages | `src/core/sessionCore.ts:137` | `listThreadMessages(...)` 直接返回线程内存消息。 | 后续 `thread/messages/list` 要以物化后的 Core 当前上下文为准。 |
| Core resume | `src/core/sessionCore.ts:182` | `resumeThread(...)` 调 `loadThreadResume(...)`，再把恢复 messages hydrate 到线程内存。 | 接入共享物化结果，避免 Core 自己选链。 |
| Core context status | `src/core/sessionCore.ts:395` | `getContextStatus(...)` 从线程内存消息计算 message count / token。 | 用来验证压缩后恢复仍是压缩后的上下文。 |
| Core compact | `src/core/sessionCore.ts:578` | `runCompact(...)` 先写 `postCompactMessages`，`await persistThreadMessages(...)` 后发 `context_compacted`。 | 后续验证持久化顺序和缓存一致性。 |
| Core compact boundary append | `src/core/sessionCore.ts:870` | `recordThreadMessage(...)` 遇到 `compact_boundary` 会持久化后裁剪内存，并发 `context_compacted`。 | 需要确认这条实时路径与手动 compact 语义一致。 |
| Transcript persistence | `src/core/sessionCore.ts:1050` | `persistThreadMessages(...)` 根据 head / length 判断增量或完整写入，并更新 `lastParentUuid`。 | 物化后的 canonical leaf 需要成为后续 parent。 |
| Path resume helper | `src/utils/conversationRecovery.ts:420` | `loadMessagesFromJsonlPath(...)` 遍历 leaf，使用 `tipChainLength` / timestamp 选链。 | 删除正常路径里的最长链选择，改用物化结果。 |
| Resume orchestrator | `src/utils/conversationRecovery.ts:466` | `loadConversationForResume(...)` 根据 path / session / log 进入不同读取路径。 | 作为 Core resume 的统一接入口接入物化。 |
| Compact relink | `src/utils/sessionStorage.ts:2058` | `applyPreservedSegmentRelinks(...)` 没有 `preservedSegment` 直接 return；malformed segment 也 return，导致不 prune。 | Goal 3 必须修复：无 segment 也 prune，malformed 不静默加载完整旧上下文。 |
| Snip relink | `src/utils/sessionStorage.ts:2203` | `applySnipRemovals(...)` 删除 snip removedUuids，并 relink survivor parent。 | 物化层必须保留这条能力。 |
| Transcript loader | `src/utils/sessionStorage.ts:3738` | `loadTranscriptFile(...)` 读取 messages 和 metadata maps；大文件可走 `readTranscriptForLoad(...)` / `walkChainBeforeParse(...)`。 | 物化层要复用现有读取副产品，不丢 metadata。 |
| Leaf calculation | `src/utils/sessionStorage.ts:3988` | compact relink 和 snip removals 后计算 `leafUuids`。 | 物化后再计算 main terminal / canonical leaf。 |
| Session log resume | `src/utils/sessionStorage.ts:4164` | `getLastSessionLog(...)` 使用最新非 sidechain message，并 priming `getSessionMessages.cache`。 | 属于最新 leaf 选择和缓存风险点。 |
| History sidebar / all logs | `src/utils/sessionStorage.ts:4903` | `loadAllLogsFromSessionFile(...)` 用 `keepAllLeaves: true` 遍历所有 leaf 生成 logs。 | 需与物化语义区分：sidebar 可列诊断，但普通恢复不能选最长。 |
| App Server messages list | `src/app-server/handlers/sessionHandlers.ts:56` | `thread/messages/list` 从 Core 当前线程消息构建 snapshot。 | 当前可复用，但 counts 要与物化结果保持一致。 |
| App Server resume | `src/app-server/handlers/sessionHandlers.ts:115` | `thread/resume` 先 `Core.resumeThread(...)`，再独立 `loadThreadResumeReplayPayload(...)`。 | 必须停止 Core / App Server 各读各的。 |
| App Server replay payload | `src/app-server/handlers/sessionHandlers.ts:189` | `loadThreadResumeReplayPayload(...)` 用 `keepAllLeaves: true` 后按 chain length / timestamp 选最长非 sidechain leaf。 | Goal 5 替换为共享物化结果。 |
| App Server fallback | `src/app-server/handlers/sessionHandlers.ts:242`、`src/app-server/handlers/sessionHandlers.ts:251` | leaf 缺失或读取失败时回退 Core 当前消息，并作为 warning diagnostic。 | Goal 6 收紧 fallback 边界，不能伪装普通恢复成功。 |

### 结论

- 仍在正常路径使用“最长链 / 最新 leaf”的核心位置是 `loadMessagesFromJsonlPath(...)`、`getLastSessionLog(...)`、`loadThreadResumeReplayPayload(...)`、`loadAllLogsFromSessionFile(...)`。
- compact 关键 bug 点是 `applyPreservedSegmentRelinks(...)` 在没有 `preservedSegment` 时直接 return，导致小文件完整读取路径不 prune；malformed preserved segment 也会 return，导致完整旧上下文静默回流。
- App Server 当前最大问题是 `thread/resume` 在 Core resume 之后又独立读取 transcript 选 leaf，展示 snapshot 与 Core 当前上下文可能不同。
- 现有可复用能力包括：`loadTranscriptFile(...)` 的 metadata maps、`applySnipRemovals(...)`、大文件 `readTranscriptForLoad(...)`、`buildThreadDisplaySnapshot(...)` 和 Renderer projection-only 路径。
- 本轮核对没有发现必须修改原始 Claude Code transcript 格式的需求；后续应在 CCR 读取 / 物化 / App Server 层收敛。
