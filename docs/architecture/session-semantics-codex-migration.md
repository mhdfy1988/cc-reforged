# CCR 会话语义向 Codex 模型迁移方案

> 当前已落地的恢复、上下文和展示链路边界见 [CCR 会话上下文与展示链路权威契约](./session-context-and-display-contract.md)。本文保留向 Codex-like ordered 语义迁移的背景、对照和长期路线。

本文专门记录 CCR 会话语义逐步向 Codex 靠拢的问题。它不替代现有历史恢复、实时展示和并行工具文档，而是作为后续重构时的语义边界文档。

## 背景

CCR 当前会话恢复的底层事实源来自 Claude Code transcript JSONL。这个 transcript 使用 `parentUuid`、`compact_boundary`、`isSidechain`、`sourceToolAssistantUUID` 等字段表达存储链路、压缩边界、子任务和并行工具结果。

Codex 的事实源不是 Claude Code transcript，而是 ordered rollout / response items。Codex 天然不需要从 `parentUuid` 图里选择 `leaf`，它的模型上下文和 UI 历史分别从有序事实源投影出来。

所以 CCR 不能直接逐行复刻 Codex 代码。我们要复刻的是 Codex 的会话语义：

```text
有序事实源
-> 当前模型上下文投影
-> UI 可见历史投影
```

工具调用和工具结果靠来源 ID 绑定；压缩只改变当前模型上下文，不删除 UI 可见历史；正常恢复不靠最长链、terminal leaf 或 parent 图启发式猜主线。

## 目标

1. 让 CCR 对用户保持“一条当前会话主线”的产品语义。
2. 把 `parentUuid` 降级为 Claude Code transcript 的物理存储指针，不再作为 CCR 恢复主线的产品语义。
3. 从 transcript 物理顺序生成稳定的有序事件视图。
4. 从同一个有序事件视图分别生成：
   - 当前模型上下文（current model context）
   - UI 可见历史（visible history）
5. 让并行工具调用、并行工具结果、乱序返回都按 `tool_use_id` / `call_id` 绑定，不参与主线尾部判断。
6. 逐步移除正常路径里的 `leaf`、`longest chain`、`terminal leaves` 语义。

## 非目标

1. 不直接改写 Claude Code 原始 transcript 写入格式。
2. 不把 CCR 的历史 UI 直接迁成 Codex rollout turns。
3. 不为了旧异常 transcript 保留会污染新语义的最长链兜底。
4. 不把“压缩后的模型上下文”当成完整 UI 历史。
5. 不在 Renderer 里解释 `parentUuid`、compact、sidechain 或工具 raw block。

## Codex 语义对照

| 语义 | Codex 做法 | CCR 迁移做法 |
| --- | --- | --- |
| 事实源 | ordered rollout / response items | Claude Code transcript JSONL + rawIndex |
| 当前模型上下文 | ContextManager 有序 items，compact 后 replacement history 替换 | 从有序 transcript 物化 `currentContextMessages` |
| UI 历史 | rollout replay 成 turns / thread items | 从有序 transcript 投影 `ThreadDisplaySnapshot` |
| 工具结果绑定 | `call_id` | `tool_use_id` / `toolUseId` / `toolCallId` 归一化 |
| 并行 / 乱序 | 结果按 ID 回填，不靠返回顺序 | 工具生命周期 reducer 按来源 ID 归并 |
| 压缩 | 影响模型 history，不等同于 UI 删除 | compact boundary 只裁当前模型上下文，不裁 UI 历史 |
| 主线恢复 | 不选 parent leaf | CCR 正常路径也不再选 graph leaf |

源码证据索引见：

- `docs/references/codex-openclaw-live-history-source-evidence.md`
- `docs/architecture/realtime-history-display-contract.md`
- `docs/architecture/session-context-materialization-repair.md`

## Claude Code transcript 原生语义边界

本节先固定 Claude Code 原始层的语义，避免 CCR 在适配层误把原生存储约束当成异常数据。后续迁移到 Codex-like 会话模型时，必须先尊重这些事实，再做转换。

### transcript 是怎么写进去的

Claude Code 的 transcript 写入不是“每次把完整 UI 历史重写一遍”，而是增量追加 JSONL。

核心链路：

```text
REPL / QueryEngine / Core session messages
-> recordTranscript(...)
-> cleanMessagesForLogging(...)
-> insertMessageChain(...)
-> appendEntry(...)
```

关键事实：

- `useLogMessages(...)` 根据消息数组长度、首条 UUID、same-head shrink 判断是增量写入、首次写入、压缩后全量补写，还是 snip / rewind 之类的收缩场景。
- `recordTranscript(...)` 会先查当前 session 已写 UUID。已写 prefix 只用来推进 `startingParentUuid`，真正新消息才进入 `insertMessageChain(...)`。
- compact 场景里 `messagesToKeep` 可能是压缩前已经写过的旧 UUID。它们不能当作新链继续写，否则会把新消息接回压缩前旧上下文。
- `insertMessageChain(...)` 会为每条 transcript message 写入 `parentUuid`，并在写完 chain participant 后推进本轮 parent 游标。

源码依据：

- `src/hooks/useLogMessages.ts:32-133`
- `src/utils/sessionStorage.ts:1221-1295`
- `src/utils/sessionStorage.ts:1624-1681`
- `src/core/sessionCore.ts:1094-1115`
- `src/QueryEngine.ts:739-765`
- `src/QueryEngine.ts:1000-1043`

### `parentUuid` 什么时候是顺序链，什么时候会变 DAG

普通 user / assistant 追加场景里，`parentUuid` 近似是一条顺序链：

```text
user_1 <- assistant_1 <- user_2 <- assistant_2
```

但这只是普通场景。Claude Code 原生层有明确场景会让 transcript 形成 DAG 或需要读侧 relink：

1. **并行工具调用**
   流式输出可能为同一个 assistant API message 的多个 content block 生成多个 assistant transcript message。它们有不同 UUID，但共享 `message.id`。每个工具结果会用 `sourceToolAssistantUUID` 指回对应的一块 assistant message。

2. **compact**
   compact 后的 `boundaryMarker` 会以 `parentUuid: null` 写入，并用 `logicalParentUuid` 记录逻辑前驱。`messagesToKeep` 可能仍保留原始 pre-compact parent，读侧需要 `preservedSegment` relink。

3. **snip**
   snip 删除中间段时，JSONL 是 append-only，旧消息仍在磁盘。读侧必须根据 snip boundary 删除 removed UUID，并把幸存消息的 dangling parent 跨 gap relink。

4. **legacy progress**
   旧 transcript 里 progress 曾参与 parent 链。现在 progress 不应参与 transcript chain，但读侧仍要 bridge 旧 progress parent，避免链断。

所以 `parentUuid` 是原生存储指针，不是 CCR 产品层“主线”的唯一依据。

源码依据：

- `src/utils/sessionStorage.ts:1253-1295`
- `src/utils/sessionStorage.ts:2057-2172`
- `src/utils/sessionStorage.ts:2202-2265`
- `src/utils/sessionStorage.ts:2342-2461`
- `src/utils/sessionStorage.ts:3998-4035`

### `compact_boundary` 怎么截断上下文

Claude Code compact 的输出顺序是固定的：

```text
boundaryMarker, summaryMessages, messagesToKeep, attachments, hookResults
```

普通 compact 的语义不是“删除 UI 历史”，而是“当前模型上下文从最新 boundary 之后重新开始”。因此：

- boundary 自身写入时 `parentUuid` 为 `null`。
- `logicalParentUuid` 只保留逻辑前驱，不应让恢复继续走回 compact 前旧上下文。
- 无 `preservedSegment` 的 compact，也意味着当前模型上下文不能继续携带 boundary 前普通旧消息。
- 有 live `preservedSegment` 时，读侧只接回被明确保留的 segment。
- stale / malformed segment 不能让完整旧上下文回流。

源码依据：

- `src/services/compact/compact.ts:372-385`
- `src/utils/sessionStorage.ts:1253-1268`
- `src/utils/sessionStorage.ts:1624-1640`
- `src/utils/sessionStorage.ts:2057-2172`
- `src/core/sessionCore.ts:620-638`
- `src/core/sessionCore.ts:878-904`
- `src/query.ts:650-654`
- `src/query.ts:1265-1270`

### `tool_result` 为什么会指向不同 assistant

工具结果本质上是 user message，内容块是 `tool_result`，但它不是普通用户输入。工具执行路径会把对应 assistant message 的 UUID 写入 `sourceToolAssistantUUID`，`insertMessageChain(...)` 再用这个值覆盖普通顺序 parent。

这解释了为什么并行工具场景里多个 `tool_result` 会指向不同 assistant sibling：

```text
assistant(msg.id = M, uuid = A, tool_use A)
assistant(msg.id = M, uuid = B, tool_use B)
tool_result A parentUuid -> A
tool_result B parentUuid -> B
```

这不是异常，也不是 fork。它是 Claude Code 原生层为了把 tool_result 绑回来源 tool_use 而写出的 DAG。CCR 后续物化不能把这种 DAG 当成多个主线会话，也不能让 tool_result 参与当前主线尾部竞争。

源码依据：

- `src/utils/messages.ts:514-572`
- `src/services/tools/toolExecution.ts:141-146`
- `src/services/tools/toolExecution.ts:381-458`
- `src/services/tools/toolExecution.ts:493-544`
- `src/query.ts:130-158`
- `src/utils/sessionStorage.ts:1256-1264`
- `src/utils/sessionStorage.ts:2342-2461`

### 哪些逻辑是模型 API 配对要求，不能随便动

模型 API 对 `tool_use` / `tool_result` 有结构要求，不是 UI 想怎么排就怎么排：

- `tool_use` ID 不能重复。
- `tool_result` 必须能找到对应的 `tool_use`。
- 恢复上下文不能以孤立 `tool_result` 开头，否则 API 会拒绝。
- missing result 可以被补 synthetic error result，但 strict mode 会直接拒绝修复，避免污染训练数据。
- orphaned / duplicate tool_result 会被剥离或去重，以满足 API payload 要求。

因此，CCR 可以在 UI 投影里按工具 ID 聚合展示，但当前模型上下文不能为了 UI 排版随意重排 tool_use / tool_result。后续 ordered reducer 必须输出满足 Claude / Anthropic API 配对要求的消息序列。

源码依据：

- `src/utils/messages.ts:5255-5595`
- `src/utils/sessionStorage.ts:2342-2461`

### 对迁移方案的约束

由以上原生语义得到的迁移约束：

1. `sessionStorage.ts`、`messages.ts`、`query.ts`、`QueryEngine.ts` 这些原生写入 / API 规范层不是绝对冻结，但修改必须证明是共享正确性；展示、恢复投影、current tail 和 UI replay 语义不得塞回这些层。
2. `buildConversationChain(...)` 不能整体删除。它里面的“根据 leaf 选主线”应迁出正常路径，但“补回并行工具 sibling / tool_result”的原生兼容能力必须保留或迁到新 reducer。
3. `sourceToolAssistantUUID` 的存在是合理的，不是脏数据；它表示工具结果来源绑定。
4. 并行工具 DAG 是原生 transcript 形态，不是多会话、fork 或异常分支。
5. compact boundary 对当前模型上下文有截断语义，但不对 UI 可见历史下删除命令。
6. 当前模型上下文的输出顺序必须满足模型 API 的 tool pairing 要求；UI 展示顺序可以另行投影。

## 2026-05-25 实施状态

STD-HISTORY-11 / 12 已完成第一轮过渡实现和边界收口。当前 `src/utils/conversationMaterialization.ts` 已不再用旧 parent graph leaf 决定正常恢复尾部，并且 ordered/rawIndex/坏行诊断已从 `sessionStorage.ts` 迁回第 3 层：

```text
transcript
-> classifiedTranscriptEvents
-> applyCompactMaterialization(...)
-> resolveCurrentContextTail(...)
-> buildConversationChain(...)
-> currentContextMessages
```

当前已经落地：

- `classifiedTranscriptEvents`：ordered transcript 的语义化事件视图。
- `loadTranscriptMaterializationView(...)`：第 3 层自己读取原始 JSONL，保留 `rawIndex` 和坏行诊断。
- `currentContextTailUuid` / `currentContextTailEvent`：当前模型上下文尾部。
- `canonicalLeafUuid`：兼容字段，语义等同 `currentContextTailUuid`，不再表示 parent graph leaf。
- `legacy_multiple_main_leaves_diagnostic`：旧 parent leaf 多候选只作为 warning 诊断，不阻断正常恢复。
- `history_materialization_failed`：物化失败保留 diagnostic code，不再返回空消息让 Core 包装成 `Session transcript not found`。
- `buildConversationChain(...)`：只作为短期 parent 链重建和并行工具补回 helper，不再负责 current tail、ordered/rawIndex、UI replay 或 compact 裁剪策略。

仍未完成：

- current context 组装仍暂时调用 `buildConversationChain(...)`，因为它仍承担 parent 链重建、并行工具 sibling 和 tool_result 补回能力。
- 后续需要把 current context 也迁到 ordered reducer，届时 `buildConversationChain(...)` 才能从主路径退为 legacy helper。

## 必须先改的内容

### 1. 从正常路径移除 `getCanonicalMainLeaf`

`getCanonicalMainLeaf(...)` 可以暂时保留为异常诊断工具，但不能决定正常恢复的当前上下文尾部。

新的主路径应该是：

```text
transcript JSONL
-> ordered transcript events
-> classify events
-> apply compact / snip context semantics
-> resolve current context tail
-> build currentContextMessages
-> build displayReplayEvents / displaySnapshot
```

### 2. 建立事件分类器

物化层必须先把 transcript message 分类，再决定它是否能推进当前主线尾部。

第一版分类：

| 分类 | 是否推进当前主线尾部 | 说明 |
| --- | --- | --- |
| 用户输入 | 是 | 普通用户请求 |
| 助手回复 | 是 | 普通助手最终回复或可进入模型上下文的 assistant message |
| 工具调用 | 否 | assistant content 中的 `tool_use` |
| 工具结果 | 否 | user content 中的 `tool_result`，只能按来源 ID 绑定 |
| 压缩边界 | 否 | 影响当前模型上下文裁剪，不推进主线尾部 |
| sidechain | 否 | 子任务 / agent 附属链，不竞争主线 |
| 系统辅助事件 | 否 | progress、permission、hook、diagnostic 等 |
| 异常事件 | 否 | malformed / orphan / missing source 等，只进入诊断 |

### 3. 把 `canonicalLeafUuid` 降级或改名

对外兼容字段可以短期保留，但内部语义应改成：

```text
currentContextTailUuid
```

它表示“当前模型上下文尾部”，不是 parent 图里的 leaf。

### 4. 并行工具结果不能参与尾部竞争

同一 turn 里可以有多个工具调用，也可以有多个工具结果 sibling。工具结果返回顺序可以和工具调用顺序不同。

不变式：

```text
tool_use A, tool_use B
tool_result B
tool_result A
```

恢复后：

- 工具展示顺序按 `tool_use A`、`tool_use B` 首次出现顺序。
- 工具结果 B 回填 B，工具结果 A 回填 A。
- 当前主线尾部不能是 `tool_result A` 或 `tool_result B`。

### 5. 增加真实失败样本 smoke

必须补一个 materialization 级别 smoke，覆盖：

1. assistant 同一轮发多个 `tool_use`。
2. 多个 `tool_result` 以 sibling 形式写入。
3. `tool_result` 返回顺序乱序。
4. 后面继续有普通 assistant / user 消息。
5. 物化不能报 `multiple_main_leaves`。
6. 当前模型上下文包含对应工具结果。
7. 当前上下文尾部不是 `tool_result`。

## 可以后续慢慢改的内容

### 第 1 步：局部替换尾部解析

先让 `conversationMaterialization.ts` 内部不再用 graph leaf 决定当前上下文尾部。保留现有 transcript 读取、compact、snip 和 `buildConversationChain(...)` 的大部分能力。

这一阶段目标是先止血：

- 不再因为并行工具结果 sibling 报多个 main leaf。
- 不再让工具结果推进主会话尾部。
- 不再恢复最长链兜底。

### 第 2 步：上下文构造也从 parent walk 迁到 ordered event reducer

第一步仍可能临时使用 `buildConversationChain(...)` 组装当前上下文，但这只能作为过渡。

后续应该把当前模型上下文也改成 ordered event reducer 产物：

```text
ordered events
-> compact checkpoint / boundary
-> tool call/result normalization
-> currentContextMessages
```

这一步完成后，`parentUuid` 只作为诊断和旧 transcript 辅助信息。

### 第 3 步：UI 历史 reducer 完全对齐实时 patch reducer

历史恢复和实时展示都应该进入同一套展示 reducer：

```text
history ordered events -> display reducer -> ThreadDisplaySnapshot
live events -> display reducer -> ThreadDisplayPatch
```

Renderer 只消费 snapshot / patch，不解释 raw transcript。

### 第 4 步：旧兼容字段收口

当 Desktop、App Server、smoke 都稳定后，再逐步清理这些会误导语义的字段和入口：

- `canonicalLeafUuid`
- 旧 `messages` replay fallback
- raw content fallback
- longest-chain 诊断外路径

## Ordered Reducer 目标模型

本次过渡实现已经先完成三件事：

1. 从 ordered transcript 生成 `classifiedTranscriptEvents`。
2. 用 `resolveCurrentContextTail(...)` 从分类事件解析当前上下文尾部。
3. 保留 `buildConversationChain(...)` 的 compact / snip / preservedSegment / 并行工具 sibling 补回能力。

这仍然不是最终形态。最终形态应把 parent walk 从 current context 主路径继续迁出，形成一个 ordered reducer：

```text
OrderedTranscriptMessage[]
-> MaterializedConversationEvent[]
-> MaterializedConversationModel
-> currentContextMessages
-> displayReplayEvents / ThreadDisplaySnapshot
-> diagnostics
```

### MaterializedConversationEvent

`MaterializedConversationEvent` 是 CCR 适配层对 Claude Code transcript 的语义化事件。它保留原始来源信息，但不把来源信息当产品主线。

建议字段：

```ts
type MaterializedConversationEvent = {
  kind:
    | 'user_input'
    | 'assistant_response'
    | 'tool_use'
    | 'tool_result'
    | 'compact_boundary'
    | 'sidechain'
    | 'system_event'
    | 'diagnostic'
  rawIndex: number
  materializedIndex: number
  uuid?: UUID
  parentUuid?: UUID | null
  logicalParentUuid?: UUID | null
  sourceToolAssistantUUID?: UUID
  sessionId?: UUID
  contentIndex?: number
  toolUseId?: string
  advancesMainTail: boolean
  skipReason?: string
}
```

语义要求：

- `rawIndex` 是 transcript JSONL 的物理顺序来源。
- `parentUuid` / `logicalParentUuid` 只保留为 source metadata 和 legacy diagnostic。
- `sourceToolAssistantUUID` 表示 tool_result 来源 assistant，不是异常分支。
- `advancesMainTail` 只允许普通用户输入和助手回复为 true。
- `tool_use` / `tool_result` 通过 `toolUseId` 绑定，不参与当前 tail 竞争。
- `compact_boundary` 是 current context 状态切换事件，不是 UI 历史删除事件。

### MaterializedConversationModel

`MaterializedConversationModel` 是 reducer 的统一产物，Core 和 App Server 都应该消费它，而不是各自重新解释 transcript。

建议字段：

```ts
type MaterializedConversationModel = {
  status: 'ok' | 'error'
  orderedEvents: MaterializedConversationEvent[]
  currentContextMessages: SerializedMessage[]
  displayReplayEvents: SerializedMessage[]
  currentContextTailUuid?: UUID
  currentContextTailEvent?: MaterializedConversationEvent
  diagnostics: ConversationMaterializationDiagnostic[]
  metadata: MaterializedConversationMetadata
}
```

投影边界：

- Core resume 只消费 `currentContextMessages`、`currentContextTailUuid`、`diagnostics`。
- App Server 历史展示只消费 `displayReplayEvents` / `ThreadDisplaySnapshot` / `diagnostics`。
- Renderer 只消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`。
- `canonicalLeafUuid` 只能作为兼容字段，语义等同 `currentContextTailUuid`，后续应逐步从协议里退场。

### 后续迁移步骤

1. **已完成的过渡层**
   `conversationMaterialization.ts` 自己读取原始 JSONL 输出 ordered view / 分类事件 / display replay，tail 从分类事件解析，`buildConversationChain(...)` 只作为当前上下文组装中的短期 parent 链和并行工具补回 helper。

2. **下一步 reducer 化 current context**
   新增 current context reducer，从 `MaterializedConversationEvent[]` 顺序生成 `currentContextMessages`。它必须显式处理：
   - compact boundary：从最新有效边界后重建上下文。
   - preservedSegment：只接回明确保留的 segment。
   - snip：删除被 snip 标记的消息并 relink 幸存段。
   - tool pairing：保留满足模型 API 的 tool_use / tool_result 顺序。
   - sidechain：不进入主线 current context。

3. **再迁移展示投影**
   历史 snapshot 和实时 patch 共享展示 reducer。历史输入是 ordered events，实时输入是 live display patch event；输出统一为 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`。

4. **最后收口 legacy helper**
   当 current context reducer 和 display reducer 都覆盖 smoke 后，`buildConversationChain(...)` 从主路径退为 legacy helper，只在旧 transcript 修复、调试诊断或过渡兼容路径使用。

回滚点：

- 如果 reducer 化 current context 出现模型 API payload 兼容问题，可以回退到当前过渡实现：分类事件解析 tail + `buildConversationChain(...)` 组装上下文。
- 不能回退到 graph leaf / longest-chain 选择主线。

## 不变式

1. 用户看到的是同一个会话，不存在普通恢复场景下的“短链 / 长链”产品概念。
2. `parentUuid` 是存储结构，不是 CCR 的会话语义。
3. `sidechain` 是子任务 / 附属任务语义，不参与主线尾部竞争。
4. fork / branch 是新会话语义，不混入原会话恢复。
5. compact 是当前模型上下文状态变更，不是 UI 历史删除命令。
6. 工具调用和工具结果必须按来源 ID 绑定，不按 sibling、返回顺序或 parentUuid 绑定。
7. 多个普通主线尾部如果真的出现，只能作为 transcript 异常诊断，不用最长链静默掩盖。
8. Renderer 不负责解释 transcript 语义。
9. App Server 和 Core 不各自发明恢复规则，必须共享物化语义。
10. 所有 dist / cli / app-server smoke 在源码变更后必须先 build，避免跑旧产物。

## 验收清单

最小验收：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:conversation-materialization`
- 用真实失败样本验证不再出现 `multiple_main_leaves`

扩展验收：

- compact 后切换会话再恢复，Core 上下文仍是压缩后的上下文。
- compact 前 UI 可见历史恢复时仍可显示，或按设计显示压缩提示，不被当前模型上下文裁掉。
- 并行工具调用和乱序工具结果恢复后只生成对应工具展示项，不重复、不串绑。
- 刷新页面前后实时展示和历史 snapshot 的最终可见语义一致。

## 后续文档关系

本文负责“为什么向 Codex 语义迁移、迁移什么、不迁移什么”。

其他文档分工：

- `session-context-materialization-repair.md`：记录当前上下文物化修复历史和已知问题。
- `realtime-history-display-contract.md`：记录 App Server / Renderer 展示协议。
- `parallel-tool-result-source-binding-plan.md`：记录并行工具结果来源绑定计划。
- `codex-openclaw-live-history-source-evidence.md`：记录 Codex / OpenClaw 源码证据。

后续如果新增 goal / todo，应以本文的不变式作为前置约束，不再把 leaf / longest chain 当作正常恢复策略。
