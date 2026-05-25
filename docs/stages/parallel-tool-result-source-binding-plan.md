# 并行工具结果来源绑定修改计划

本文记录 2026-05-24 针对历史恢复、实时展示和并行工具结果绑定问题的完整修改计划。

核心结论：并行工具不是多条会话分支，工具结果也不是新的会话 leaf。工具展示必须按来源指针绑定回对应工具调用。

```text
Codex:
tool begin.call_id == tool end.call_id

Claude / Anthropic:
tool_use.id == tool_result.tool_use_id

CCR:
归一化工具调用 ID（`normalizedToolUseId`）作为工具卡主键和结果回填键
```

## 背景

当前 CCR 已经完成历史恢复和实时展示协议的一轮统一，但并行工具场景还有一个更细的问题：

- 同一个 assistant message 里可能有多个 `tool_use`。
- 多个 `tool_result` 的返回顺序可能和 `tool_use` 顺序不同。
- `parentUuid` 链式恢复容易把多个 tool result terminal 误看成多个 leaf。
- 旧的 message 级展示投影容易把一个含多个工具块的消息压成一个展示项。

这会导致三个风险：

- 历史恢复丢工具结果。
- UI 把结果按返回顺序摆错位置。
- 多个 tool result 被误判为多个主线 leaf。

## 源码依据

Codex 的关键语义不是显式 `order` 字段，而是 rollout JSONL 的追加顺序和 `call_id` upsert：

- `codex-rs/app-server-protocol/src/protocol/thread_history.rs`
  - dynamic tool request / response 都使用 `payload.call_id` 作为 `ThreadItem::DynamicToolCall.id`。
  - MCP tool begin / end 都使用 `payload.call_id` 作为 `ThreadItem::McpToolCall.id`。
  - `upsert_turn_item(...)` 按 `item.id()` 查找已有展示项，找到则替换，不移动位置。
- `codex-rs/rollout/src/recorder.rs`
  - rollout 按追加顺序写 JSONL。
  - 恢复时按文件行顺序读取。

OpenClaw 也不把工具结果当会话分支。它把工具调用和工具结果作为消息内容块或 chat display message 处理，再由展示投影合并。

详细证据见：

- `docs/references/codex-openclaw-live-history-source-evidence.md`
- `docs/architecture/realtime-history-display-contract.md`
- `docs/architecture/session-context-materialization-repair.md`

## 目标

1. 支持同一 turn 内多个并行工具调用。
2. 支持 tool result 乱序返回，但结果必须绑定回正确 tool。
3. 历史恢复和实时展示使用同一套工具生命周期归并器语义。
4. `tool_result` 不参与主线 leaf 竞争。
5. UI 工具卡位置由 `tool_use` 首次出现决定，结果只更新卡片状态和内容。
6. Core 当前上下文和 UI 可见历史继续分开，不因为 compact 裁掉 UI 历史。

## 术语口径

后续讨论、实现、测试和文档统一使用以下术语，避免同一概念多套说法：

| 术语 | 含义 |
| --- | --- |
| `tool_use` / 工具调用 | assistant message 中请求执行工具的内容块，是工具展示项的创建来源。 |
| `tool_result` / 工具结果 | user message 中返回工具执行结果的内容块，只能通过来源指针回填对应工具展示项。 |
| 来源指针 | `tool_result.tool_use_id`，用于指向它对应的 `tool_use.id`。 |
| 工具展示项 | 协议层的一条 `ThreadDisplayItem`，一个工具调用对应一条工具展示项。 |
| 视觉工具组 | Renderer 可以把同一 turn / 同一 assistant message 内的多个工具展示项视觉上归在一起，但它不是协议事实源。 |
| 当前模型上下文 | Core 继续对话使用的上下文，会应用 compact / snip / sidechain 语义。 |
| 可见历史回放 | UI 历史展示使用的事件流，不因为 compact 裁掉压缩前可见内容。 |
| 展示投影 | App Server 输出给 Renderer 的 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 协议数据。 |
| 归并器 | 按工具来源 ID 把 tool call / tool result / failed / permission 等事件合并为稳定展示状态的逻辑。 |
| leaf | 会话主线上的末端节点。`tool_result` 不是 leaf 候选。 |
| 孤立工具结果 | 找不到对应 `tool_use` 的 `tool_result`，只能生成诊断展示项，不能伪装成正常工具卡。 |

## 不变式

### 会话不变式

- 普通历史恢复只有一条主线。
- `sidechain` / 子任务不进入主线。
- fork / branch 是新会话语义，不混入原会话恢复。
- 多个 main leaf 是异常诊断，不使用最长链兜底。

### 顺序不变式

- transcript JSONL 物理行顺序是底层事实源。
- 物化层可以裁剪、relink、恢复上下文，但必须保留内部 `rawIndex` / `materializedIndex` 用于诊断和稳定投影。
- UI 工具卡展示顺序由工具调用首次出现位置决定：
  - message 级：`rawIndex`
  - content block 级：`contentIndex`
- tool result 返回早晚不决定展示位置。

### 工具绑定不变式

- `tool_use.id` 是工具调用主键。
- `tool_result.tool_use_id` 是结果来源指针。
- `tool_result` 找到对应 `tool_use` 时，只 update / complete 对应工具卡。
- 找不到对应 `tool_use` 时，生成孤立工具结果诊断卡。
- 同一个工具卡不能因为 result 事件晚到而改变位置。
- 协议层必须拆开：一个工具调用对应一条工具展示项。
- 视觉层允许归组：同一 turn / 同一 assistant message 内的多个工具卡可以在 UI 上呈现为工具组，但不能合并成一个协议展示项。

绑定算法必须固定为：

```text
看到 tool_use:
  key = normalizeToolUseId(tool_use.id)
  如果 key 为空 -> 生成协议错误诊断项
  如果工具展示项不存在 -> 按 tool_use 首次出现位置追加工具展示项
  如果工具展示项已存在 -> 只更新 call content 和诊断信息，不移动位置

看到 tool_result:
  key = normalizeToolResultSourceId(tool_result.tool_use_id)
  如果 key 命中已有工具展示项 -> 回填 result content，更新状态为 completed / failed / interrupted
  如果 key 未命中 -> 追加孤立工具结果诊断项
  无论 result 先后顺序如何，都不能改变工具展示项位置
```

### 身份字段不变式

工具展示项的 `ThreadDisplayItem.identity` 至少要能表达以下来源身份：

```ts
type ToolDisplayIdentity = {
  toolUseId: string
  messageUuid?: string
  parentUuid?: string | null
  turnId?: string
  rawIndex?: number
  materializedIndex?: number
  contentIndex?: number
  sourceKind: 'tool_use' | 'tool_result' | 'diagnostic'
}
```

字段名可以按现有协议微调，但语义不能缺失：

- `toolUseId` 是工具展示项主键和结果回填键。
- `rawIndex` 用于指向 transcript 原始物理顺序。
- `materializedIndex` 用于指向物化后事件顺序。
- `contentIndex` 用于区分同一 message 内多个内容块。
- `sourceKind` 用于区分正常工具调用、工具结果诊断和协议错误。

### 历史 / 实时一致性不变式

- 同一个 fixture 走历史快照构建和走实时增量补丁回放，最终 normalized timeline 必须一致。
- 一致性比较至少包含：展示项数量、展示项 ID、工具顺序、工具状态、结果绑定关系、错误诊断类型。
- 实时临时态可以存在，但 snapshot 到达后必须由 App Server 事实源覆盖。
- 页面刷新、切换会话、重启 CCR DEV 后，展示结果不能回退到旧路径或旧上下文。

### 视觉归组边界

- 协议层永远保持一工具调用一工具展示项。
- Renderer 可以按 `turnId`、assistant message 来源或相邻工具项做视觉归组。
- 视觉工具组不能拥有独立的工具生命周期状态。
- 视觉工具组不能吞掉单个工具展示项的 `toolUseId`、状态、错误、权限和结果内容。
- 视觉归组只是排版，不改变 snapshot / patch 的协议语义。

### 旧异常数据边界

- 旧 transcript 中已经存在的断链、多个 main leaf、缺失 tool source 等异常，只输出诊断，不做静默修复。
- 不为了旧异常数据恢复“最长链优先”兜底。
- 新产生的数据必须满足：主线唯一、工具结果不参与 leaf、compact 不裁 UI 历史、工具结果按来源 ID 回填。
- 如果旧异常数据无法完整展示，必须在诊断中说明缺失来源，而不是生成看似正常的历史卡片。

### 验证环境不变式

- dev / smoke / 手工回归必须确认当前运行入口是否使用最新源码或最新构建产物。
- 任何 smoke 如果通过 `cli.js`、`dist`、Electron main 或打包入口执行，必须先确保 `npm.cmd run build` 已同步产物。
- 不允许在源码已改、`dist` 未更新的状态下把旧产物行为当成当前实现结论。
- 如果验证动作会影响用户当前正在使用的 CCR DEV 主入口，执行前必须说明主入口、临时验证入口和影响范围。

## 最终数据模型

物化层、展示层和实时增量补丁必须能表达同一套工具生命周期语义：

```ts
type OrderedTranscriptMessage = {
  rawIndex: number
  message: TranscriptMessage
}

type MaterializedDisplayEvent = {
  materializedIndex: number
  rawIndex?: number
  turnIndex?: number
  turnStepIndex?: number
  messageUuid?: string
  parentUuid?: string | null
  contentIndex?: number
  toolUseId?: string
  parentToolUseId?: string
  kind:
    | 'user_message'
    | 'assistant_message'
    | 'tool_call'
    | 'tool_result'
    | 'system_notice'
    | 'error'
  content: unknown
}

type ToolDisplayState = {
  itemId: string
  toolUseId: string
  threadId?: string
  turnId?: string
  firstSeen: {
    rawIndex?: number
    materializedIndex: number
    turnIndex?: number
    turnStepIndex?: number
    contentIndex?: number
  }
  status: 'running' | 'completed' | 'failed' | 'interrupted'
  callContent: unknown
  resultContent?: unknown
}
```

实现时字段名可以按现有协议微调，但语义不能变。

## 修改计划

### Goal 1：显式保留 transcript 物理顺序

目标：让物化层知道每条 transcript message 来自第几条 JSONL 记录。

改动方向：

- 在 `src/utils/sessionStorage.ts` 或新增轻量读取入口中，为 transcript message 生成 `rawIndex`。
- 不把 `rawIndex` 写回原始 transcript。
- 新增 `loadOrderedTranscriptFile(...)` 或等价的有序 transcript 视图入口，原有 `loadTranscriptFile(...)` 只保留兼容读取职责。
- 有序 transcript 视图必须包含消息 uuid、父级 uuid、sidechain 标记、timestamp、rawIndex 和原始 entry。
- 有序 transcript 视图必须成为 `conversationMaterialization.ts` 的输入，不允许物化层再从 `Map` 插入顺序反推原始行号。

验收：

- 同一个 transcript 重复读取，`rawIndex` 稳定。
- compact / snip / preservedSegment 处理后，诊断仍能指出原始来源位置。
- malformed JSONL 行被跳过时，诊断要能说明跳过数量；有效 entry 的 `rawIndex` 仍指向原始文件行序。

### Goal 2：物化层拆分当前上下文和可见历史

目标：同一个 transcript 解释层输出两个投影。

改动方向：

- `src/utils/conversationMaterialization.ts` 输出：
  - `currentContextMessages`：Core 继续对话使用，应用 compact / snip / sidechain 语义。
  - `displayReplayMessages` 或 `displayReplayEvents`：UI 可见历史使用，不因为 compact 裁掉压缩前可见内容。
  - `diagnostics`：异常只诊断，不静默最长链兜底。
- 保留现有 `messages` 字段时必须改名或加注释，明确它是当前模型上下文兼容字段，不能再被误认为完整 UI 历史。
- `MaterializedConversation` 必须显式包含：
  - `currentContextMessages`
  - `displayReplayEvents`
  - `canonicalLeafUuid`
  - `rawTranscriptEvents`
  - `materializedTranscriptEvents`
  - `currentContextMessageCount`
  - `displayReplayItemCount`
  - `diagnostics`

验收：

- compact 后 Core context 变短。
- compact 后 UI 历史仍可展示压缩前可见内容。
- 多 main leaf 不再静默选最长。
- `thread/resume` 不再把 Core 当前上下文当作 UI 完整历史。

### Goal 3：工具调用和工具结果按来源 ID 绑定

目标：把工具生命周期从消息 uuid / 返回顺序切到工具调用 ID（`toolUseId`）。

改动方向：

- 归一化工具调用 ID：
  - `tool_use.id`
  - `toolUseId`
  - `toolUseID`
  - `tool_use_id`
- 归一化工具结果来源 ID：
  - `tool_result.tool_use_id`
  - `toolUseId`
  - `toolUseID`
  - `toolCallId`
  - `tool_call_id`
- 历史回放和实时增量补丁共用同一套归并语义：

```text
看到 tool_use:
  key = tool_use.id
  如果不存在 -> 追加工具卡
  如果存在 -> update call content

看到 tool_result:
  key = tool_result.tool_use_id
  如果找到工具卡 -> 完成或更新该工具卡
  如果找不到 -> 追加孤立工具结果诊断项
```
- 归并器必须保存工具卡首次出现位置，后续结果更新不能移动卡片。
- 归并器必须支持同一个助手消息内多个 `tool_use`。
- 归并器必须支持一个用户消息内多个 `tool_result`。
- 归并器必须支持 `tool_result` 到达顺序与 `tool_use` 顺序不同。

验收：

- `tool_result B` 先回来、`tool_result A` 后回来时，B 只更新 B 卡，A 只更新 A 卡。
- 卡片顺序仍按 `tool_use A`、`tool_use B` 的首次出现顺序。
- 同一工具调用不会生成两张卡。
- result 缺少来源 ID 时只能进入孤立诊断卡。

### Goal 4：历史展示从消息级映射改为内容块级归并器

目标：一个 transcript message 可以生成多个展示项。

当前问题：

- `src/app-server/threadDisplay.ts` 现在从 `messages.map(...)` 生成展示项（`ThreadDisplayItem`）。
- 这会把一个含多个 `tool_use` 的 assistant message 压成一个展示项。

改动方向：

- 将历史快照构建器改为内容块级归并器：
  - 文本内容生成 user / assistant message。
  - 每个 `tool_use` 生成或更新一个工具卡。
  - 每个 `tool_result` 按来源 ID 回填工具卡。
  - compact boundary 生成一张轻量系统提示卡。
  - progress / permission / file / attachment / error 按现有展示投影语义生成对应展示项。
- `ThreadDisplayItem.id` 对工具卡使用稳定派生：

```text
tool:${toolUseId}
orphan-tool-result:${messageUuid}:${contentIndex}
```

验收：

- 一个 assistant message 里多个 `tool_use` 能生成多个工具卡。
- `ThreadDisplayItem.identity` 中能看到 `toolUseId`、`messageUuid`、`sourceIndex` / `rawIndex`、`contentIndex`。
- 快照内展示项顺序稳定：文本消息按物化顺序，工具卡按 tool_use 首次出现位置。
- 恢复出的 snapshot 与实时完成后的最终展示项数量一致。
- UI 允许把同源工具卡视觉归组，但 snapshot 中仍保留独立工具展示项。

### Goal 5：展示投影保持一条展示项一个主语义

目标：不要让展示投影层在一条展示项里猜多个工具块。

当前问题：

- `src/display/threadDisplayProjection.ts` 里 `extractToolSnapshotFromBlocks(...)` 遇到第一个 `tool_use` / `tool_result` 就返回。

改动方向：

- App Server 在进入展示投影前先拆成单语义展示项（`ThreadDisplayItem`）。
- 展示投影继续处理一条展示项的一个主语义：
  - 一个工具调用卡。
  - 一个工具结果诊断卡。
  - 一个文本消息。
  - 一个系统提示。
- TodoWrite 仍可走专用 todo 展示投影，但同样以单个 `toolUseId` 为主键。
- `extractToolSnapshotFromBlocks(...)` 不能再承担多工具块拆分职责。
- 展示投影 schema 必须校验 `identity.toolUseId`、`identity.contentIndex`、`identity.raw.sourceIndex/rawIndex` 的合法性。

验收：

- 展示投影不再因为只看第一个 block 而丢第二个工具。
- 缺展示投影仍然生成协议错误卡，不回退 raw 解析。
- 一个展示投影事件只对应一个主展示语义。

### Goal 6：实时增量补丁使用同一套工具生命周期语义

目标：历史恢复和实时展示行为一致。

改动方向：

- `thread/display/patch` 的 `append_item` / `complete_item` 按 `toolUseId` 使用同一 itemId。
- 实时工具开始时 append 卡片。
- 实时工具结果回来时 complete/update 同一卡片。
- 如果实时结果先于调用到达，必须生成 pending-orphan 诊断状态；同一归并器后续看到对应调用时，按来源 ID 回填并保留诊断 metadata。
- permission request / permission cancelled / turn failed / context compacted 继续通过 `thread/display/patch` 进入同一归并器，不恢复旧 `item/*` 展示通知。

验收：

- 页面刷新前后工具卡数量、顺序、状态一致。
- 实时和历史都不会出现同一个工具调用两张卡。
- 旧实时通知不会绕过展示增量补丁直接进入 Renderer。

### Goal 7：Renderer 状态归并和清理收口

目标：Renderer 只消费 App Server 展示协议，不再自行合并工具来源。

改动方向：

- `apps/desktop/src/renderer/src/app/sessionState.ts` 只按展示增量补丁（`ThreadDisplayPatch`）和展示快照（`ThreadDisplaySnapshot`）归并更新时间线。
- `ChatTimeline` 不再根据 raw content 自己拆 tool blocks。
- 工具卡、权限卡、文件卡、TodoWrite 浮层只消费展示投影。
- snapshot 切换、工作区切换、线程切换必须清理旧 pending-orphan / active tool 状态。
- 保留 optimistic user input，但它只作为本地临时态；snapshot 到达后由 App Server 事实源覆盖。

验收：

- Renderer 缺展示投影时只展示协议错误卡。
- 切换会话不会残留上一个会话的 running tool / pending permission。
- 刷新页面后 timeline 由 snapshot 完整恢复。

### Goal 8：旧兼容路径清理

目标：删除会再次绕回旧错误语义的兼容入口。

改动方向：

- Desktop main 不再缓存旧 `threadMessages` 作为展示状态。
- `thread/messages/list` 若保留 `messages`，必须标注为兼容接口或当前上下文接口，不进入 Desktop 展示主路径。
- 清理旧 `messages` replay fallback。
- 清理 raw content fallback。
- 清理旧 `item/*`、`permission/*`、`context/compacted`、`turn/failed` 展示通知路径。
- `dist` 产物必须和源码同步，避免 dev / smoke 跑旧 dist。

验收：

- 搜索不到 Renderer 主路径消费旧 `threadMessages`。
- 快照或增量补丁缺失展示投影时不会被 raw fallback 渲染成正常卡片。
- `npm.cmd run build` 后 `dist` 与源码行为一致。

### Goal 9：冒烟测试覆盖并行工具和异常边界

目标：把这次问题变成可回归测试，并覆盖历史、实时、刷新、压缩和异常诊断。

覆盖以下场景：

1. 一个 assistant message 内两个 `tool_use`，按 `contentIndex` 生成两张卡。
2. `tool_result B` 先于 `tool_result A` 到达，最终分别回填到 B / A。
3. tool result 缺少 `tool_use_id`，生成孤立工具结果诊断卡。
4. tool result 指向不存在的 tool_use，生成孤立工具结果诊断卡。
5. compact 后恢复：Core context 变短，display history 不丢。
6. 多 main leaf：输出 error diagnostic，不走最长链。
7. 实时增量补丁与历史快照对同一 fixture 的展示结果一致。
8. 页面刷新后工具卡顺序和状态不变。
9. 切换会话再切回后，上下文大小和工具卡状态不回退。
10. `dist` 入口冒烟测试确认没有跑旧构建产物。

必跑命令：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:app-server
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:conversation-materialization
git diff --check
```

### Goal 10：真实桌面端手工回归

目标：用真实 CCR DEV 验证用户可见体验。

回归项目：

1. 普通问答实时展示。
2. 一个 turn 内多个工具调用。
3. 多个工具结果乱序返回。
4. 工具执行失败。
5. 权限请求、拒绝、取消。
6. 上下文手动压缩。
7. 上下文自动压缩。
8. 压缩后继续发消息。
9. 切换到其他会话再切回。
10. 刷新页面。
11. 重启 CCR DEV。
12. 恢复历史会话。
13. 历史恢复后继续对话。
14. compact 前旧 UI 历史可见，Core context 不回到 compact 前。
15. 孤立工具结果显示诊断卡，不伪装成正常工具卡。

验收：

- 用户可见 timeline 与实时结束状态一致。
- 顶部上下文 token 显示与 Core 当前上下文一致。
- 历史 UI 不因为 compact 被裁掉。
- 工具结果不会重复成 assistant 普通文本。
- 没有 `缺少 ThreadDisplayItem.projection` 的正常路径错误。

### Goal 11：文档、规则和发布说明收口

目标：让后续开发不会再回到旧语义。

改动方向：

- 更新 `docs/architecture/realtime-history-display-contract.md`：
  - 补充工具来源绑定规则。
  - 明确展示顺序和底层事件顺序的区别。
- 更新 `docs/architecture/session-context-materialization-repair.md`：
  - 补充 `currentContextMessages` / `displayReplayEvents` 最终字段语义。
- 更新 `docs/references/codex-openclaw-live-history-source-evidence.md`：
  - 补充 Codex `call_id` upsert 证据。
- 更新 `docs/stages/realtime-history-display-contract-todo.md`：
  - 将本计划完成项同步到当前任务列表。
- 更新项目规则：
  - 不修改原始 Claude Code transcript 存储语义。
  - 工具结果必须按来源 ID 回填，不参与 leaf 竞争。
  - App Server / Renderer 不得新增 raw fallback 展示主路径。
- 更新发布说明：
  - 说明桌面端展示主路径切到只消费展示投影。
  - 说明旧 replay / raw fallback 被移除。
  - 说明并行工具结果乱序返回已支持。

验收：

- 架构文档、todo、goal 和 release note 口径一致。
- 新增规则能被后续开发直接引用。
- 没有文档仍把 compact context 当完整 UI history。

## 实施顺序

按以下固定顺序推进：

1. Goal 1：补有序 transcript 视图。
2. Goal 2：让物化层输出当前模型上下文 / 可见历史回放两个投影。
3. Goal 3：实现工具来源 ID 归一化和生命周期归并器。
4. Goal 4：历史快照构建器改成内容块级归并器。
5. Goal 5：展示投影收口为一条展示项一个主语义。
6. Goal 6：实时增量补丁接入同一生命周期归并器。
7. Goal 7：Renderer 状态归并和清理收口。
8. Goal 8：旧兼容路径清理。
9. Goal 9：补冒烟测试覆盖。
10. Goal 10：真实桌面端手工回归。
11. Goal 11：文档、规则和发布说明收口。

每完成一个 goal 立即运行对应验收命令，验收失败不能进入下一项。

## 明确不做

- 不修改原始 Claude Code transcript 存储语义。
- 不把 `parentUuid` 从原始 transcript 删除。
- 不把 tool result 当成会话 leaf。
- 不为了旧异常 transcript 保留“最长链优先”兜底。
- 不让 Renderer 重新解释 transcript 或 raw tool event。
- 不把 compact 后的当前模型上下文当完整 UI 历史。

如确实需要改原始 Claude Code 基线逻辑，必须先单独评估并征求用户确认。

## 完成定义

本计划完成时，应满足：

- 并行 tool 在历史恢复和实时展示中都不丢。
- 结果乱序返回不会错绑工具。
- 工具卡顺序由 tool_use 来源位置决定。
- tool_result 只通过来源 ID 回填，不参与 leaf 竞争。
- 页面刷新、切会话、重启后展示结果和实时结束状态一致。
- 相关冒烟测试覆盖进入长期验证命令。
- 文档、todo、规则、release note 全部收口。
