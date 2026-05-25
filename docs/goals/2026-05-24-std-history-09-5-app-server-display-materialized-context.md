# Goal: STD-HISTORY-09-5 App Server 恢复展示消费同源物化语义

## 目标

让 App Server 的 `thread/resume`、`thread/messages/list` 和历史 sidebar 路径使用同一个 transcript 解释层，不再独立读取 transcript 后选择最长非 sidechain leaf。

2026-05-24 再校准：这个目标不能理解成“App Server 展示直接使用 Core 当前模型上下文 messages”。Core 当前模型上下文压缩后应该变小；App Server 可见历史展示应使用独立 display projection，不能因为模型上下文压缩就丢掉压缩前可见记录。

## 为什么先做这个

之前 UI 与上下文不一致的根源之一是 Core 和 App Server 各读各的。Core 可能已有当前压缩上下文，App Server replay 又重新从 raw transcript 选一条展示链，导致：

- 页面切换后展示和真实上下文不同。
- 恢复提示计数和可见消息不一致。
- `displaySnapshot.counts.coreContextMessages` 不是 Core 当前上下文数量。

App Server 可以继续负责 rich projection 和 snapshot，但不能重新决定当前上下文。

## 第一版范围

1. 替换 `loadThreadResumeReplayPayload(...)` 的 `keepAllLeaves: true` + 最长链选择。
2. `thread/resume` snapshot 使用共享 transcript 解释层提供的 canonical leaf / diagnostics。
3. `thread/messages/list` 必须明确自己返回当前模型上下文还是可见历史，不能再混用 `messages` 语义。
4. `loadFullLog(...)` 等历史列表懒加载路径同步物化语义。
5. `ThreadDisplaySnapshot.counts.coreContextMessages` 使用 Core 物化上下文数量。

## 明确不做

- 不让 Renderer 解释 transcript。
- 不重新启用旧 `messages` replay fallback。
- 不恢复普通成功提示里的数量展示。
- 不把 raw transcript events 当成 visible timeline items。

## 验收标准

- [x] App Server replay 不再独立选最长 leaf。
- [x] `thread/resume` 和 `thread/messages/list` 不再独立选 leaf。
- [x] history sidebar 不制造与恢复不同的链路口径。
- [x] `coreContextMessages` 与 Core 当前上下文一致。
- [x] Renderer 仍只消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`。
- [x] App Server 可见历史 display projection 与 Core 当前模型上下文拆分。

## 实施结果

App Server 恢复展示已改成同源物化：

- `src/app-server/handlers/sessionHandlers.ts` 的 `loadThreadResumeReplayPayload(...)` 不再 `keepAllLeaves: true` 后独立选最长 leaf，改为调用 `materializeConversationFromTranscript(...)`。
- `thread/resume` 的可展示 messages 曾改为使用 Core 当前 thread messages，避免恢复展示和真实上下文分叉；2026-05-24 复审确认这只适合 currentContext，不适合作为完整 UI 历史展示来源。
- 复审修正后，`thread/resume` 的 `messages` / `displaySnapshot` 改为使用 transcript display replay；Core 当前 thread messages 只作为 `coreContextMessages` 计数来源和继续对话上下文。
- snapshot 的 `rawTranscriptEvents`、`canonicalLeafUuid`、diagnostics 来自物化结果；`coreContextMessages` 使用 Core 当前消息数。
- `thread/messages/list` 仍直接读取 Core 当前 thread messages，语义定位为当前模型上下文兼容接口；Desktop 完整可见历史主路径使用 `thread/resume.displaySnapshot`。
- `src/utils/sessionStorage.ts` 的 `loadFullLog(...)` 不再使用最长链优先；物化后必须只有一个主线 leaf，多主 leaf 不再静默选最长。
- `loadTranscriptFile(...)` 底层 compact 读取语义同步收紧：普通 compact 无 `preservedSegment` 也从 currentContext 裁剪 boundary 前旧消息；malformed segment 只跳过 relink，但仍裁剪最新 boundary 前的 currentContext 旧消息。

`scripts/smoke-app-server.mjs` 已更新为 `snapshot_materialized_resume` 与 `thread/resume_history_messages`：自动验证同时断言 Core 当前上下文不含 compact 前旧消息、`thread/resume` / `ThreadDisplaySnapshot` 仍能展示 compact 前后完整可见历史。

## 2026-05-24 复审修正

重新对照 Codex / OpenClaw 源码后，上面的实施结果只能算“消除了 App Server 独立选链”，不能算“展示恢复最终正确”。原因是：Core 当前 thread messages 是压缩后的模型上下文，不是完整可见历史。继续把它作为 `ThreadDisplaySnapshot` 的历史展示输入，会导致压缩前可见消息在恢复后消失。

后续修正已完成：

1. 保留本目标已完成的部分：App Server 不再独立按最长链选 leaf，canonical leaf / counts / diagnostics 继续来自共享 transcript 解释层。
2. 新增 display projection：`thread/resume` / `ThreadDisplaySnapshot` 从 transcript / display events 生成可见历史项。
3. Core resume 继续消费压缩后的 `currentContextMessages`，确保上下文大小不会切换会话后回到压缩前。
4. `thread/messages/list` 需要重新定语义：如果它返回 Core 当前 messages，就不应该被 Desktop 主路径当完整历史展示使用。

## 验证结果

- `npm.cmd run typecheck` 通过。
- `npm.cmd run build` 通过。
- `npm.cmd run smoke:app-server` 通过。
- `npm.cmd run smoke:desktop-session-state` 通过。
- `npm.cmd run smoke:conversation-materialization` 通过。
- `npm.cmd run smoke:core-session-parent-chain` 通过。
- `git diff --check` 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:app-server
npm.cmd run smoke:desktop-session-state
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-09-6 异常只诊断不伪装成功](./2026-05-24-std-history-09-6-diagnostics-not-fallback.md)。
