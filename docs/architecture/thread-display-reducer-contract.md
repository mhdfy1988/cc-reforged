# CCR ThreadDisplay Reducer 契约

本文记录当前 ThreadDisplay reducer 的真实架构边界。它是 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 展示链路的实现依据，配合 [CCR 会话上下文与展示链路权威契约](./session-context-and-display-contract.md) 使用。

## 目标

ThreadDisplay reducer 负责把历史恢复和实时事件统一投影成 Desktop 可消费的展示协议。

```text
历史输入 AppServerThreadMessage[]
实时输入 CoreTurnEvent
-> ThreadDisplayReducerInputEvent
-> ThreadDisplayReducer
-> ThreadDisplaySnapshot / ThreadDisplayPatch
```

它不负责生成模型上下文，不负责读取 transcript，也不负责 Renderer 视觉渲染。

## 输入层

权威代码：

- `src/app-server/threadDisplayInputEvent.ts`
- `src/app-server/threadDisplayFacts.ts`

输入事件类型：

```ts
ThreadDisplayReducerInputEvent
ThreadDisplayHistoryMessageInputEvent
ThreadDisplayRealtimeInputEvent
```

adapter：

```text
AppServerThreadMessage[]
-> appServerThreadMessagesToDisplayReducerInputEvents(...)
```

```text
CoreTurnEvent
-> coreTurnEventToDisplayReducerInputEvent(...)
```

输入层只做标准化和 source identity 补齐；展示语义解释由 `ThreadDisplayFact` 层承担，不允许 projector 或 Desktop 重新从 raw event 猜语义。

展示事实层：

```text
ThreadDisplayReducerInputEvent
-> resolveThreadDisplayFacts(...)
-> ThreadDisplayFact
-> ThreadDisplayReducer state transition
-> snapshot / patch output view
```

`ThreadDisplayFact` 覆盖 message、tool lifecycle、file、attachment、error、system、control 和 unsupported。reducer 写入 `ThreadDisplayItem.metadata.displayFact`，projector 只按这些已确认事实限定投影范围。

## Reducer 状态机

权威代码：

- `src/app-server/threadDisplay.ts`
- `ThreadDisplayReducer`
- `createThreadDisplayReducer(...)`

状态机当前维护：

- ordered display state：
  - `orderedItemIds`：展示顺序来源。
  - `itemsById`：展示项事实来源。
  - `orderKeysByItemId`：展示项排序诊断来源。
  - `displayIdBySourceIdentity`：输入身份到展示项的绑定表。
  - `toolLifecycleByToolUseId`：工具调用到展示项的绑定表。
  - `diagnostics`：协议和输入诊断。
  - `counts`：诊断 / telemetry 计数。
- `pendingPatchOperations`
- 工具 lifecycle reducer
- `threadId`
- `sessionId`

历史 snapshot 和实时 patch 都从这份 state 派生。历史恢复使用 `acceptMany(...).toSnapshot(...)` 输出 `orderedItemIds + itemsById` 对应的 snapshot view；实时事件使用 `acceptOne(...)` 先执行同一套 state transition，再把本次状态变化导出为 pending patch operations。

历史路径：

```text
createThreadDisplayReducer(...)
  .acceptMany(historyInputEvents)
  .toSnapshot(...)
```

实时路径：

```text
createThreadDisplayReducer(...)
  .acceptOne(realtimeInputEvent)
  .consumePatchOperations()
```

实时 turn 会按 thread / turn 复用 reducer 实例，保证同一个工具调用的 started / progress / result / failed / interrupted 可以稳定更新同一张工具卡。

## 输出协议

历史输出：

```ts
ThreadDisplaySnapshot = {
  threadId,
  sessionId?,
  source,
  generatedAt,
  items,
  counts,
  diagnostics?,
}
```

实时输出：

```ts
ThreadDisplayPatch = {
  threadId,
  sessionId?,
  generatedAt,
  operations,
  counts?,
}
```

权威边界：

- `ThreadDisplaySnapshot.items` 是历史展示权威。
- `ThreadDisplayPatch.operations` 是实时展示权威。
- `ThreadDisplayCounts` 只做诊断和 telemetry。
- `ThreadDisplayDiagnostic` 用于保留协议或物化异常，不替代展示项。
- UI 历史顺序只来自 reducer state 的 `orderedItemIds`，不来自 counts 或 Renderer 侧重排。

## Projector 边界

ThreadDisplay reducer 可以调用 projector，但 projector 不能变成第二套 reducer。

| Projector | 当前职责 |
| --- | --- |
| `threadDisplayProjection.ts` | 展示投影总分派、普通消息、系统类投影入口。 |
| `threadDisplayToolProjector.ts` | 工具 snapshot、工具分类、状态、耗时、错误归因和主时间线隐藏策略。 |
| `threadDisplayFileProjector.ts` | 文件 snapshot、搜索引用、路径安全、文本范围、diff 和文件动作。 |
| `threadDisplayAttachmentProjector.ts` | 附件快照、模型输出路径清理、用户图片占位清理。 |
| `threadDisplayErrorProjector.ts` | 工具错误和 App Server 错误 snapshot。 |

投影器只能把 reducer 已确定的展示事实转换成 `ThreadDisplayProjection`，不能自己维护跨事件生命周期。

FODR-02 后，projector 优先消费：

- `item.metadata.displayFact`
- `item.metadata.primaryBlock`
- `item.metadata.attachmentBlocks`
- reducer state item 上已有的 lifecycle / compact / diagnostic metadata

如果这些事实存在，projector 不得再扫描混合 raw blocks 来发明工具、文件、附件或错误语义。

ODR-03 后，projector 选择内容块必须走确认事实：

- `item.identity.contentIndex`
- `item.metadata.primaryBlock`
- 同类型块只有一个时的确定性选择

projector 不允许为了“看起来能显示”扫描所有 raw block 并猜测目标块，也不允许从 raw block 反推 `toolUseId`、`parentToolUseId`、`threadId` 或 `turnId`。这些身份事实必须由 adapter / reducer 提供。

模型生成图片的特殊兼容路径也不属于 attachment projector 职责。assistant 正文里出现的 `.ccr/generated_outputs` 图片路径，会在 App Server 进入投影前被物化为图片块；attachment projector 只格式化这些已确认图片块，并清理正文里的重复路径文本。Desktop Renderer 不再从普通文本路径反推模型输出附件。

## Desktop 消费边界

Desktop main：

- 保存 `status.threadDisplaySnapshot`。
- `thread/resume` 后使用 `result.displaySnapshot`。
- `thread/messages/list` 刷新时使用 `result.displaySnapshot`。
- 不合并新旧 snapshot，不按 counts 或旧 items 做防退化补齐。
- 不保存旧 `threadMessages` replay bridge。

Desktop Renderer：

- 只按 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 生成展示事件。
- projection 缺失或非法时显示协议错误卡。
- 不按 raw `toolUseId` 合并协议项。
- 不从 raw stdout / markdown / 本地路径中反推工具卡或附件卡。
- 缺失 projection 的 `thinking_summary` 也不允许特殊 raw fallback。
- 旧实时事件仍保留 Renderer 侧 legacy 工具生命周期合并入口，但该入口必须显式命名为 legacy，并且不得处理 `source=history/live` 的 ThreadDisplay 协议上下文。

## 不变式

1. 历史和实时必须先转成 `ThreadDisplayReducerInputEvent`。
2. `ThreadDisplayReducer` 是展示状态的唯一 reducer 类型。
3. 旧 reducer 入口不得作为 silent fallback 保留。
4. 工具 lifecycle 由 reducer 实例维护。
5. projector 只做投影，不做生命周期状态机。
6. Renderer 不解释 raw transcript 或 provider raw block。
7. `messages` 兼容载荷不得进入 Desktop 可见历史 replay。
8. counts 不得反向驱动 UI 历史。

## 回归覆盖

相关 smoke：

```powershell
npm.cmd run smoke:thread-display-input-event
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server
```

重点覆盖：

- 历史 adapter 和实时 adapter 输出。
- `ThreadDisplayReducer.acceptMany(...)` 与 snapshot 一致。
- 反序历史输入仍按 `orderKey` 输出稳定 snapshot 顺序。
- `ThreadDisplayReducer.acceptOne(...)` 保留实时工具 lifecycle 状态。
- 实时工具 started / completed 后，同一个 reducer state 中只保留一张已完成工具卡。
- 历史 snapshot 与实时 patch state 对同一工具生命周期收敛到相同核心展示事实。
- 重复 completed tool_use 不产生重复 patch。
- 孤立 `tool_result` 进入 diagnostic / protocol error 展示项，不生成假进度卡。
- 旧 reducer 入口名称不得回归。
- Desktop 不消费 `result.messages` 作为 UI 历史。
- Desktop main 不导入或调用 snapshot merge helper。
- 历史 snapshot 和实时 patch 经 Desktop 路由后，最终 `DisplayEvent` 黄金回归一致。
- 缺失 / 非法 projection 生成协议错误卡。
- projector 不做 raw content 扫描 fallback。
- assistant 生成图片路径先由 App Server 物化为图片块，再进入 attachment projection。
- Desktop 直接接收未物化的普通文本路径时，不自行创建模型输出附件卡。
- 缺 projection 的 thinking summary 也渲染协议错误卡。
- Renderer 旧工具 lifecycle 兼容入口必须显式命名为 legacy，且 ThreadDisplay 主路径不进入该入口。
- `ThreadDisplayFact` 覆盖 tool / file / attachment / error / system / control / unsupported。
- projector 使用 `metadata.displayFact` 限定工具、文件和附件投影范围。
- permission request / cancelled、compact、control、tool progress、failed、interrupted、多附件、多 generated output、unsupported、缺失 / 非法 projection 都有最终矩阵覆盖。

最终覆盖矩阵：

| 展示语义 | 覆盖入口 | 关键结论 |
| --- | --- | --- |
| permission request / cancelled | `smoke:thread-display-input-event`、`smoke:app-server` | 权限展示先进入 fact / reducer，取消通过 patch 更新同一权限项。 |
| permission allow / denied 边界 | `smoke:app-server` | allow / duplicate / missing 属于权限响应服务边界；denied 不制造无来源展示项。 |
| compact / control | `smoke:thread-display-input-event`、`smoke:desktop-session-state` | 系统类展示由 system / control fact 驱动。 |
| MCP 特殊错误 | `smoke:desktop-display-events`、`smoke:app-server` | MCP 工具错误归入工具错误分类，新增 raw shape 时补定向 fixture。 |
| tool progress 多次更新 | `smoke:thread-display-input-event`、`smoke:desktop-session-state` | progress 进入 reducer lifecycle state，并在 realtime patch 与 snapshot 展示中收敛。 |
| failed / interrupted 工具生命周期 | `smoke:thread-display-input-event`、`smoke:desktop-session-state` | terminal 工具状态绑定原工具卡并保留错误快照。 |
| 恢复中断态 | `smoke:desktop-session-state` | turn 终止时运行中工具显式标记 interrupted。 |
| 多 attachment / 多 generated output | `smoke:thread-display-input-event`、`smoke:desktop-display-events`、`smoke:desktop-session-state` | 附件和生成物在 App Server 输入 / 投影前物化，Desktop 不猜 raw text。 |
| unknown / unsupported input | `smoke:thread-display-input-event`、`smoke:desktop-session-state` | 未知输入显式诊断为 protocol error。 |
| 缺 projection / invalid projection | `smoke:desktop-session-state` | Desktop 显示协议错误卡，不走 raw fallback。 |

## 后续方向

当前已完成 ODR-01 输入事件契约、ODR-02 单一 ordered display state、ODR-03 projector 纯化、ODR-04 旧分支清理，以及 FODR-01 输入协议硬化、FODR-02 `DisplayFact` 中间事实层、FODR-03 单状态机输出统一、FODR-04 Desktop 纯消费与黄金回归。第二阶段全事件深化也已完成：permission / compact / control、attachment / generated output、tool progress / failed / interrupted 和最终 golden 矩阵均已收口。后续如果继续深化，应只按新增展示类型或 UI 体验另立 goal。

关键方向：

- FODR-01：已完成。`ThreadDisplayReducerInputEvent` 已硬化为所有展示输入必须经过的协议，`diagnostics` 是硬字段，adapter 输出和 reducer 入口都会运行时校验，未知输入进入 diagnostic / protocol error card。
- FODR-02：已完成。`ThreadDisplayFact` 已成为 input event 和展示项之间的中间事实层，projector 优先消费 reducer 写入的 fact metadata。
- FODR-03：已完成。snapshot / patch 已收敛成同一 reducer state 的两个输出 view，实时路径不再保留 patch-first helper。
- FODR-04：已完成。Desktop main 直接保存 App Server snapshot，Renderer 只消费 snapshot / patch，黄金回归固定历史 replay 和实时 patch 最终状态等价；全量 fixture 覆盖用户图片、assistant 文本、thinking-only、compact、TodoWrite、模型生成图片、并行/乱序工具结果、orphan result、turn error 和 unsupported diagnostic。
- 第二阶段全事件深化：已完成。`ThreadDisplayFact` 覆盖 permission / system / control / attachment / tool progress 等新增语义，Desktop realtime patch 合并不会丢失 progress 或 error metadata，最终 golden fixture 固定 snapshot 与 patch 的 `DisplayEvent` 收敛。
