# CCR 全事件统一 Ordered Display Reducer 设计方向

本文记录 ThreadDisplay 展示链路从当前状态继续走向“全事件统一 ordered display reducer”的方向。ODR-01 输入契约、ODR-02 单一 ordered state、ODR-03 projector 纯化和 ODR-04 旧分支清理已落地；FODR-01 输入协议硬化、FODR-02 `DisplayFact` 中间事实层、FODR-03 单状态机输出统一和 FODR-04 Desktop 纯消费与黄金回归已落地。当前权威实现以 [CCR ThreadDisplay Reducer 契约](./thread-display-reducer-contract.md) 为准，后续更大范围的全事件状态机应继续拆 goal 推进。

## 目标

当前已经完成的主路径是：

```text
历史 AppServerThreadMessage
实时 CoreTurnEvent
-> ThreadDisplayReducerInputEvent
-> ThreadDisplayReducer 单一 ordered state
-> ThreadDisplaySnapshot / ThreadDisplayPatch
```

当前已落地到：

```text
历史 transcript / 实时 Core event
-> adapter
-> 带 orderKey + sourceIdentity 的 ThreadDisplayReducerInputEvent
-> DisplayFact
-> ordered display reducer 唯一状态
-> ThreadDisplaySnapshot / ThreadDisplayPatch / diagnostics
-> Desktop Renderer
```

一句话：`orderKey` 解决“排哪儿”，`sourceIdentity` 解决“是谁”，`payload` 解决“带了什么内容”。

## 为什么不是推倒重来

不需要抛弃当前已完成的链路。应该保留：

- `ThreadDisplayReducerInputEvent` 统一输入入口。
- 历史 adapter：`AppServerThreadMessage -> ThreadDisplayReducerInputEvent`。
- 实时 adapter：`CoreTurnEvent -> ThreadDisplayReducerInputEvent`。
- `ThreadDisplaySnapshot.items` 和 `ThreadDisplayPatch.operations` 展示协议。
- `threadDisplayToolProjector`、`threadDisplayFileProjector`、`threadDisplayAttachmentProjector`、`threadDisplayErrorProjector`。
- 现有 smoke、diagnostic、projection error card。

仍可继续升级的是：

- projector 只做投影，不保存生命周期、不猜顺序。
- Renderer 只消费 snapshot / patch，不再补生命周期或 replay `messages`。

已经完成的是：

- input event 带统一 `orderKey`。
- input event 带统一 `sourceIdentity`。
- reducer 内部维护 `orderedItemIds + itemsById` 等唯一 ordered display state。
- Desktop main 不再合并 snapshot；Renderer 主路径不再按 raw `toolUseId` 合并 ThreadDisplay 协议项。

需要移除的是：

- 历史和实时各自偷偷拼展示项的重复路径。
- 按 raw 数组、到达时间、最长链、parent leaf 或 raw content 猜展示顺序。
- Renderer 侧 raw `toolUseId` 合并。
- 缺 projection 时 raw fallback 展示。
- `messages` 被当 UI replay 的路径。

## 原方案的问题

原方案的方向是对的，但还不够硬。

它已经把历史和实时都包成 `ThreadDisplayReducerInputEvent`，但没有把顺序和身份变成强约束。结果是后续仍可能出现：

- 历史靠数组顺序。
- 实时靠通知到达顺序。
- 工具结果靠 `toolUseId`。
- Renderer 有时靠 `itemId`。
- projector 有时靠内容类型临时判断。

这说明输入形状统一了，但展示事实的排序、身份和生命周期还没有统一。最终风险是：

```text
外面看起来统一
里面仍然是历史 snapshot 分支 + 实时 patch 分支 + projector 特殊判断 + Renderer 补逻辑
```

下一阶段要修的是这个边界。

## 输入事件形态

推荐未来把 `ThreadDisplayReducerInputEvent` 收敛成这种形态：

```ts
type ThreadDisplayReducerInputEvent = {
  threadId: string
  sessionId?: string
  turnId?: string
  itemId?: string

  source: 'history' | 'realtime'

  orderKey: ThreadDisplayOrderKey
  sourceIdentity: ThreadDisplaySourceIdentity
  payload: ThreadDisplayInputPayload

  diagnostics?: ThreadDisplayInputDiagnostic[]
}
```

这里不要把 `toolUseId` 看成消失了。它属于 `sourceIdentity.kind = 'tool'` 时的关键字段。

## orderKey

`orderKey` 只回答一个问题：这条事件应该排在哪里。

```ts
type ThreadDisplayOrderKey = {
  source: 'history' | 'realtime'
  ordinal: number
  timestamp?: string
  turnId?: string
  itemId?: string
}
```

历史 adapter 负责生成：

```ts
orderKey = {
  source: 'history',
  ordinal: rawIndex,
  timestamp: message.createdAt,
  turnId,
  itemId,
}
```

实时 adapter 负责生成：

```ts
orderKey = {
  source: 'realtime',
  ordinal: eventSequence,
  timestamp: event.createdAt,
  turnId,
  itemId,
}
```

规则：

- 新展示项按 `orderKey` 插入 ordered state。
- 同一展示项的后续 patch 不重新排序。
- `tool_result` 自己保留 `orderKey` 用于诊断，但展示位置跟随它绑定到的 `tool_use` 工具卡。
- 不能从 Renderer 或 projector 侧重新猜顺序。

## sourceIdentity

`sourceIdentity` 只回答一个问题：这条事件属于谁。

```ts
type ThreadDisplaySourceIdentity =
  | ToolSourceIdentity
  | MessageSourceIdentity
  | AttachmentSourceIdentity
  | FileSourceIdentity
  | ErrorSourceIdentity
  | SystemSourceIdentity
  | ControlSourceIdentity
```

工具身份：

```ts
type ToolSourceIdentity = {
  kind: 'tool'
  sourceId: string
  toolUseId?: string
  toolCallId?: string
  parentToolUseId?: string
  sourceToolAssistantUUID?: string
}
```

普通消息身份：

```ts
type MessageSourceIdentity = {
  kind: 'message'
  sourceId: string
}
```

附件身份：

```ts
type AttachmentSourceIdentity = {
  kind: 'attachment'
  sourceId: string
  parentSourceId?: string
}
```

错误身份：

```ts
type ErrorSourceIdentity = {
  kind: 'error'
  sourceId: string
  parentSourceId?: string
  toolUseId?: string
}
```

`toolUseId` / `toolCallId` 的职责：

- 绑定 `tool_use` 和 `tool_result`。
- 绑定 `progress` 到正在运行的工具卡。
- 支持同一 turn 内多个工具并行。
- 支持 result 乱序返回。

它们不能单独承担全局展示身份，因为普通消息、附件、系统提示、错误、compact、thinking notice 不一定有工具 ID。

## payload

`payload` 放事件带来的内容，但不直接决定最终 UI 卡类型。

```ts
type ThreadDisplayInputPayload =
  | { type: 'content_blocks'; blocks: CcrContentBlock[] }
  | {
      type: 'tool_event'
      phase: 'started' | 'progress' | 'completed' | 'failed'
      input?: unknown
      result?: unknown
    }
  | { type: 'attachment_event'; attachments: AttachmentSnapshot[] }
  | { type: 'file_event'; file: FileSnapshot }
  | { type: 'error_event'; error: ErrorSnapshot }
  | { type: 'system_event'; code: string; text?: string }
  | { type: 'unsupported'; rawType: string; reason: string }
```

注意：

- `payload.type` 是输入内容类型，不是最终卡片类型。
- 最终展示项仍由 reducer + projector 生成。
- 未知结构进入 `unsupported` / diagnostic，不走 silent legacy fallback。

## Reducer 状态

未来 reducer 内部维护唯一 ordered display state：

```ts
type ThreadDisplayReducerState = {
  orderedItemIds: string[]
  itemsById: Map<string, ThreadDisplayItem>
  displayIdBySourceIdentity: Map<string, string>
  toolLifecycleByToolUseId: Map<string, ToolLifecycleState>
  diagnostics: ThreadDisplayDiagnostic[]
  counts: ThreadDisplayCounts
}
```

处理规则：

1. 收到 input event。
2. 用 `sourceIdentity` 判断更新已有展示项，还是创建新展示项。
3. 创建新展示项时，用 `orderKey` 插入 `orderedItemIds`。
4. `tool_result` / `progress` 用 `toolUseId` 找原工具卡更新。
5. 找不到父项时，不插入当前末尾，不猜测，生成 diagnostic。
6. 输出 snapshot 或 patch。

## 历史与实时

历史路径：

```text
AppServerThreadMessage[]
-> appServerThreadMessagesToDisplayReducerInputEvents(...)
-> reducer.acceptMany(...)
-> reducer.toSnapshot()
```

实时路径：

```text
CoreTurnEvent
-> coreTurnEventToDisplayReducerInputEvent(...)
-> reducer.acceptOne(...)
-> reducer.consumePatch()
```

差异只允许存在于 adapter 和输出 view：

- 历史一次输入多条，输出 snapshot。
- 实时一次输入一条，输出 patch。
- reducer 内部状态机必须相同。

## Projector 边界

projector 可以做：

- 把 reducer 已确认的展示事实转成 `ThreadDisplayItem` 或 patch payload。
- 格式化工具摘要、文件摘要、附件元信息、错误诊断。
- 提供视觉 tone、title、status、actions、details。
- 按 reducer 确认的 `contentIndex` / `primaryBlock` / 唯一匹配块选择投影输入。

projector 不允许做：

- 保存生命周期状态。
- 决定历史 / 实时顺序。
- 自己补 tool_result 父链。
- 扫描 raw content 猜测工具块、附件块或模型输出块。
- 从 raw block 反推 `toolUseId` / `parentToolUseId` / `threadId` / `turnId`。
- 把 unknown raw content 静默转成主时间线消息。
- 回退到旧 display replay 路径。

## Desktop 边界

Desktop main：

- 只保存 `ThreadDisplaySnapshot`。
- `thread/resume` 和 `thread/messages/list` 只消费 `displaySnapshot`。
- 实时只消费 `ThreadDisplayPatch`。

Desktop Renderer：

- 只把 snapshot / patch 转成视觉 `DisplayEvent` / component。
- 不按 raw `toolUseId` 合并工具。
- 不 replay `messages`。
- 不解释 transcript / provider raw block / local path text。

## 分阶段落地

当前已经完成的阶段见：[ThreadDisplay Ordered Display Reducer Goal Plan](../goals/2026-05-29-thread-display-ordered-reducer-goal-plan.md)。

已完成：

1. ODR-01：输入入口封口与 `orderKey` / `sourceIdentity` 契约。
2. ODR-02：单一 ordered display reducer state。
3. ODR-03：projector 纯化。
4. ODR-04：旧分支清理与 smoke 固化。

后续最终状态机拆分见：[Full Ordered Display Reducer Final State Machine](../goals/2026-05-30-full-ordered-display-reducer-final-state-machine.md)。

建议继续拆成四个 FODR goal：

1. FODR-01：输入协议硬化。
   - 把 `ThreadDisplayReducerInputEvent` 从统一类型升级为硬协议。
   - 所有展示输入必须先通过 adapter。
   - 增加运行时校验，未知输入进入 diagnostic / protocol error card。
   - 已完成：adapter 输出和 reducer 入口都执行协议断言，`diagnostics` 是硬字段，unsupported 输入会进入 reducer diagnostics 和协议错误展示项。

2. FODR-02：`DisplayFact` 中间事实层。
   - 在 input event 和最终 `ThreadDisplayItem` 之间增加 reducer 认可后的展示事实。
   - projector 只消费已确认 fact，不再解释 raw content。
   - 已完成：`ThreadDisplayFact` 覆盖 message、tool lifecycle、file、attachment、error、system、control、unsupported；reducer 历史 / 实时路径先解析 fact，再生成展示项或 patch；projector 优先使用 `metadata.displayFact` 限定投影范围。

3. FODR-03：单状态机输出统一。
   - snapshot 和 patch 彻底成为同一 reducer state 的两种输出 view。
   - 工具 lifecycle、附件、错误、system/control 都作为同一 state transition 处理。
   - 已完成：实时路径先执行 state transition，再导出 patch operation；历史路径通过 `reducer.toSnapshot(...)` 输出 snapshot；重复 completed tool_use 不再生成 patch，并行工具和乱序 result 继续收敛到同一工具卡。

4. FODR-04：Desktop 纯消费与黄金回归。
   - Desktop main / Renderer 只消费 `ThreadDisplaySnapshot.items` / `ThreadDisplayPatch.operations`。
   - 建立历史 replay 与实时 patch 等价的黄金回归。
   - 证明没有 silent legacy fallback。
   - 已完成：Desktop main 移除 snapshot merge，刷新时直接保存 `displaySnapshot`；`smoke:desktop-session-state` 固定历史 snapshot 和实时 patch 经 Desktop 后的最终 `DisplayEvent` 等价，并覆盖用户图片、assistant 文本、thinking-only、compact、TodoWrite、模型生成图片、并行/乱序工具结果、orphan result、turn error 和 unsupported diagnostic。

## 验收标准

最终完成时必须满足：

- 所有展示输入都有 `orderKey`。
- 所有展示输入都有 `sourceIdentity`。
- 历史和实时只通过 adapter 进入 reducer。
- reducer 内部只有一份 ordered display state。
- 工具生命周期只在 reducer 归并。
- projector 不保存跨事件状态。
- Renderer 不猜顺序、不猜工具、不 replay `messages`。
- 未知事件进入 diagnostic / protocol error card。
- `ThreadDisplaySnapshot.items` 和 `ThreadDisplayPatch.operations` 仍是 Desktop 权威展示协议。

## 非目标

- 不把模型上下文链路和 UI 展示链路合并。
- 不让 `currentContextMessages` 承担 UI 历史。
- 不改变 provider adapter 的原始协议职责。
- 不把 Desktop 视觉组件重构混进 reducer 状态机 goal。
- 不在没有 smoke 的情况下删除 legacy 兼容入口。
