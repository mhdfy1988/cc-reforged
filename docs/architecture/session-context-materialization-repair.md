# CCR 当前上下文物化修复方案

本文记录 2026-05-24 对 CCR 会话压缩、历史恢复、实时展示和 App Server replay 不一致问题的修复方向。它是后续实现的依据，不替代已有的两份基础文档：

> 2026-05-24 复审修正：本文里所有“裁掉 / 裁剪 compact boundary 前旧消息”的表述，默认只指 **Core 当前模型上下文（currentContextMessages）**，不指 UI 可见历史。UI 历史不应该因为 compact boundary 被截断；它应从 transcript / rollout 展示投影恢复，并把 compact 表达为卡片或分隔标记。

- [CCR 历史恢复与 transcript 语义](./session-resume-transcript-semantics.md)
- [CCR 历史恢复与实时展示统一协议](./realtime-history-display-contract.md)

## 当前结论

这次问题不是“恢复时选哪条链”的产品问题，也不是“短链 / 长链”两套结果的问题。CCR 对用户只有一条当前会话主线。压缩后，**模型继续对话用的当前上下文**已经发生了状态变化；切换会话再切回来时，Core resume 必须把 transcript 重新物化成同一个压缩后的模型上下文。

但这里必须把两个概念分清：

- **当前模型上下文**：下一轮发给模型的消息。压缩后它应该变小，通常只包含压缩摘要和压缩后新消息。
- **可见历史展示**：用户在 UI 中回看的会话时间线。它可以显示压缩卡片，但不应该因为模型上下文压缩就默认丢掉压缩前可见记录。

因此，后续修复目标不是把所有入口都压成同一份 `messages`，而是从同一个 transcript 事实源稳定产出两个不同投影：

```text
transcript JSONL
-> 解析原始事实
-> 应用 compact / snip 等状态变更语义
-> 排除 sidechain 对主线尾部的竞争
-> 生成 Core 可继续上下文 currentContextMessages
-> 生成 App Server 可见历史 displayReplayItems / displaySnapshot
```

Core 继续对话和 App Server 历史展示必须共享 transcript 解释规则、compact / snip / sidechain 语义、canonical leaf 诊断和异常处理，但不能把压缩后的 Core context 直接当作历史展示结果。否则就会出现“上下文确实变小了，但恢复历史时压缩前可见消息直接消失”的问题。

## 2026-05-24 实施收口状态

阶段 9 已按本文方向完成第一版落地；STD-HISTORY-10 又补齐了可见历史展示、并行工具来源绑定和真实 Desktop UI 回归。这个结论覆盖当前上下文物化、App Server 展示投影和 Desktop 主展示路径，不表示 CLI/TUI 原生输出语义被改写：

1. 新增共享物化入口 `src/utils/conversationMaterialization.ts`。
   - `materializeConversationFromTranscript(filePath)` 从 transcript 文件物化当前上下文。
   - `materializeConversationFromLoadedTranscript(loaded)` 从已解析 maps 物化，便于后续复用。
   - 输出 `MaterializedConversation`：兼容 `messages`、`currentContextMessages`、`displayReplayEvents`、`canonicalLeafUuid`、`rawTranscriptEvents`、`materializedTranscriptEvents`、`coreContextMessages`、`diagnostics`、metadata maps。
   - `messages` 是兼容字段，语义等同 `currentContextMessages`；完整 UI 历史必须消费 `displayReplayEvents` 生成 `ThreadDisplaySnapshot`。
2. compact / snip / sidechain 语义集中处理。
   - 普通 compact 无 `preservedSegment` 时，也只在当前模型上下文里裁掉最后一个 boundary 前旧消息。
   - live `preservedSegment` 保留并 relink。
   - stale / malformed `preservedSegment` 只输出 diagnostic，并阻止旧上下文回流。
   - `snip` 继续复用现有删除和 survivor relink 语义。
   - sidechain 不参与主线 terminal / canonical leaf 竞争；sidechain 子任务挂在主线消息下时，也不能让主线 leaf 消失。
   - terminal system / progress 类子节点挂在主线 conversation message 下时，物化层回溯最近主线 user/assistant 作为 leaf。
3. Core resume 已消费共享物化结果。
   - `loadMessagesFromJsonlPath(...)` 不再计算 `tipChainLength`。
   - `loadConversationForResume(...)` 优先从 transcript 路径物化当前上下文。
   - 新 turn 的 `parentUuid` 接到物化后的 canonical leaf。
4. App Server 展示已拆分可见历史和当前模型上下文。
   - `loadThreadResumeReplayPayload(...)` 不再 `keepAllLeaves: true` 后独立选最长 leaf。
   - `thread/resume` 的 `messages` / `displaySnapshot` 使用 transcript display replay，恢复 UI 可见历史时不按 compact boundary 删除压缩前可见消息。
   - `displaySnapshot.counts.coreContextMessages` 继续来自 Core 当前 thread messages，用来反映模型继续对话的压缩后上下文大小。
   - `thread/messages/list` 仍作为兼容接口读取 Core 当前消息；Desktop 可见历史主路径必须消费 `ThreadDisplaySnapshot`，不能再把 `thread/messages/list.messages` 当完整 UI 历史。
   - 并行工具调用和工具结果由展示投影层按来源 ID 绑定；`tool_result` 不参与 leaf 竞争，也不按返回顺序绑定。
5. 底层读取与物化边界已同步收紧。
   - `applyPreservedSegmentRelinks(...)` 只保留 live `preservedSegment` 原生 relink；普通 compact / stale / malformed 的当前上下文裁剪由第 3 层物化负责。
   - malformed preserved segment 不再让旧上下文回流成恢复主路径，只在物化层输出 diagnostic。
   - `loadFullLog(...)` 不再“最长链优先”；多个主线 leaf 是异常，不静默选择。
6. compact 成功事件顺序已收紧。
   - 手动 compact 只有 transcript 持久化成功后才发 `context_compacted`。
   - 持久化失败会恢复 compact 前内存并抛 `compact_failed`。
   - 流式 compact boundary 只有持久化成功后才裁剪 Core 内存上下文和发成功事件。
   - 手动 compact 在持久化成功后、从 transcript 重新物化当前上下文前，必须显式 flush transcript 写队列；否则 `recordTranscript(...)` 返回后 JSONL 仍可能停留在异步队列里，立即回读会拿到压缩前文件快照，并把实时 Core 上下文覆盖回旧 token 大小。

真实 Desktop UI 手工回归已经在 STD-HISTORY-10-10 完成。Desktop main 中只用于过渡保护的旧 `threadMessages` 状态输入已在阶段 9 后复审中清理；Core 内部 `#threadMessages` 仍是当前模型上下文事实源，不属于完整可见历史 bridge。

## 2026-05-25 STD-HISTORY-11 收口状态

STD-HISTORY-11 在不修改 Claude Code 原生 transcript 写入层的前提下，把 CCR 恢复主路径从旧 parent leaf 语义继续向 Codex-like ordered 语义推进：

1. `conversationMaterialization.ts` 新增 `classifiedTranscriptEvents`。
   - 分类覆盖用户输入、助手回复、工具调用、工具结果、compact boundary、sidechain、系统辅助事件和诊断事件。
   - 分类事件保留 `rawIndex`、`uuid`、`parentUuid`、`sourceToolAssistantUUID`、`contentIndex` 和 `toolUseId`。
   - `tool_result` only 的 user message 不再被当成普通用户输入。
2. 正常恢复路径不再用旧 parent graph leaf 决定当前上下文尾部。
   - 新增 `currentContextTailUuid` / `currentContextTailEvent`。
   - `canonicalLeafUuid` 保留为兼容字段，语义等同 `currentContextTailUuid`，不再表示 parent graph leaf。
   - 旧多个 parent leaf 候选只输出 `legacy_multiple_main_leaves_diagnostic` warning，不再阻断普通恢复。
3. `buildConversationChain(...)` 仍保留在过渡组装路径。
   - 它继续承担 compact / snip / preservedSegment / 并行工具 sibling 和 tool_result 补回能力。
   - 后续 reducer 化之前不得删除。
4. 恢复错误语义已收口。
   - `loadMessagesFromJsonlPath(...)` / `materializeLogForResume(...)` 遇到物化失败时抛出 `history_materialization_failed`，错误消息带 diagnostic code 和 transcript path。
   - 物化失败不再返回空消息让 Core 二次包装成 `Session transcript not found`。
5. 后续目标模型已记录在 [session-semantics-codex-migration.md](./session-semantics-codex-migration.md) 的 “Ordered Reducer 目标模型”。
   - 最终方向是 `OrderedTranscriptMessage[] -> MaterializedConversationEvent[] -> MaterializedConversationModel`。
   - 当前实现是过渡状态：分类事件和 tail 解析已落地，current context reducer 仍是后续工作。

本轮自动验证：

- `npm.cmd run typecheck`
- `npm.cmd run typecheck:desktop`
- `npm.cmd run build`
- `npm.cmd run smoke:conversation-materialization`
- `npm.cmd run smoke:core-session-parent-chain`
- `npm.cmd run smoke:app-server-context`
- `npm.cmd run smoke:app-server`
- `npm.cmd run smoke:desktop-session-state`
- `npm.cmd run smoke:desktop-display-events`
- `git diff --check`

## 2026-05-25 STD-HISTORY-12 边界收口状态

STD-HISTORY-12 完成了第 2 层和第 3 层的职责收口：

1. `sessionStorage.ts` 不再为 CCR 物化返回 ordered/rawIndex 或坏行列表。
   - `conversationMaterialization.ts` 自己读取原始 JSONL，生成 ordered view、`rawIndex`、坏行诊断和 display replay。
2. `applyPreservedSegmentRelinks(...)` 不再承载普通 compact 当前上下文裁剪。
   - 第 2 层只处理 live `preservedSegment` 原生 relink。
   - 当前模型上下文 compact 投影统一在第 3 层 `applyCompactMaterialization(...)` 中完成。
3. `loadFullLog(...)` 不再承载 CCR current tail 产品语义。
   - 它只服务 legacy 搜索 / metadata hydration，不参与 App Server / Desktop 恢复主路径选尾部。
4. `conversationRecovery.ts` 被明确为 CCR fork 的统一恢复 facade。
   - CLI/TUI/Core/App Server initiated resume 都应消费 materialized current-context contract。
   - App Server display replay 同源消费 `materializeConversationFromTranscript(...)`。
5. `buildConversationChain(...)` 被明确为短期 helper。
   - 它可以重建 parent 链并补回并行工具 sibling / tool_result。
   - 它不能决定 current tail，不能暴露 ordered/rawIndex，不能生成 UI replay，不能实现 compact 裁剪策略。
6. 共享层不是冻结层，但修改必须证明是共享正确性。
   - provider/API/SDK/UUID/tool pairing/compact metadata/transcript 持久化一致性可以保留。
   - Desktop/App Server 展示诉求、历史 replay、current tail、UI 计数和临时兜底不能塞回原始共享层。

本轮自动验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:conversation-materialization`
- `npm.cmd run smoke:app-server`
- `npm.cmd run smoke:desktop-display-events`
- `git diff --check`

## 后续方向总纲

后续方向可以收敛成一句话：

**把恢复从“选链”改成“重放状态”。**

CCR 不应该再问“从 transcript 里哪条链最长、哪条像主线”，而应该按 transcript 里的状态语义，把当前上下文重新物化出来。压缩、snip、sidechain、fork 都是明确语义，不能靠启发式猜。

具体方向：

1. 保留 Claude Code transcript 存储语义。
   不大改原始 Claude Code 的 `parentUuid`、`compact_boundary`、`sidechain` 设计；优先在 CCR 自己的恢复 / 展示层做统一物化，避免动底层太深。
2. 新增统一 transcript 解释层，而不是唯一 `messages` 结果。
   `transcript 原始 JSONL -> compact / snip / sidechain 语义 -> ConversationProjection`。这个投影至少要分出 `currentContextMessages` 和 `displayReplayItems`：前者是当前模型上下文，后者是 UI 可见历史。二者都不是 raw transcript，也都不是最长链。
3. 删除正常路径里的“最长链优先”。
   `loadMessagesFromJsonlPath(...)`、`loadFullLog(...)`、`loadThreadResumeReplayPayload(...)` 已改成消费共享物化结果或明确诊断。多个 main leaf 只能是异常诊断，不能静默选最长。
4. 修复 compact boundary 的恢复语义。
   没有 `preservedSegment` 的普通 compact，小文件恢复路径也必须在当前模型上下文里裁掉 compact boundary 前的旧消息。压缩后上下文变小，切出去再回来 Core context 也必须还是小。UI 可见历史不能套用这条裁剪规则。
5. Core 和 App Server 不再各自解释 transcript。
   Core resume 与 App Server display 必须共用同一个 transcript 解释层，但 App Server 不能直接消费 Core 的 materialized messages 作为完整历史展示。
6. 展示层只展示，不解释恢复语义。
   Renderer 继续消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`。压缩成功卡片恢复时可以不显示，但恢复后的上下文必须正确。

Codex 和 OpenClaw 的共同启发不是具体实现完全一样，而是它们都没有让 UI 或 resume 逻辑去“猜最长链”。Codex 是事件 replay 到统一 `ThreadHistoryBuilder`；OpenClaw 是 compact 后更新 active `sessionId` / `sessionFile`，历史接口读新的事实源。因此 CCR 第一阶段不要做大迁移，也不要引入 OpenClaw 那种 session rotation；先把当前 transcript 体系里的 compact / snip / sidechain 物化做对，这是最小、最稳、也最符合“不瞎动原始 Claude Code”的路线。

## 必须放弃的口径

这些口径只是在排查过程中的临时解释，后续不能再作为设计：

- 不再把普通历史恢复解释成“短链恢复”或“长链恢复”。
- 不再用“最长链优先”作为正常恢复策略。
- 不再把同一个 session 内多个非 sidechain leaf 当成正常产品形态。
- 不再为了兼容旧异常 transcript 而保留会让正常语义混乱的兜底。
- 不再让 App Server 和 Core 分别从 transcript 里独立选择主链。

旧异常数据可以记录诊断或加载失败，但不能为了它牺牲新数据的确定性。用户已经明确：不用兼容以前异常数据，只要确保以后不乱。

## 关键术语

| 术语 | 本文含义 |
| --- | --- |
| transcript 原始事实 | JSONL 里追加保存的所有事件、消息、metadata、边界记录。 |
| 当前上下文 | 经过 compact / snip 等状态变更后，Core 下一个 turn 应该真正带给模型的消息。 |
| 历史展示 snapshot | App Server 投影给 Renderer 的可见时间线，不等于 raw transcript，也不等于 Core message 数。 |
| compact boundary | 压缩边界，表示边界前的普通旧消息不再属于当前模型上下文；它不是 UI 历史删除边界。 |
| preserved segment | 压缩时显式保留的一段旧消息，需要在恢复时重新接回当前上下文。 |
| sidechain | 子任务 / AgentTool / 后台任务附属链，不能参与主会话尾部竞争。 |
| fork / branch | 显式新会话。原会话恢复不应该混入 fork / branch 后续内容。 |

## 已确认的 CCR 源码现状

### 实时压缩会更新内存上下文

`src/core/sessionCore.ts` 中，手动压缩会把压缩结果转换为 `postCompactMessages`，写回 `#threadMessages`，并持久化：

- `runCompact(...)`
- `buildPostCompactMessages(...)`
- `this.#threadMessages.set(thread.threadId, postCompactMessages)`
- `persistThreadMessages(...)`

`getContextStatus(...)` 与运行时元数据读取的是内存里的 `#threadMessages`。所以压缩刚完成时，实时状态下的上下文大小下降是符合预期的。

### 恢复路径没有完整重放 compact 语义

`src/utils/sessionStorage.ts` 中，`applyPreservedSegmentRelinks(...)` 的注释已经写明设计意图：只处理最后一个 compact preserved segment，并从当前模型上下文里删除绝对最后一个 compact boundary 之前、且不属于 preserved segment 的消息。

但当前实现存在关键分支：如果 transcript 中没有 `preservedSegment`，函数会直接 `return`。这会导致普通压缩边界前的旧消息在小文件完整读取路径中没有从当前模型上下文里被裁掉。

大文件路径会通过 `readTranscriptForLoad(...)` 在读取阶段跳过边界前内容；小文件路径走 `readFile(...)` 完整读取，再依赖 `applyPreservedSegmentRelinks(...)`。这就造成了同一个 transcript 在不同读取路径下语义不一致。

### 修复前：Core resume 仍有“最长链”选择

`src/utils/conversationRecovery.ts` 的 `loadMessagesFromJsonlPath(...)` 会：

```text
loadTranscriptFile(...)
-> 遍历 leafUuids
-> 计算 buildConversationChain(...) 长度
-> 优先选择最长链，长度相同再按时间选择
```

这不是产品设计，而是修复前的兜底启发式。STD-HISTORY-09 后，Core resume 正常路径已经改为消费 `materializeConversationFromTranscript(...)` 的当前上下文物化结果，不能再按链长独立选 leaf。

### 修复前：Desktop / App Server replay 仍会独立选链

`src/app-server/handlers/sessionHandlers.ts` 的 `loadThreadResumeReplayPayload(...)` 会重新读取 transcript，并用 `keepAllLeaves: true` 后独立选择最长非 sidechain leaf。

这会导致 Core 当前上下文和 Desktop 历史展示不是同一个恢复结果。STD-HISTORY-09 / 10 后，App Server 恢复展示改为消费同一物化层的 `displayReplayEvents`，不再 `keepAllLeaves` 后独立选最长 leaf。

### 并行工具结果恢复仍需要保留

`src/utils/sessionStorage.ts` 的 `buildConversationChain(...)` 不是简单链表回溯，它还会调用 `recoverOrphanedParallelToolResults(...)` 恢复并行工具结果 sibling。后续不能粗暴替换为单纯 parent walk，否则会破坏 Claude Code transcript 对并行工具调用的恢复能力。

## 修复不变式

后续代码必须满足这些不变式：

1. 普通历史恢复只恢复原会话主线，不创建新 session，不从中间 fork。
2. 压缩是上下文状态变更；恢复时必须重放 compact boundary 语义。
3. 如果存在 compact boundary，边界前普通旧消息默认不属于当前模型上下文。
4. 如果最后一个 compact boundary 带有有效 live `preservedSegment`，只保留并重新接回该 preserved segment。
5. 如果没有 `preservedSegment`，或 segment 已过期，仍然要按最后一个 compact boundary 裁剪当前模型上下文里的旧消息。
6. `sidechain` 可以被展示或诊断，但不能参与主线 leaf / terminal 计算。
7. fork / branch 属于新会话，不参与原 session 的当前上下文物化。
8. 如果物化后出现多个非 sidechain 主线 terminal，应记录为数据异常；不要用“最长链优先”静默掩盖。
9. Core resume、App Server `thread/resume`、App Server `thread/messages/list` 必须共享同一个 transcript 解释层；其中 Core resume 消费当前模型上下文，App Server display 消费可见历史投影。
10. Renderer 只消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`，不负责解释 compact、leaf、parentUuid 或 sidechain。

## 推荐物化流程

第一版可以在 `src/utils/sessionStorage.ts` 或新模块中提供一个共享函数。命名可以调整，但语义应固定：

```ts
type MaterializedConversation = {
  currentContextMessages: Message[]
  displayReplayItems: ThreadDisplayItem[]
  sessionId?: string
  canonicalLeafUuid?: string
  rawTranscriptEvents: number
  materializedTranscriptEvents: number
  diagnostics: ThreadDisplayDiagnostic[]
}
```

流程：

1. 读取 transcript JSONL，保留原始 entries 的文件顺序。
2. 建立 `uuid -> TranscriptMessage`、metadata map、content replacement map 等现有结构。
3. 查找文件顺序中的绝对最后一个 `compact_boundary`。
4. 如果没有 compact boundary，保持现有消息 map。
5. 如果有 compact boundary，先只计算当前模型上下文的 compact 结果：
   - 找到最后一个带 `preservedSegment` 的 boundary。
   - 只有当它就是绝对最后一个 boundary，且 tail 到 head 的链可验证时，才认为 segment live。
   - live segment 有效时，保留 segment 内 UUID，并按现有逻辑 relink。
   - 没有 live segment 时，从当前模型上下文里删除绝对最后一个 boundary 之前所有普通消息。
6. 应用 `snip` 删除和 relink。
7. 在物化后的 message map 上计算主线 terminal：
   - 先排除 `isSidechain` 消息参与 parent / child 集合。
   - 使用文件顺序作为权威顺序。
   - 如果最后的 terminal 是 system / attachment 等辅助消息，向前回溯到最近 user / assistant 作为 canonical leaf。
8. 用现有 `buildConversationChain(...)` 从 canonical leaf 构造当前模型上下文，以保留并行工具结果恢复能力。
9. 另行从 transcript / display events 构造可见历史投影；压缩边界可以生成压缩卡片或分隔项，但不能删除压缩前可见历史。
10. 输出 Core 可继续上下文、display replay items、canonical leaf、计数和诊断。

## 模块修改计划

### 1. transcript 物化层

目标：把 compact / snip / sidechain 隔离集中到一个共享入口。

建议落点：

- `src/utils/sessionStorage.ts`
- 或新增 `src/utils/conversationMaterialization.ts`

关键改动：

- 将 `applyPreservedSegmentRelinks(...)` 改造成“compact materialization”，不能在没有 `preservedSegment` 时直接跳过 prune。
- 小文件 `readFile(...)` 路径和大文件 `readTranscriptForLoad(...)` 路径必须得到相同语义。
- 保留 pre-boundary metadata 扫描能力，但 currentContext message map 必须按 boundary 裁剪；display projection 不能按这条规则裁 UI。
- 对 malformed preserved segment 记录 diagnostic，第一版可以选择失败并停止恢复，不再加载完整旧上下文作为静默兜底。

### 2. Core resume

目标：Core 只使用物化后的当前上下文，不再自己做最长链选择。

建议落点：

- `src/utils/conversationRecovery.ts`
- `src/core/sessionCore.ts`

关键改动：

- `loadMessagesFromJsonlPath(...)` 改为调用共享物化函数。
- 删除 `tipChainLength` / 最长链优先逻辑。
- 恢复后的 `lastParentUuid` 必须来自 canonical leaf。
- 压缩后切换回来，`getContextStatus(...)` 看到的 message 数应仍是压缩后的数量。

### 3. App Server replay / snapshot

目标：历史展示 snapshot 使用同一个 transcript 解释层，不独立读取 transcript 选链，也不直接把 Core 当前模型上下文当作完整可见历史。

建议落点：

- `src/app-server/handlers/sessionHandlers.ts`
- `src/app-server/threadDisplay.ts`

关键改动：

- `loadThreadResumeReplayPayload(...)` 不再 `keepAllLeaves: true` 后独立选择最长链。
- `ThreadDisplaySnapshot.counts.coreContextMessages` 使用 Core 物化上下文数量。
- `rawTranscriptEvents` 可以继续表示原始 transcript 行数，但普通恢复提示不显示数量。
- 如果 snapshot 需要展示 compact 后的历史，输入应是 display projection，而不是 raw transcript leaf 选择结果，也不是压缩后的 Core context messages。

### 4. Desktop / Renderer

目标：Renderer 不参与恢复语义，只呈现 App Server 的结果。

关键改动：

- 保持现有 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 主路径。
- 压缩成功卡片属于实时 patch 临时展示，可不要求恢复后重现。
- 恢复成功提示不显示“恢复多少条”，避免把 raw / core / visible 数量混在一起。

## 已覆盖验证清单

这些 smoke 或单元级验证已经落入 `smoke:conversation-materialization`、`smoke:core-session-parent-chain`、`smoke:app-server`、`smoke:desktop-session-state` 和 `smoke:desktop-display-events`：

1. 普通压缩小 transcript：
   - 输入：旧 user / assistant / user，随后 `compact_boundary` + summary。
   - 期望：恢复上下文只包含 boundary 后的 compact 当前上下文，不返回旧 user / assistant。
2. 普通压缩大 transcript：
   - 和小文件同语义，不能因为 `readTranscriptForLoad(...)` 路径不同而结果不同。
3. live `preservedSegment`：
   - 期望：segment 内消息被保留并 relink，segment 外旧消息只从当前模型上下文里被裁剪。
4. stale / malformed `preservedSegment`：
   - 期望：有明确 diagnostic；不静默加载完整旧上下文。
5. sidechain terminal：
   - 输入：主线后有 sidechain 子任务继续写。
   - 期望：主线 canonical leaf 不被 sidechain 抢走。
6. 并行工具结果：
   - 期望：仍通过 `buildConversationChain(...)` 恢复 sibling tool result。
7. App Server / Core 一致性：
   - `thread/resume` 的 `displaySnapshot.counts.coreContextMessages` 与 Core `context/status` 一致。
   - 切换到其他会话再切回来，上下文大小不回到压缩前。
8. UI 恢复提示：
   - 不显示“已回放 N 条历史事件”。
   - 压缩成功实时卡片可以不恢复，但上下文状态必须恢复。

## Codex 对照结论

本次核对路径：`D:/learn_code/codex-rust-v0.131.0`。

Codex 的关键做法是：持久化 rollout 是事实源，历史恢复和实时事件都进入同一个 `ThreadHistoryBuilder`，再输出 `Turn / ThreadItem` 这类展示模型。

源码证据：

- `codex-rs/rollout/src/recorder.rs`
  - `record_canonical_items(...)` 写入 canonical rollout items：`756`。
  - `load_rollout_items(...)` 从 rollout JSONL 读取历史：`812`。
  - `RolloutItem::Compacted` 会作为持久化 item 被读取：`855-856`。
- `codex-rs/app-server-protocol/src/protocol/thread_history.rs`
  - `build_turns_from_rollout_items(...)` 从 rollout items 构造 turns：`78-82`。
  - `ThreadHistoryBuilder.handle_event(...)` 注释明确它是 persisted rollout replay 和 in-memory current-turn tracking 共用 reducer：`158-163`。
  - `handle_rollout_item(...)` 统一处理 `EventMsg`、`Compacted`、`ResponseItem`、`TurnContext`、`SessionMeta`：`228-233`。
  - `handle_context_compacted(...)` 把实时 compact event 投影成 `ThreadItem::ContextCompaction`：`844-848`。
  - `handle_compacted(...)` 把持久化 compaction marker 记到当前 turn，避免 compaction-only legacy turn 被丢弃：`974-978`。
  - `handle_thread_rollback(...)` 会明确截断 turns，不靠 leaf 长短猜测历史：`980` 附近。
- `codex-rs/app-server/src/thread_state.rs`
  - `ThreadState` 持有 `current_turn_history: ThreadHistoryBuilder`：`80`。
  - `track_current_turn_event(...)` 把 live `EventMsg` 喂给同一个 builder，并在终止事件后 reset：`134-144`。
- `codex-rs/app-server/src/request_processors/thread_processor.rs`
  - `load_persisted_thread_for_read(...)` 读取 thread store，include turns 时用 rollout items 构造 API turns：`1995` 起。
  - `thread/turns/list` 注释说明为了 rollback / compaction，每次仍 replay entire rollout：`2086-2107`。
  - `thread_resume_inner(...)` 是普通 resume 入口：`2304`。
  - `resume_thread_from_rollout(...)` 是从持久化 rollout 恢复：`2785`。
  - `thread_fork_inner(...)` 是显式 fork 入口：`3001`。
  - fork 用 `fork_thread_from_history(...)` 创建新 thread：`3108`。
  - fork 返回的新 thread 带 `forked_from_id`：`3170`。
- `codex-rs/app-server/src/request_processors/thread_lifecycle.rs`
  - listener 从 `conversation.next_event()` 获取实时事件：`284`。
  - 先调用 `track_current_turn_event(...)` 更新同一 builder：`298`。
  - 再执行 `apply_bespoke_event_handling(...)` 转成通知：`323`。
- `codex-rs/tui/src/chatwidget/replay.rs`
  - 文件注释说明 replay 是把 turns/items 重新灌入 transcript state，同时避免 live-only side effects：`1-14`。

对 CCR 的直接启发：

1. 历史恢复应该重放 transcript 状态语义，得到物化后的当前上下文或展示模型；不应该把 raw JSONL 交给多个地方各自选 leaf。
2. compaction / rollback 是持久化事件语义，必须被 replay/materialize；不是 UI 卡片问题。
3. fork 是显式新 thread，不是普通 resume 的一条候选链。
4. 实时和历史可以入口不同，但核心 reducer / materializer 必须一致。

## OpenClaw 对照结论

本次核对路径：`D:/learn_code/openclaw-2026.5.18`。

OpenClaw 的关键做法是：历史查询和实时事件是不同入口，但历史返回前已经投影为 display messages；实时期间使用 UI 临时态，终态或工具完成后再通过 `chat.history` 回到持久化历史。压缩则是明确的 session 状态变更：更新 active session 的 `sessionId` / `sessionFile`，并通过 checkpoint 提供 branch / restore，而不是靠历史恢复时猜测最长链。

源码证据：

- `src/gateway/methods/core-descriptors.ts`
  - session message 订阅入口：`sessions.messages.subscribe`，`127`。
  - 历史入口：`chat.history`，`188`。
  - 实时发送入口：`chat.send`，`190`。
- `src/gateway/protocol/schema/logs-chat.ts`
  - `ChatHistoryParamsSchema` 包含 `sessionKey`、`limit`、`maxChars`：`26` 起。
  - `ChatDeltaEventSchema` / `ChatFinalEventSchema` 分别定义实时 delta / final：`88`、`100`。
- `src/gateway/server-methods/chat.ts`
  - `chat.history` handler：`1801`。
  - 读取最近消息后调用 `projectRecentChatDisplayMessages(...)`：`1841`。
  - 历史输出会做 oversized replacement 和最终预算裁剪：`1847`、`1853`。
  - `chat.send` handler 是另一条入口：`1969`。
- `ui/src/ui/controllers/chat.ts`
  - `loadChatHistory(...)` 请求 `chat.history`：`304-327`。
  - 历史加载后写入 `state.chatMessages`：`351`。
  - 历史加载后清空 tool stream 和 `chatStream`，避免重复：`357-359`。
  - `sendChatMessage(...)` 会 optimistic append 用户消息：`483`、`549`。
  - `handleChatEvent(...)` 处理 delta/final/aborted/error：`661` 起。
- `ui/src/ui/app-gateway.ts`
  - terminal chat event 统一收口：`666`。
  - 如果本轮出现 tool events，final 后重新 `loadChatHistory(...)`，用持久化工具结果替换实时流状态：`698-713`。
  - `event === "session.message"` 触发 active session 的 history reload，运行中则延迟：`890` 附近。
- `ui/src/ui/views/chat.ts`
  - `renderChat(...)` 调 `buildChatItems(...)`，把历史 messages、toolMessages、streamSegments、stream 一起交给 UI builder：`1023-1033`。
- `ui/src/ui/chat/build-chat-items.ts`
  - `BuildChatItemsProps` 明确有 `messages`、`toolMessages`、`streamSegments`、`stream`：`13-23`。
  - `buildChatItems(...)` 是最终 UI 合并入口：`453`。
  - compact marker 展示为 `Compacted history` divider，并提示可以打开 checkpoints branch / restore：`501-503`。
  - 实时 stream segments、tool messages、当前 stream 会被追加到最终展示项：`552` 起。
- `src/gateway/server-chat.ts`
  - `emitChatDelta(...)` 广播 `event: "chat"` / `state: "delta"`：`471-529`。
  - `emitChatFinal(...)` 广播 final 或 error：`602-657`。
- `src/gateway/server-session-events.ts`
  - transcript update 先 `projectChatDisplayMessage(...)`，再广播 `session.message`：`139-142`。
- `src/agents/pi-embedded-runner/compact.ts`
  - 压缩前捕获 checkpoint snapshot：`1006`。
  - 压缩后计算 active `sessionFile` / `leafId`，并执行 post-compaction side effects：`1309-1320`。
  - 持久化 compaction checkpoint，记录 pre snapshot 和 post session file / leaf：`1324-1338`。
- `src/agents/pi-embedded-runner/compact.queued.ts`
  - context-engine 拥有压缩时也会捕获 checkpoint：`140-141`。
  - 压缩后更新 post-compaction session file / leaf，并持久化 checkpoint：`195-237`。
- `src/gateway/server-methods/sessions.ts`
  - `sessions.compact` 是明确 API：`2201`。
  - 手动 compact 调用 `compactEmbeddedPiSession(...)`：`2292`。
  - compact 成功后更新 session store 的 `sessionId` / `sessionFile`：`2340-2344`。
  - checkpoint branch 是显式接口：`sessions.compaction.branch`，`1524`。
  - checkpoint restore 是显式接口：`sessions.compaction.restore`，`1614`。
- `src/gateway/session-compaction-checkpoints.ts`
  - `forkCompactionCheckpointTranscriptAsync(...)` 复制 checkpoint transcript 并生成新 session：`236`。
  - `captureCompactionCheckpointSnapshotAsync(...)` 捕获压缩前 snapshot：`294`。
  - `persistSessionCompactionCheckpoint(...)` 保存 pre/post compaction 关系：`394`。
- `src/agents/pi-embedded-subscribe.handlers.compaction.ts`
  - `handleCompactionStart(...)` 设置 `compactionInFlight`：`38-41`。
  - `handleCompactionEnd(...)` 清理 compaction 状态，retry 时 reset，完成后清理 stale assistant usage：`80-126`。

对 CCR 的直接启发：

1. OpenClaw 没有在恢复时靠“最长链”猜压缩后的当前上下文；compact 成功后 active session 指针会更新到新的 `sessionId` / `sessionFile`，历史接口自然读新事实源。
2. pre-compaction 历史不是混在普通恢复里竞争当前上下文，而是通过 checkpoint branch / restore 显式进入。
3. 实时 compact 可以有 UI 事件或等待态，但最终要落到持久化事实源和 session 状态；页面刷新后应由 `chat.history` 一类历史接口重建。
4. UI 可展示 `Compacted history` divider，但这只是展示层，不决定 Core 当前上下文。

## 对本次 CCR 修复的最终判断

结合 Codex 和 OpenClaw，CCR 后续不应该继续修补“选最长链”这类恢复启发式，而应该完成一个统一物化层：

```text
transcript 原始事实
-> compact / snip / sidechain / fork 语义重放
-> Core 当前模型上下文 currentContextMessages
-> App Server 可见历史 displayReplayItems / display snapshot
```

压缩后的模型上下文变小，是事实源状态变化后的当前上下文；切换会话再切回来，Core context 必须仍是压缩后的状态。实时 compact 成功卡片是否恢复可见不重要，重要的是：模型上下文不能回到 compact 前；可见历史也不能因为复用了 Core context 而丢掉压缩前用户原本能看到的历史。
