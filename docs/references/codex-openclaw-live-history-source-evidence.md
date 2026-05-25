# Codex / OpenClaw 实时与历史恢复源码证据索引

本文只记录源码证据和从源码得到的行为结论，供 [CCR 历史恢复与实时展示统一协议](../architecture/realtime-history-display-contract.md) 引用。后续不要每次重新追完整源码；先读本文，只有实现细节变化时再回到源仓库核对。

## 本机源码位置

| 项目 | 路径 |
| --- | --- |
| Codex Rust | `D:/learn_code/codex-rust-v0.131.0` |
| OpenClaw | `D:/learn_code/openclaw-2026.5.18` |

## 2026-05-24 再校准：模型上下文和可见历史不是同一个结果

这次重新核对源码后，需要修正一个容易误导的旧口径：Codex 和 OpenClaw 都不是把“压缩后的当前模型上下文”直接当成“历史 UI 可见记录”。它们的共同点是：

```text
持久化 transcript / rollout
-> 生成给模型继续对话的当前上下文
-> 生成给 UI 展示的历史/实时投影
```

这两个结果同源，但语义不同：

- **当前模型上下文**：压缩后应该变小，通常是 `压缩摘要 + 压缩后新消息`，用于下一轮模型调用。
- **可见历史展示**：用于用户回看时间线，不应该因为模型上下文压缩就默认丢掉压缩前的可见历史。
- **压缩卡片 / compact marker**：可以作为展示项或分隔标记存在，但它不是“删除 UI 历史”的命令。

因此，CCR 后续不能再把 `MaterializedConversation.messages` 一路拿去替代所有展示历史。更准确的目标是：同一个 transcript 事实源下，分别产出 `currentContextMessages` 和 `displayReplayItems`；它们共享 compact / snip / sidechain 的解释规则，但输出对象和保留范围不同。

## Codex 证据

### 持久化事实源

`codex-rs/rollout/src/recorder.rs`

- `RolloutRecorder` 写 canonical session rollout items 到 JSONL：`64-77`。
- `record_canonical_items(...)` 把 `RolloutItem` 入队写入：`756-768`。
- `load_rollout_items(...)` 从 rollout JSONL 读取并解析 `RolloutItem`：`812-835`。

结论：Codex 历史恢复的事实源是 rollout JSONL / thread store 中的持久化 `RolloutItem`，不是 UI 内存状态。

### 历史恢复展示模型

`codex-rs/app-server-protocol/src/protocol/thread_history.rs`

- `build_turns_from_rollout_items(...)` 把 `RolloutItem` 转成 `Turn`：`74-84`。
- `ThreadHistoryBuilder.handle_event(...)` 是“persisted rollout replay”和“in-memory current-turn tracking”共用 reducer：`158-163`。
- `handle_rollout_item(...)` 统一处理 `EventMsg`、`Compacted`、`ResponseItem`、`TurnContext`、`SessionMeta`：`228-236`。

`codex-rs/app-server/src/request_processors/thread_processor.rs`

- `load_persisted_thread_for_read(...)` 读取 thread store，并在需要时用 rollout items 构建 `thread.turns`：`1995-2016`。
- `thread/turns/list` 为了 rollback / compaction，每次仍重放完整 rollout，并合并运行中 active turn：`2106-2120`。
- `thread_resume_inner(...)` 是 `thread/resume` 主入口：`2304` 起。
- resume 后自动 attach listener：`2480-2491`。
- resume 响应返回 `ThreadResumeResponse { thread, ... }`：`2545-2561`。

结论：Codex 历史恢复不是把 rollout 原样丢给 UI，而是先构建 `Turn / ThreadItem` 展示模型，再给客户端。

### 实时展示链路

`codex-rs/app-server/src/thread_state.rs`

- `ThreadState` 持有 `current_turn_history: ThreadHistoryBuilder`：`70-83`。
- `track_current_turn_event(...)` 把实时 `EventMsg` 喂给同一个 `ThreadHistoryBuilder.handle_event(...)`，并在 terminal event 后 reset：`130-145`。

`codex-rs/app-server/src/request_processors/thread_lifecycle.rs`

- `ensure_conversation_listener(...)` attach 到 running thread：`137-185`。
- listener 从 `conversation.next_event()` 获取实时事件，并先更新 `ThreadState`：`284-299`。
- 随后调用 `apply_bespoke_event_handling(...)` 把 core event 翻译为 app-server notification：`323-334`。

`codex-rs/tui/src/app/thread_routing.rs`

- resume 初始 turns 进入 `chat_widget.replay_thread_turns(...)`：`1038-1066`。
- 实时 notification 进入 `chat_widget.handle_server_notification(...)`：`1368-1378`。

`codex-rs/tui/src/chatwidget/replay.rs`

- 文件注释明确 replay 是把 turns/items 重新灌入 transcript state，同时避免 live-only side effects：`1-14`。

`codex-rs/tui/src/chatwidget/protocol.rs`

- `handle_server_notification(...)` 处理 `TurnStarted`、`TurnCompleted`、`ItemStarted`、`ItemCompleted`、`AgentMessageDelta` 等实时通知：`54-75`。
- turn completed 根据 replay kind 避免触发不该触发的 live side effects：`244-285`。

结论：Codex 的历史和实时入口不同，但展示层收敛到同一套 `Turn / ThreadItem / ChatWidget` 处理体系。历史是 replay，实时是 notification；共同点是使用统一展示模型和 shared reducer。

### 压缩后的模型上下文恢复

`codex-rs/core/src/compact.rs`

- 压缩完成后构造 `CompactedItem { message, replacement_history }`：`279-283`。
- `replace_compacted_history(...)` 把 `replacement_history` 写回 session history，同时持久化 `RolloutItem::Compacted`：`2579-2595`。

`codex-rs/core/src/session/rollout_reconstruction.rs`

- 注释明确：找到最新 surviving `replacement_history` checkpoint 后，更旧 rollout items 不再影响 rebuilt history：`60-66`。
- 恢复时从后往前扫描 rollout，遇到带 `replacement_history` 的 `Compacted` 后，把它作为 base history，只 replay 之后的 suffix：`87-130`、`234-244`。

结论：Codex 恢复给模型的当前上下文时，会从最新压缩 checkpoint 开始；压缩前旧消息不再作为模型上下文原文参与下一轮。

### 历史展示没有直接使用压缩后的模型上下文

`codex-rs/app-server-protocol/src/protocol/thread_history.rs`

- `build_turns_from_rollout_items(...)` 仍从 persisted `RolloutItem` 构建 UI turns：`74-84`。
- `handle_compacted(...)` 只把 persisted compaction marker 记到当前 turn，避免 compaction-only legacy turn 被丢弃：`969-976`。

`codex-rs/app-server/src/request_processors/thread_processor.rs`

- `thread/turns/list` 注释明确：分页接口仍每次 replay entire rollout，因为 rollback / compaction events 可能改变 earlier turns：`2106-2110`。

结论：Codex 的“模型上下文恢复”和“历史 UI 展示”是两种投影。压缩影响模型上下文，但 App Server 历史展示仍从 rollout 重放成 turns。

## OpenClaw 证据

### Gateway 方法与事件协议

`src/gateway/methods/core-descriptors.ts`

- session 相关：`sessions.list`、`sessions.subscribe`、`sessions.messages.subscribe` 等：`124-128`。
- chat 相关：`chat.history`、`chat.abort`、`chat.send`：`188-190`。

`src/gateway/protocol/schema/logs-chat.ts`

- `ChatHistoryParamsSchema` 包含 `sessionKey`、`limit`、`maxChars`：`25-31`。
- `ChatSendParamsSchema` 包含 `sessionKey`、`message`、`attachments`、`idempotencyKey` 等：`35-52`。
- `ChatDeltaEventSchema`、`ChatFinalEventSchema`、`ChatAbortedEventSchema`、`ChatErrorEventSchema` 定义 WebSocket chat event：`88-139`。

`src/gateway/protocol/schema/sessions.ts`

- `SessionsMessagesSubscribeParamsSchema` / `SessionsMessagesUnsubscribeParamsSchema` 只需要 session key：`154-166`。

结论：OpenClaw 的历史查询、实时发送、session message 订阅是明确分开的协议入口。

### 历史恢复数据源

`src/gateway/server-methods/chat.ts`

- `chat.history` handler 从 `sessionKey` 加载 session entry：`1801-1819`。
- 读取最近 session messages：`1827-1833`。
- 通过 `projectRecentChatDisplayMessages(...)` 做展示投影，并应用 `maxChars` / `maxMessages`：`1839-1845`。
- 对超大消息做替换、预算裁剪，最后 respond `messages`：`1846-1886`。

`ui/src/ui/controllers/chat.ts`

- `loadChatHistory(...)` 调 `state.client.request("chat.history", { sessionKey, limit, maxChars })`：`304-328`。
- 响应后过滤隐藏项，写入 `state.chatMessages`，并清空流式状态和工具流状态，避免重复：`349-359`。

结论：OpenClaw 的历史恢复入口是 `chat.history`，返回的是已经投影过、裁剪过的 display messages，而不是完整 raw transcript。

### 实时展示数据源

`ui/src/ui/controllers/chat.ts`

- `sendChatMessage(...)` 先 optimistic append 用户消息，再设置 `chatRunId`、`chatStream`、`chatStreamStartedAt`：`483-566`。
- `requestChatSend(...)` 调 `chat.send`，传 `sessionKey`、`sessionId`、`message`、`idempotencyKey`：`416-431`。
- `handleChatEvent(...)` 中 `delta` 更新 `chatStream`，`final` 追加 assistant message 到 `chatMessages`，`aborted/error` 更新对应状态：`661-758`。

`ui/src/ui/app-gateway.ts`

- `GatewayBrowserClient` 通过 `onEvent` 收 WebSocket 事件：`523-636`。
- terminal chat event 根据是否有 tool events 决定是否 reload history，再 reset tool stream：`666-713`。
- `event === "chat"` 进入 `handleChatGatewayEvent(...)`：`744-794`。
- `event === "session.message"` 触发 active session 的 `loadChatHistory(...)`，运行中则 deferred：`796-823`。
- `event === "agent"` 进入 live tool / agent event 处理：`863-870`。

`ui/src/ui/app-tool-stream.ts`

- `ToolStreamHost` 持有 `chatStreamSegments`、`toolStreamById`、`chatToolMessages`：`42-56`。
- `resetToolStream(...)` 清空 live tool state 和 stream segments：`349-357`。
- tool event 到达时可把当前 `chatStream` 转入 `chatStreamSegments`，并同步 `chatToolMessages`：`636-729`。

`src/gateway/server-chat.ts`

- `emitChatDelta(...)` 合并 assistant 文本，广播 `event: "chat"`、`state: "delta"`：`471-530`。
- `emitChatFinal(...)` 广播 `event: "chat"`、`state: "final"` 或 `state: "error"`：`602-658`。
- assistant stream event 会触发 `emitChatDelta(...)`：`953-960`。

`src/gateway/server-runtime-subscriptions.ts`

- Gateway 订阅 agent event、transcript update、session lifecycle event：`13-27`、`85-99`。

`src/gateway/server-session-events.ts`

- transcript update handler 给 session message subscribers 广播 `session.message`：`87-152`。

`src/gateway/server-methods/sessions.ts`

- `sessions.messages.subscribe` / `unsubscribe` 维护 session message subscribers：`1026-1070`。

结论：OpenClaw 实时展示依赖 WebSocket `chat` / `agent` / `session.message`。实时期间维护 UI 临时态；完成或 session message 到达后，再通过 `chat.history` 让持久化历史接管。

### UI 合并展示

`ui/src/ui/views/chat.ts`

- `renderChat(...)` 调 `buildChatItems(...)`，传入 `messages`、`toolMessages`、`streamSegments`、`stream`：`1023-1033`。

`ui/src/ui/chat/build-chat-items.ts`

- `BuildChatItemsProps` 明确包含 `messages`、`toolMessages`、`streamSegments`、`stream`：`13-23`。
- 历史消息会过滤心跳、隐藏工具结果，并按 `CHAT_HISTORY_RENDER_LIMIT` / `CHAT_HISTORY_RENDER_CHAR_BUDGET` 裁剪：`419-485`。
- `streamSegments`、`toolMessages`、当前 `stream` 会被追加为展示项，最后排序分组：`552-592`。

结论：OpenClaw UI 不是单一消息数组。它把历史消息、实时流、工具流、完成流片段合并成最终可见项。因此 raw 数量和可见数量天然可能不同。

### 上下文引擎中的模型上下文和压缩结果

`src/context-engine/types.ts`

- `AssembleResult.messages` 明确是 `Ordered messages to use as model context`：`6-8`。
- `assemble(...)` 返回的是 ready for the model 的 messages：`278-296`。
- `CompactResult` 返回 `summary`、`firstKeptEntryId`、`tokensBefore`、`tokensAfter`，必要时还返回压缩后的 `sessionId` / `sessionFile`：`47-61`。

`src/agents/cli-runner/session-history.ts`

- `loadCliSessionHistoryMessages(...)` 只从 entries 里取原始 `message`，用于历史类读取：`269-280`。
- `loadCliSessionContextEngineMessages(...)` 则找最新 `compaction`，返回 `compactionSummary + tailMessages`：`283-324`。

结论：OpenClaw 也把“历史消息读取”和“上下文引擎消息读取”分开；压缩后的上下文不是完整历史。

### active leaf 不是最长链

`src/agents/pi-embedded-runner/transcript-file-state.ts`

- `TranscriptFileState` 维护当前 `leafId`：`433-441`、`453-461`。
- `getBranch(...)` 从当前 leaf 沿 `parentId` 往上走，再 reverse 得到当前 branch：`497-505`。
- `appendCompaction(...)` 把 compaction 作为当前 leaf 的后继 entry 追加：`554-572`。

结论：OpenClaw 的当前链来自明确 leaf 指针，不是扫描所有 leaf 后选最长。

### 手动压缩边界是明确 checkpoint

`src/agents/pi-embedded-runner/manual-compaction-boundary.ts`

- 注释明确：手动 `/compact` 是显式 checkpoint，重建上下文应从 summary 自己开始，避免旧 recent tail 继续存活：`28-31`。
- `hardenManualCompactionBoundary(...)` 会在满足条件时把最新 compaction 的 `firstKeptEntryId` 改成 compaction 自己，并返回 rebuilt session context：`72-145`。

`src/agents/pi-embedded-runner/compaction-successor-transcript.ts`

- 当配置启用 `truncateAfterCompaction` 时，会生成 successor transcript，并用 `parentSession` 指回原 transcript：`32-87`。
- successor entries 会移除已被 summary 覆盖的 message entries，并重接 parentId：`110-145`。

结论：OpenClaw 如果真的裁掉旧消息，也是通过明确 checkpoint / successor transcript 表达，不是在同一个普通历史展示里悄悄把压缩前可见记录当作不存在。

## 对 CCR 的直接结论

1. 历史和实时可以有不同数据源。
2. Renderer 前必须统一为同一套展示协议。
3. 历史恢复用全量 `ThreadDisplaySnapshot`。
4. 实时展示用增量 `ThreadDisplayPatch`。
5. 两者必须复用同一 reducer/projector，避免 Desktop 分别猜 transcript 和 live event。
6. 实时临时态必须能在完成后落回 transcript；刷新页面后从 transcript 重建出的可见时间线应与实时结束时一致。
7. UI 数量必须区分 raw transcript events、Core context messages、visible timeline items、hidden timeline items。
8. 普通历史恢复没有“短链”概念；sidechain、fork/branch 必须是显式实体。
9. 当前模型上下文和可见历史展示不能混用：压缩后的 Core context 应该变小，但历史展示不能因此默认丢掉压缩前可见记录。

## 2026-05-24 CCR 阶段 9 实施证据

本节记录本轮实现后的 CCR 关键源码落点，后续先看这里再追代码：

- `src/utils/conversationMaterialization.ts`
  - `materializeConversationFromTranscript(...)` / `materializeConversationFromLoadedTranscript(...)` 是共享物化入口。
  - `applyCompactMaterialization(...)` 处理普通 compact、live / stale / malformed `preservedSegment`。
  - `getCanonicalMainLeaf(...)` 在物化后计算唯一主线 leaf；多个 main leaf 输出 `multiple_main_leaves` diagnostic。
- `src/utils/sessionStorage.ts`
  - `applyPreservedSegmentRelinks(...)` 无 `preservedSegment` 时也按最后 compact boundary 裁剪 currentContext。
  - malformed `preservedSegment` 不再导致完整旧上下文回流。
  - `loadFullLog(...)` 不再用最长链优先；多个主线 leaf 不进入普通恢复成功路径。
- `src/utils/conversationRecovery.ts`
  - `loadMessagesFromJsonlPath(...)` 调用 `materializeConversationFromTranscript(...)`。
  - `loadConversationForResume(...)` 优先从 transcript `fullPath` 物化当前上下文。
- `src/app-server/handlers/sessionHandlers.ts`
  - `loadThreadResumeReplayPayload(...)` 调用共享物化入口，不再 `keepAllLeaves` 后选最长 leaf。
  - `thread/resume` 展示消息曾来自 Core 当前 thread messages，counts / canonical leaf / diagnostics 来自物化结果；复审确认这只解决了 currentContext 同源，不应作为完整 UI 历史展示的最终方案。
- `src/core/sessionCore.ts`
  - 手动 compact 只有持久化成功后才发 `context_compacted`。
  - 持久化失败恢复 compact 前内存并抛 `compact_failed`。
  - 流式 compact boundary 只有持久化成功后才裁剪 Core 内存上下文和发成功事件。
- `scripts/smoke-conversation-materialization.mjs`
  - 覆盖普通 compact 小/大 transcript、live / stale / malformed `preservedSegment`、snip、sidechain、多 main leaf。
- `scripts/smoke-core-session-parent-chain.mjs`
  - 覆盖 compact 后恢复写入，新 user 接到物化后的 canonical leaf。
- `scripts/smoke-app-server-context-state.mjs`
  - 覆盖 compact boundary 对 currentContext 的裁剪、`context_compacted`、`context/status`。

## 2026-05-24 补充：压缩后的当前上下文物化

本节补充压缩 / 恢复一致性证据，详细修复方案见 [CCR 当前上下文物化修复方案](../architecture/session-context-materialization-repair.md)。

### Codex

`codex-rs/app-server-protocol/src/protocol/thread_history.rs`

- `ThreadHistoryBuilder.handle_event(...)` 注释明确它是 persisted rollout replay 和 in-memory current-turn tracking 共用 reducer：`158-163`。
- `handle_rollout_item(...)` 统一处理 `EventMsg`、`Compacted`、`ResponseItem`、`TurnContext`、`SessionMeta`：`228-233`。
- `handle_context_compacted(...)` 把实时 compact event 投影成 `ThreadItem::ContextCompaction`：`844-848`。
- `handle_compacted(...)` 把持久化 compaction marker 记到当前 turn，避免 compaction-only legacy turn 被丢弃：`974-978`。
- `handle_thread_rollback(...)` 明确按事件截断 turns，而不是靠 leaf 长短猜测：`980` 附近。

`codex-rs/app-server/src/request_processors/thread_processor.rs`

- `thread/turns/list` 注释说明为了 rollback / compaction，每次仍 replay entire rollout：`2086-2107`。
- `thread_resume_inner(...)` 是普通 resume 入口：`2304`。
- `thread_fork_inner(...)` 是显式 fork 入口：`3001`。
- fork 用 `fork_thread_from_history(...)` 创建新 thread，并返回 `forked_from_id`：`3108`、`3170`。

结论：Codex 把 compaction / rollback 当成 rollout 里的状态事件 replay，不把历史恢复降级成“找最长链”。fork 是显式新 thread。

### OpenClaw

`src/gateway/server-methods/sessions.ts`

- `sessions.compact` 是明确 API：`2201`。
- 手动 compact 调用 `compactEmbeddedPiSession(...)`：`2292`。
- compact 成功后更新 session store 的 `sessionId` / `sessionFile`：`2340-2344`。
- checkpoint branch / restore 是显式接口：`1524`、`1614`。

`src/agents/pi-embedded-runner/compact.ts`

- 压缩前捕获 checkpoint snapshot：`1006`。
- 压缩后计算 active `sessionFile` / `leafId`，并执行 post-compaction side effects：`1309-1320`。
- 持久化 compaction checkpoint，记录 pre snapshot 和 post session file / leaf：`1324-1338`。

`src/agents/pi-embedded-runner/compact.queued.ts`

- context-engine 拥有压缩时也会捕获 checkpoint：`140-141`。
- 压缩后更新 post-compaction session file / leaf，并持久化 checkpoint：`195-237`。

`src/gateway/session-compaction-checkpoints.ts`

- `forkCompactionCheckpointTranscriptAsync(...)` 复制 checkpoint transcript 并生成新 session：`236`。
- `captureCompactionCheckpointSnapshotAsync(...)` 捕获压缩前 snapshot：`294`。
- `persistSessionCompactionCheckpoint(...)` 保存 pre/post compaction 关系：`394`。

`ui/src/ui/chat/build-chat-items.ts`

- compact marker 展示为 `Compacted history` divider，并提示可以打开 checkpoints branch / restore：`501-503`。

结论：OpenClaw compact 成功后通过 active session 指针变化和 checkpoint 明确表达状态。pre-compaction 历史通过 branch / restore 显式进入，不参与普通恢复的当前上下文竞争。

### 对 CCR 的补充结论

1. 压缩是当前上下文状态变更，不是单纯 UI 卡片。
2. 恢复时必须重放 compact 语义，得到压缩后的当前上下文。
3. pre-compaction 原文不应作为普通恢复的模型上下文候选链；如果要进入模型上下文，应通过 checkpoint / branch / restore 之类显式能力。
4. 可见历史展示应从 transcript / rollout 的展示投影恢复，不能直接等同于压缩后的 Core context。
5. Core resume 和 App Server display 必须共享 transcript 解释规则和 canonical leaf 诊断，但输出应分为 `currentContextMessages` 与 `displayReplayItems` 两类。

## 2026-05-24 CCR 阶段 10 实施证据

本节记录并行工具来源绑定和 Desktop 主展示路径收口后的 CCR 关键落点：

- `src/utils/conversationMaterialization.ts`
  - `MaterializedConversation.messages` 是兼容字段，语义等同 `currentContextMessages`。
  - `displayReplayEvents` 从 transcript 主线展示消息生成，用于 App Server 可见历史，不按 compact boundary 裁剪 UI 历史。
- `src/app-server/toolDisplayLifecycle.ts`
  - 工具调用 ID 与工具结果来源 ID 归一化。
  - 一个 `tool_use` 对应一个工具展示项；`tool_result` 按来源 ID 回填对应项。
  - 缺来源或来源不存在时生成孤立工具结果诊断项。
- `src/app-server/threadDisplay.ts`
  - 历史 snapshot 改为按内容块级归并；一个 assistant message 内多个 `tool_use` 会生成多个工具展示项。
  - compact boundary 作为系统提示 / 展示标记进入可见历史，不删除 boundary 前 UI 历史。
- `src/display/threadDisplayProjection.ts`
  - 展示投影保持“一条展示项一个主语义”，不再在投影层猜多个工具块。
- `src/display/threadDisplayProjectionSchema.ts`
  - App Server 生成 projection 后校验；Renderer 消费 projection 前校验。
  - 缺失或非法 projection 是展示协议错误，不再 raw fallback 成正常工具卡。
- `src/app-server/router.ts` / `src/app-server/coreEventMapper.ts`
  - 实时展示只下发 `thread/display/patch` 和必要生命周期事件。
  - 旧 `item/*`、`permission/*`、`context/compacted`、`turn/failed` 展示通知不再作为 UI 主路径。
- `apps/desktop/src/main/index.ts`
  - Desktop status 不再携带旧 `threadMessages` 展示状态。
  - 权限响应后刷新 `ThreadDisplaySnapshot` 并广播明确状态事件，避免用户拒绝权限后 UI 仍停在“等待授权”。
- `apps/desktop/src/renderer/src/app/notificationRouter.ts`
  - Renderer 只对明确允许的 state event 重放 snapshot。
  - snapshot / patch item 缺失或携带非法 projection 时生成协议错误卡。
- `scripts/smoke-app-server.mjs`
  - 覆盖历史 snapshot 并行工具拆分、乱序结果回填、孤立工具结果诊断、旧展示通知清理。
- `scripts/smoke-desktop-session-state.mjs`
  - 覆盖 Renderer snapshot / patch 主路径、缺 projection 错误卡、权限响应后 snapshot 重放、旧 `threadMessages` 路径不回流。
- `scripts/smoke-desktop-display-events.mjs`
  - 覆盖工具卡、文件卡、附件、错误卡和 rich projection 的 Desktop 展示事件。

结论：

1. CCR 当前模型上下文和 UI 可见历史已经是同源双投影，不再共用一个含糊的 `messages` 结果。
2. 并行工具结果绑定依据是 `tool_use.id` / `tool_result.tool_use_id` 等来源字段，不依据工具结果返回先后。
3. Renderer 主路径只能消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 中的合法 `projection`；不得恢复 raw content fallback。
4. 真实 CCR DEV 已完成普通问答、多工具卡、工具失败、权限拒绝、手动 compact、压缩后继续、历史恢复、刷新 / 重启恢复回归。

## 后续核对清单

修改 CCR 会话恢复或实时展示前，先问：

- 这次改的是事实源、展示投影，还是 Renderer 纯 UI？
- 历史恢复和实时展示是否仍输出同一类 `ThreadDisplayItem`？
- 这条实时 patch 是否能从 transcript 重新构建出来？
- 刷新页面是否会丢失刚刚实时展示过的 completed item？
- 计数文案是否明确说明了 raw / core / visible / hidden 的口径？
- 是否触碰了原始 Claude Code transcript 语义？如果触碰，是否已有用户确认？
