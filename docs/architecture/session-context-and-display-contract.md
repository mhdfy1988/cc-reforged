# CCR 会话上下文与展示链路权威契约

本文是 CCR 会话恢复、当前模型上下文和 Desktop 可见历史展示的当前权威入口。后续排查 compact、历史恢复、`thread/messages/list`、`ThreadDisplaySnapshot`、工具结果绑定或 Desktop replay 问题时，先读本文，再按需要追具体 goal / todo。

## 目标

CCR 现在把同一份 transcript 事实源投影成两条不同链路：

```text
transcript JSONL
-> ordered transcript events
-> currentContextMessages
-> Core 下一轮模型上下文
```

```text
transcript JSONL / Core realtime event
-> ThreadDisplayReducerInputEvent
-> ThreadDisplayReducer
-> ThreadDisplaySnapshot / ThreadDisplayPatch
-> Desktop Renderer 可见历史
```

这两条链路同源，但不能互相替代。

## 核心结论

1. `currentContextMessages` 是模型继续对话用的上下文，不是完整 UI 历史。
2. `ThreadDisplaySnapshot.items` 是历史展示权威。
3. `ThreadDisplayPatch.operations` 是实时展示权威。
4. `thread/messages/list.result.messages` 是兼容 / current-context 载荷，不得 replay 成 Desktop 可见历史。
5. compact 只裁剪当前模型上下文，不裁剪 UI 可见历史。
6. 工具调用和工具结果按来源 ID 绑定，不按返回顺序、最长链或 parent leaf 猜。
7. Desktop 不做 snapshot merge 或防退化补旧项；较短 snapshot 必须在上游 reducer / 协议层暴露，而不是由前台静默补齐。
8. projection 缺失或非法必须进入协议错误卡，不允许 raw fallback。

## 当前模型上下文链路

权威代码入口：

- `src/utils/conversationMaterialization.ts`
- `materializeConversationFromTranscript(...)`
- `buildCurrentContextFromOrderedEvents(...)`

当前模型上下文生成流程：

```text
读取 transcript JSONL
-> 生成 ordered raw messages
-> 生成 classifiedTranscriptEvents
-> resolveCurrentContextTail(...)
-> buildCurrentContextFromOrderedEvents(...)
-> removeExtraFields(...)
-> MaterializedConversation.currentContextMessages
```

关键边界：

- `MaterializedConversation.messages` 是兼容字段，语义等同 `currentContextMessages`。
- `buildConversationChain(...)` 已退出当前模型上下文主路径。
- `buildConversationChain(...)` 仍保留在 `sessionStorage.ts`，作为 legacy/native 读侧 helper，不作为 silent fallback。
- 孤立 `tool_result` 不进入 `currentContextMessages`，会记录 `orphan_tool_result_dropped_from_current_context` 诊断。
- tail 之后的 attachment / system 附属上下文可以保留，避免 compact 后恢复短于实时上下文。

## UI 展示链路

权威代码入口：

- `src/app-server/threadDisplayInputEvent.ts`
- `src/app-server/threadDisplay.ts`
- `src/display/threadDisplayProjection.ts`
- `src/display/threadDisplayToolProjector.ts`
- `src/display/threadDisplayFileProjector.ts`
- `src/display/threadDisplayAttachmentProjector.ts`
- `src/display/threadDisplayErrorProjector.ts`

历史展示流程：

```text
AppServerThreadMessage[]
-> appServerThreadMessagesToDisplayReducerInputEvents(...)
-> ThreadDisplayReducer.acceptMany(...)
-> ThreadDisplayReducer.toSnapshotItems()
-> ThreadDisplaySnapshot.items
```

实时展示流程：

```text
CoreTurnEvent
-> coreTurnEventToDisplayReducerInputEvent(...)
-> ThreadDisplayReducer.acceptOne(...)
-> ThreadDisplayReducer.consumePatchOperations()
-> ThreadDisplayPatch.operations
```

Desktop 消费边界：

- Desktop main 保存 `status.threadDisplaySnapshot`。
- Desktop main 刷新 `thread/messages/list` 时只消费 `result.displaySnapshot`。
- Desktop main 不合并新旧 `ThreadDisplaySnapshot`，也不根据 counts 或旧 items 修正 UI 历史。
- Desktop Renderer 只消费 snapshot / patch 生成展示事件。
- Renderer 不解释 transcript、`parentUuid`、compact、tool raw block 或 provider raw output。

## 协议边界

App Server 当前保留这些兼容字段：

```ts
ThreadResumeResult.messages
ThreadMessagesListResult.messages
ThreadMessagesSemantics
```

语义如下：

| 字段 | 当前语义 | 是否 UI 历史权威 |
| --- | --- | --- |
| `ThreadResumeResult.displaySnapshot` | 历史展示 snapshot | 是 |
| `ThreadResumeResult.messages` | legacy display replay compat | 否 |
| `ThreadMessagesListResult.displaySnapshot` | 兼容接口附带的展示 snapshot | 是 |
| `ThreadMessagesListResult.messages` | current-context compat | 否 |
| `messagesSemantics: current_context_compat` | 继续模型上下文载荷 | 否 |
| `messagesSemantics: display_replay_compat` | 旧客户端兼容 replay 载荷 | 否，Desktop 仍以 snapshot 为准 |

## 诊断计数边界

`ThreadDisplayCounts` 只用于诊断和 telemetry。

```text
rawTranscriptEvents
coreContextMessages
projectedDisplayItems
visibleTimelineItems
hiddenDisplayItems
filteredTranscriptEvents
hiddenTimelineItems
```

这些 count 不能反向决定 UI 历史该展示多少条。UI 展示权威是：

- 历史：`ThreadDisplaySnapshot.items`
- 实时：`ThreadDisplayPatch.operations`

如果刷新后 snapshot 变短，Desktop 也只显示最新 snapshot。是否丢失展示项由 App Server reducer、协议诊断和黄金回归暴露；Desktop 不再承担防退化合并职责，避免把前台变成第二个 display reducer。

## 实施记录

本轮当前架构来自以下 goal / todo 的收口结果：

| Goal | 结论 |
| --- | --- |
| `STD-HISTORY-13-0` | `currentContextMessages` 主路径迁到 ordered transcript events，`buildConversationChain(...)` 退出当前上下文主路径。 |
| `STD-HISTORY-14-0` | 历史 snapshot 和实时 patch 开始共享 display item factory / projector。 |
| `STD-HISTORY-15-0` | tool / file projector 拆分，附件 / 错误 projector 边界明确。 |
| `STD-HISTORY-16-0` | 建立 `ThreadDisplayReducerInputEvent` 统一输入事件层。 |
| `STD-HISTORY-17-0` | `ThreadDisplayReducer` 成为真实状态机，历史和实时都进入同一个 reducer 类型。 |
| `STD-HISTORY-18-0` | 删除旧 reducer 入口，防止两套展示逻辑并存。 |
| `STD-HISTORY-19-0` | 固化 display snapshot / patch 是展示权威，`messages` 只是兼容载荷。 |
| `FODR-01` | 输入协议硬化，`diagnostics` 成为硬字段，未知输入 fail fast 或进入协议错误展示项。 |
| `FODR-02` | 建立 `DisplayFact` 中间事实层，projector 只消费 reducer 已确认事实。 |
| `FODR-03` | snapshot / patch 统一为同一 reducer state 的两个输出 view。 |
| `FODR-04` | Desktop main / Renderer 只消费展示协议，移除 snapshot merge，补历史 / 实时黄金回归。 |

对应 goal 文档：

- `docs/goals/2026-05-28-std-history-13-0-current-context-ordered-reducer.md`
- `docs/goals/2026-05-28-std-history-14-0-ui-display-reducer-unification.md`
- `docs/goals/2026-05-28-std-history-15-0-ui-display-reducer-deepening.md`
- `docs/goals/2026-05-28-std-history-16-0-thread-display-input-event.md`
- `docs/goals/2026-05-28-std-history-17-0-thread-display-reducer-state-machine.md`
- `docs/goals/2026-05-28-std-history-18-0-thread-display-legacy-path-removal.md`
- `docs/goals/2026-05-28-std-history-19-0-thread-display-protocol-contract.md`

对应 todo 文档：

- `docs/stages/current-context-ordered-reducer-todo.md`
- `docs/stages/ui-display-reducer-unification-todo.md`
- `docs/stages/ui-display-reducer-deepening-todo.md`
- `docs/stages/thread-display-input-event-todo.md`
- `docs/stages/thread-display-reducer-state-machine-todo.md`
- `docs/stages/thread-display-legacy-path-removal-todo.md`
- `docs/stages/thread-display-protocol-contract-todo.md`

## 旧文档定位

以下文档保留为背景和阶段记录，不再作为当前唯一入口：

- `session-resume-transcript-semantics.md`：transcript / parentUuid / sidechain 术语背景。
- `session-context-materialization-repair.md`：compact 与物化修复阶段记录。
- `session-semantics-codex-migration.md`：Codex-like ordered 语义迁移背景。
- `realtime-history-display-contract.md`：历史恢复与实时展示统一协议的早期到中期设计记录。

## 后续方向

如果继续推进“全事件统一 ordered display reducer 状态机”，应单独新建 goal，并以 [CCR 全事件统一 Ordered Display Reducer 设计方向](./thread-display-ordered-reducer-future-design.md) 作为架构依据。

下一步不是改 Desktop，也不是让 `messages` 重新承担 UI replay，而是让内部展示输入事实补齐：

- `orderKey`：决定展示顺序。
- `sourceIdentity`：决定生命周期归属，工具场景下包含 `toolUseId` / `toolCallId`。
- `payload`：承载文本、工具、附件、文件、错误、系统提示等内容。

同一个 ordered display reducer 再从这些输入事实输出 snapshot / patch / diagnostics view。
