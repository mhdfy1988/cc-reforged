# Goal: STD-HISTORY-12-4 conversationRecovery 边界定位

## 目标

明确 `conversationRecovery.ts` 是 CCR 统一恢复 facade，还是应拆出 Core/App Server 专用恢复入口。

本 goal 解决的是“恢复入口到底属于原生 util 还是 CCR fork 统一恢复层”的问题。

## 为什么要做

Desktop 历史恢复现在通过 App Server / Core 走第 3 层，但 `loadConversationForResume(...)` 位于 `src/utils/conversationRecovery.ts`。如果它继续作为所有入口共用恢复 facade，就必须明确这是 CCR fork 的统一恢复语义；如果不希望污染原始 util，就应拆出 CCR 专用入口。

## 范围

1. 列出 `loadConversationForResume(...)` 调用方。
2. 判断 CLI/TUI/Core/App Server 是否都应走第 3 层。
3. 如果保留在 `conversationRecovery.ts`，文档明确它是 CCR fork 的统一恢复 facade。
4. 如果拆出，设计 Core/App Server 专用恢复函数。

## 明确不做

- 不直接改变恢复入口行为。
- 不改变 Desktop `thread/resume` 协议。
- 不恢复“模型恢复一套读法、UI 展示另一套读法”。
- 不吞掉物化失败诊断。

## 验收标准

- [x] 恢复入口边界有明确结论。
- [x] 不再出现模型恢复一套读法、UI 展示另一套读法。
- [x] 失败诊断不退回泛化的 `Session transcript not found`。
- [x] 文档能说明 CLI/TUI/Core/App Server 的影响面。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:app-server
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-12-5 共享层必要修改保留清单](./2026-05-25-std-history-12-5-shared-layer-necessary-changes.md)。

## 执行结果

状态：已完成。

### 结论

保留 `src/utils/conversationRecovery.ts`，并明确它在 CCR fork 中就是统一恢复 facade。

理由：

1. CLI / TUI 的 `--continue`、`--resume` 已直接调用 `loadConversationForResume(...)`。
2. Core 的 thread resume 也直接调用 `loadConversationForResume(...)`。
3. App Server 历史展示 replay 直接调用 `materializeConversationFromTranscript(...)`，与恢复 facade 消费同一个第 3 层物化合同。
4. 如果拆出 Core/App Server 专用入口，反而容易回到“模型恢复一套读法、UI 展示另一套读法”的旧问题。

### 调用方清单

| 调用方 | 入口 | 语义 |
| --- | --- | --- |
| `src/cli/print.ts` | `--continue` | 从最近可恢复会话进入 `loadConversationForResume(undefined, undefined)`。 |
| `src/cli/print.ts` | `--resume <sessionId/jsonl>` | 解析 sessionId 或 jsonl path 后进入 `loadConversationForResume(...)`。 |
| `src/core/sessionCore.ts` | thread resume | Core 通过 `loadConversationForResume(...)` 恢复模型上下文。 |
| `src/utils/conversationRecovery.ts` | `loadMessagesFromJsonlPath(...)` | jsonl path 恢复直接消费 `materializeConversationFromTranscript(...)`。 |
| `src/utils/conversationRecovery.ts` | `materializeLogForResume(...)` | session log 恢复用物化结果覆盖 legacy `loadFullLog(...)` messages。 |
| `src/app-server/handlers/sessionHandlers.ts` | `loadThreadResumeReplayPayload(...)` | App Server 展示 replay 直接消费同一物化层的 `displayReplayEvents`。 |

### 边界定稿

- `conversationRecovery.ts` 是恢复 facade，不是原始 transcript reader。
- 原始 transcript reader 仍是 `sessionStorage.ts` / `loadTranscriptFile(...)`。
- 当前模型上下文由 `materializeConversationFromTranscript(...)` 的 `currentContextMessages` 决定。
- UI 历史 replay 由 `materializeConversationFromTranscript(...)` 的 `displayReplayEvents` 决定。
- `loadFullLog(...)` 只作为 legacy log hydration，不再决定 current tail。
- 失败诊断通过 `history_materialization_failed` 和 materialization diagnostics 传递，不退回泛化的 `Session transcript not found`。

### 源码注释

已在 `src/utils/conversationRecovery.ts` 的 `loadConversationForResume(...)` 注释中写明：

- 该模块是 CLI/TUI、Core、App Server initiated resume 的统一 facade。
- 恢复调用方必须消费这里的 materialized current-context contract。
- 不允许各自重新读 transcript chain。

### 验证记录

已执行：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:app-server
git diff --check
```

结果：全部通过。
