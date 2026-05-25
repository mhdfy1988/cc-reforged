# CCR 历史恢复与实时展示统一协议

本文固定 2026-05-23 对 Codex、OpenClaw 和 CCR 会话恢复链路讨论后的结论。后续改 App Server、Desktop replay、实时流式展示、历史恢复、计数提示时，先按本文判断边界。

详细源码证据见 [Codex / OpenClaw 实时与历史恢复源码证据索引](../references/codex-openclaw-live-history-source-evidence.md)。压缩后当前上下文恢复的一致性问题，见 [CCR 当前上下文物化修复方案](./session-context-materialization-repair.md)。

## 核心结论

历史恢复和实时展示不要求使用同一个数据源，但必须在进入 Renderer 前使用同一套展示协议。

```text
历史恢复:
transcript / rollout
-> App Server 统一 reducer/projector
-> ThreadDisplaySnapshot
-> Renderer

实时展示:
live event
-> App Server 同一个 reducer/projector
-> ThreadDisplayPatch
-> Renderer
```

Renderer 不应该关心一条展示项来自磁盘恢复还是实时事件。Renderer 只消费 `ThreadDisplaySnapshot` 和 `ThreadDisplayPatch`，并负责滚动、展开、局部状态等纯 UI 行为。

## 当前落地状态

截至 2026-05-24 的 STD-HISTORY-10 收口，CCR 已经完成“历史恢复和实时展示都进入 App Server 展示协议，并由 App Server / shared projector 输出 rich projection”。这里的“完成”指 Desktop 展示主路径，不表示旧 CLI/TUI 原生输出语义被迁移：

- 历史恢复：`thread/resume` 和 `thread/messages/list` 必须返回 `displaySnapshot`，Desktop 主路径只消费 `ThreadDisplaySnapshot`。
- 实时展示：App Server 发送 `thread/display/patch`；旧 `item/*`、`permission/*`、`context/compacted`、`turn/failed` 展示通知不再下发。
- Desktop 主进程：`status.threadDisplaySnapshot` 是传给 Renderer 的唯一历史展示 snapshot；不再把旧 `threadMessages` 放进 Desktop status。
- App Server / shared projector：`ThreadDisplayItem.projection` 输出用户消息、工具卡、文件卡、附件、错误快照、TodoWrite 和内部 plan draft 隐藏规则所需的 rich 结构。
- Renderer：只用 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 构造展示 replay；snapshot / patch item 必须有合法 `projection`，缺失或非法时展示协议错误卡，不再 raw 解析成工具卡 / 文件卡。

仍保留的是 App Server 协议兼容边界：`thread/messages/list` 仍返回 `messages` 供现有接口使用，但它是当前模型上下文 / 兼容字段，不是完整 UI 历史。Desktop main / Renderer 的展示状态不再缓存或消费旧 `threadMessages`。

2026-05-24 阶段 9 已完成当前上下文物化第一版，阶段 9 后复审已完成 App Server 可见历史 display projection 与 Core 当前模型上下文拆分：

- Core resume 已使用 `MaterializedConversation`，不再独立按最长链选 leaf。
- App Server `thread/resume` 不再重新选最长链；raw counts / canonical leaf / diagnostics 来自同一物化结果。
- 2026-05-24 再校准已落地：`thread/resume` 的 `messages` / `displaySnapshot` 来自 transcript display replay，不再直接来自 Core 当前 thread messages。Core 当前 thread messages 是压缩后的模型上下文，不是完整可见历史。
- `thread/messages/list` 如果继续读取 Core 当前消息，必须明确它是当前模型上下文接口；Desktop 可见历史主路径应读取 `ThreadDisplaySnapshot`。
- `loadFullLog(...)` 不再把多个 main leaf 当普通场景选最长；异常只诊断或返回原 log。
- 普通 compact、live / stale / malformed `preservedSegment`、snip、sidechain 和多 main leaf 都已有 smoke 覆盖。

2026-05-25 的 STD-HISTORY-12 又补齐了会话物化边界：

- `sessionStorage.ts` 不再输出 ordered/rawIndex 或坏行列表给 CCR 物化层；第 3 层 `conversationMaterialization.ts` 自己直读 JSONL 生成 ordered view。
- 普通 compact 当前上下文裁剪不再放在原生 reader；第 3 层负责 current context 投影，UI display replay 不套用这条裁剪。
- `buildConversationChain(...)` 只作为短期 helper，保留 parent 链重建和并行 tool_result 补回；不能决定 current tail，也不能生成 UI replay。
- 共享层可改但必须证明是 provider/API/SDK/tool pairing/compact metadata/transcript 持久化等共享正确性。

2026-05-24 的 STD-HISTORY-10 已补齐并行工具来源绑定和真实 Desktop UI 回归：

- 一个 assistant message 内多个 `tool_use` 会拆成多个工具展示项。
- `tool_result` 按 `tool_use_id` / 等价来源 ID 回填对应工具展示项；返回顺序可以和调用顺序不同。
- 缺来源 ID 或指向不存在工具调用的结果只能生成诊断卡，不能伪装成正常工具卡。
- 权限请求拒绝后，Desktop main 会刷新 `ThreadDisplaySnapshot` 并广播明确状态事件；Renderer 只对这些明确事件重放 snapshot，避免 UI 停在“等待授权”。
- 真实 CCR DEV 已覆盖普通问答、多工具卡、工具失败、权限拒绝、手动 compact、压缩后继续、历史恢复、刷新 / 重启恢复。

发布说明已写入 `CHANGELOG.md` 的 Unreleased；不再存在阻塞展示协议收口的代码项。

## 为什么这样做

这次排查确认了两件事：

1. Codex 的历史和实时入口不同，但都收敛到 `Turn / ThreadItem` 这类展示模型；历史是批量 replay，实时是 notification。
2. OpenClaw 的历史和实时入口也不同，但最终都交给 `buildChatItems()` 把 `messages`、工具流、流式文本合并成 UI 项。
3. Codex / OpenClaw 都没有把“压缩后的模型上下文”直接当成“完整历史 UI”。压缩后的上下文用于继续对话；历史展示仍从 rollout / transcript 的展示投影恢复。

所以 CCR 不应该追求“历史和实时从同一个入口读”，也不应该让 Desktop 分别解释 transcript 和 live event。正确目标是：App Server 把不同来源统一投影成同一类展示项。

## 数据源边界

| 场景 | 权威数据源 | 临时数据源 | 进入 Renderer 前的形态 |
| --- | --- | --- | --- |
| 历史恢复可见时间线 | 磁盘 transcript / rollout | 无 | `ThreadDisplaySnapshot` |
| 压缩后继续对话 | 磁盘 transcript / rollout 物化出的当前模型上下文 | Core 内存上下文 | Core context messages |
| 实时流式文本 | Core live event | active turn buffer | `ThreadDisplayPatch` |
| 实时工具调用 | Core tool event | tool in-flight state | `ThreadDisplayPatch` |
| 工具完成后刷新 | transcript / persisted event | 可清空 live tool state | `ThreadDisplaySnapshot` 或可重放 patch |
| 页面刷新 | transcript / rollout | 不依赖内存 live buffer | `ThreadDisplaySnapshot` |

实时临时态可以存在，但它不是最终历史。一次 turn 完成后，刷新页面必须能从持久化 transcript 重新构建出一致的可见时间线。

压缩后的当前模型上下文可以比可见历史短得多。用户回看历史时可以看到压缩前内容；模型继续对话时只应该看到压缩摘要和压缩后的新内容。后续文档中凡是写 `messages`，都必须标明它是 `currentContextMessages` 还是 `displayReplayItems`，不要再用一个词覆盖两个语义。

## 推荐协议模型

第一版命名可以按实现情况微调，但语义必须保持稳定：

```ts
type ThreadDisplayItemType =
  | "user_message"
  | "assistant_message"
  | "thinking_summary"
  | "tool_call"
  | "tool_result"
  | "permission_request"
  | "todo_list"
  | "file_change"
  | "file_reference"
  | "attachment"
  | "system_notice"
  | "error"

type ThreadDisplayIdentity = {
  threadId?: string
  sessionId?: string
  turnId?: string
  itemId?: string
  messageUuid?: string
  parentUuid?: string | null
  toolUseId?: string
  parentToolUseId?: string
  sourceIndex?: number
}

type ThreadDisplayItem = {
  id: string
  type: ThreadDisplayItemType
  text: string
  status?: string
  sourceKind?: string
  createdAt?: string
  timelineHidden?: boolean
  identity?: ThreadDisplayIdentity
  content?: unknown
  metadata?: Record<string, unknown>
  projection?: ThreadDisplayProjection
}

type ThreadDisplayProjection = {
  version: 1
  event?: ThreadDisplayProjectedEvent
}

type ThreadDisplayProjectedEvent = {
  type: string
  text: string
  status?: string
  sourceKind?: string
  timelineHidden?: boolean
  identity?: ThreadDisplayIdentity
  todoSnapshot?: unknown
  toolSnapshot?: unknown
  fileToolSnapshot?: unknown
  fileSnapshot?: unknown
  attachmentSnapshot?: unknown
  attachmentSnapshots?: unknown[]
  referenceSnapshot?: unknown
  contentBlocks?: unknown[]
  errorSnapshot?: unknown
}

type ThreadDisplayCounts = {
  rawTranscriptEvents: number
  coreContextMessages: number
  projectedDisplayItems: number
  visibleTimelineItems: number
  hiddenDisplayItems: number
  filteredTranscriptEvents: number
  hiddenTimelineItems: number
}

type ThreadDisplaySnapshot = {
  threadId: string
  sessionId?: string
  source: "history" | "thread" | "live"
  generatedAt: string
  canonicalLeafUuid?: string
  items: ThreadDisplayItem[]
  counts: ThreadDisplayCounts
  diagnostics?: ThreadDisplayDiagnostic[]
}

type ThreadDisplayPatch = {
  threadId: string
  sessionId?: string
  generatedAt: string
  operations: ThreadDisplayPatchOperation[]
  counts?: ThreadDisplayCounts
}
```

实现以 `src/app-server/protocol.ts` 为准；本文不再使用早期草稿里的 `source: "resume" | "refresh"`、`canonicalCursor`、`ops` 这些字段名。

`ThreadDisplayItem` 应表达用户可见时间线项，而不是原始 transcript 行：

- 用户消息
- 助手正文
- 思考摘要或进度
- 工具调用卡
- 工具结果卡
- 文件变更卡
- 权限请求卡
- 系统提示 / 恢复提示
- 错误卡

原始 JSON、provider 原始内容块、debug 字段、低层事件 ID 默认不直接进入 UI，只能作为展开详情或日志数据。

## 计数口径

后续任何 UI 文案、日志或调试信息都不能再混用“历史事件数”这个笼统说法。至少区分这几种数：

| 字段 | 含义 | 用户是否应直接看到 |
| --- | --- | --- |
| `rawTranscriptEvents` | 磁盘 transcript / rollout 原始事件数。 | 通常只在调试里看到。 |
| `coreContextMessages` | Core 继续对话可用的上下文消息数。 | 可用于诊断，不等于可见卡片。 |
| `projectedDisplayItems` | App Server 投影后交给 Renderer 的展示候选项数量。 | 可用于解释过滤差异。 |
| `visibleTimelineItems` | Renderer 最终可见的时间线项数量。 | 用户侧默认看这个。 |
| `hiddenDisplayItems` | 展示候选项中被标记为不进主聊天时间线的数量。 | 调试或展开详情中使用。 |
| `filteredTranscriptEvents` | 原始 transcript 主线中没有投影成展示候选项的数量。 | 调试或解释差异时使用。 |
| `hiddenTimelineItems` | 兼容聚合值，等于 `hiddenDisplayItems + filteredTranscriptEvents`。 | 不用于普通恢复成功提示。 |

普通历史恢复成功提示不显示数量，只说明历史上下文已加载、可以继续对话。数量只放在调试、日志或诊断详情里。如果需要解释“raw 是 16，但界面只有 5 个可见项”，必须说明这是 `rawTranscriptEvents` 与 `visibleTimelineItems` 的差异，并进一步拆成 `hiddenDisplayItems` 与 `filteredTranscriptEvents`；不要在普通恢复提示里报数。

## 恢复流程

普通历史恢复只有一条主线：

```text
threadId / sessionId
-> transcript path
-> 读取完整事实源
-> 物化当前上下文并得到 canonical mainline
-> reducer/projector
-> ThreadDisplaySnapshot
-> Renderer replay
```

不变式：

1. 普通恢复不创建新 `sessionId`。
2. 普通恢复不从中间分叉。
3. 普通恢复不使用“短链”概念。
4. `parentUuid` 只是 transcript 链路字段，不是业务父子任务。
5. `sidechain` / agent 子任务可以展示或展开，但不能抢主线尾部。
6. `branch` / `fork` 必须显式创建新会话。
7. 恢复后继续写入时，新 turn 的第一条主线 user 消息必须以恢复出来的 canonical leaf 作为 `parentUuid`，后续 assistant / tool result 再顺序接到新消息，不能重新从 `null` 或旧短链起头。
8. canonical leaf 必须来自当前上下文物化结果，不能由 Core 和 App Server 分别用“最长链”等启发式独立选择。

## 实时流程

实时展示走增量 patch：

```text
Core event
-> App Server listener
-> active turn reducer
-> ThreadDisplayPatch
-> Renderer apply patch
```

实时事件的目标是“快显示”，不是替代持久化。完成态必须满足：

```text
实时展示结束后的 visible timeline
≈
刷新页面后从 transcript 构建出来的 visible timeline
```

这里的“≈”允许非事实性的 UI 状态不同，例如滚动位置、展开折叠状态、临时动画、复制按钮状态；不允许消息内容、工具结果、错误状态、权限结果、文件变更卡丢失。

## Renderer 边界

Renderer 允许做：

- 渲染 `ThreadDisplayItem`。
- 合并局部动画和滚动行为。
- 保存卡片展开状态、复制状态、选中状态。
- 展示 App Server 已经给出的计数和隐藏提示。

Renderer 不允许做：

- 直接读取或解释 transcript。
- 自己判断 `parentUuid`、`sidechain`、fork 主线。
- 在 snapshot / patch 主路径里自己把 raw provider/tool JSON 变成聊天卡片；缺失或非法 `projection` 必须视为展示协议错误。
- 历史恢复和实时展示各写一套展示逻辑。
- 用 replay action 数量冒充用户可见消息数量。

## App Server 边界

App Server 应成为统一展示投影层：

- `buildThreadDisplayFromTranscript(...)`：从磁盘事实源或共享当前上下文物化结果构建全量快照。
- `applyLiveEventToThreadDisplay(...)`：把实时事件增量投影成 patch。
- 两者复用相同的 reducer、隐藏规则、工具卡片规则、计数规则。

如果实现上需要缓存，可以缓存 projector 的中间结果，但缓存不能成为事实源。缓存丢失后必须能从 transcript 重新生成 snapshot。

当前代码落点：

- `src/app-server/threadDisplay.ts`：第一版 snapshot builder 和 live patch mapper。
- `src/display/threadDisplayProjection.ts`：shared display projector，输出 `projection.event` 以及工具、文件、附件、错误、TodoWrite、隐藏规则需要的 rich snapshot。
- `src/app-server/handlers/sessionHandlers.ts`：`thread/resume`、`thread/messages/list` 返回 `displaySnapshot`。
- `src/app-server/router.ts`：实时展示事件只发 `thread/display/patch`，生命周期状态只保留 `thread/started`、`turn/started`、`turn/completed`、`turn/cancelled`。
- `apps/desktop/src/main/threadDisplaySnapshotMerge.ts`：保护刷新时 snapshot 不被短结果覆盖。
- `src/display/threadDisplayProjectionSchema.ts`：对 `ThreadDisplayItem.projection` 做运行时校验。
- `apps/desktop/src/renderer/src/app/notificationRouter.ts` 和 `apps/desktop/src/renderer/src/domain/displayEvents.ts`：消费合法 `projection` 转成既有 `SessionAction` / display event；缺失或非法 projection 生成协议错误卡。
- `scripts/smoke-core-session-parent-chain.mjs`：验证 Core 恢复后继续写入时，`parentUuid` 接回 canonical leaf，并保持同一 transcript 文件内可追溯。

## 第一版实施顺序

1. 在 App Server 协议中定义 `ThreadDisplaySnapshot`、`ThreadDisplayPatch`、`ThreadDisplayItem`、`ThreadDisplayCounts`。
2. 把历史恢复链路改为返回 display snapshot，而不是让 Desktop 自己 replay 原始 transcript。
3. 把实时 notification 映射为 display patch，Renderer 只处理统一 patch。
4. 增加刷新一致性 smoke：发送一轮包含用户消息、助手流、工具调用、工具结果的会话，刷新后可见时间线一致。
5. 增加计数 smoke：验证 raw transcript events、core context messages、visible timeline items 三者可区分。
6. 保留旧接口兼容层，但新 UI 不再消费旧的 raw replay actions。
7. 抽出 shared display projector，并让 App Server snapshot / patch item 都携带 `projection`；Renderer 主路径使用 `projection`。
8. 清理旧展示兼容路径：旧 `messages` replay fallback、旧实时展示通知、缺失 projection raw fallback。
9. 对工具生命周期按来源 ID 归并：底层一工具调用一展示项，Renderer 可视觉归组，但不能改变协议语义。

## 不做的事

- 不把“短链”设计成正式架构。
- 不为历史恢复和实时展示各自维护一套消息格式。
- 不为了修 Desktop 显示而修改原始 Claude Code transcript 语义。
- 不把 OpenClaw 的多桶 UI 状态原样照搬成 CCR 最终协议；CCR 可以借鉴它的合并思想，但 App Server 对 Renderer 应输出统一展示模型。
- 不把 Codex 的 TUI 组件结构照抄到 Desktop；CCR 借鉴的是它的 reducer/replay 分层。

## 与现有文档关系

- [CCR 历史恢复与 transcript 语义](./session-resume-transcript-semantics.md)：定义主线、`parentUuid`、`sidechain`、fork/branch 语义。
- [CCR Desktop 输出展示与前端模块化方案](./desktop-output-display-and-modularization.md)：定义 Desktop 展示组件和用户可见事件边界。
- [CCR 模型输出归一化与展示标准](./model-output-normalization-and-display-standard.md)：定义 provider 输出进入展示层前的归一化原则。
- 本文补齐的是：历史恢复和实时展示在 App Server / Renderer 边界上的统一协议。
