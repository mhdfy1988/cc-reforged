# Goal Plan: Full Ordered Display Reducer Final State Machine

状态：FODR-01、FODR-02、FODR-03、FODR-04 已完成。

关联架构文档：

- [CCR 会话上下文与展示链路权威契约](../architecture/session-context-and-display-contract.md)
- [CCR ThreadDisplay Reducer 契约](../architecture/thread-display-reducer-contract.md)
- [CCR 全事件统一 Ordered Display Reducer 设计方向](../architecture/thread-display-ordered-reducer-future-design.md)

## 总目标

把当前已经完成的 ThreadDisplay 主路径，从“历史和实时已经共用 reducer 类型”继续收口到“全事件统一 ordered display reducer 最终状态机”。

当前已完成：

```text
历史 transcript / 实时 Core event
-> adapter
-> ThreadDisplayReducerInputEvent
-> DisplayFact
-> ThreadDisplayReducer ordered state
-> ThreadDisplaySnapshot / ThreadDisplayPatch
-> Desktop Renderer
```

最终目标：

```text
所有展示来源
-> 输入 adapter
-> 硬协议 ThreadDisplayReducerInputEvent
-> DisplayFact
-> 唯一 ordered display reducer state
-> snapshot / patch 两种输出视图
-> Desktop 纯消费
```

这里的“所有展示来源”包括：

- 历史 transcript / `AppServerThreadMessage`
- 实时 `CoreTurnEvent`
- 普通 user / assistant 消息
- 工具 use / progress / result / failed
- 附件 / 图片 / 文件
- 错误 / 系统提示 / compact / thinking summary
- 内部控制事件，例如 TodoWrite / reminder
- 未知或暂不支持事件

## 核心不变式

1. 展示顺序只由 `orderKey` 决定。
2. 生命周期归属只由 `sourceIdentity` 和 reducer 内部绑定表决定。
3. `toolUseId` / `toolCallId` / `parentToolUseId` 是工具身份字段，保留在 `sourceIdentity.kind = 'tool'` 中，不作为全局展示身份。
4. `payload` 只承载输入内容，不直接决定最终 UI 卡片类型。
5. 所有输入必须先通过 adapter 进入 `ThreadDisplayReducerInputEvent`，reducer 不直接消费 raw history message 或 raw core event。
6. reducer 内部维护唯一 ordered display state。
7. projector 只把 reducer 已确认的展示事实格式化成展示协议，不维护生命周期，不猜顺序，不扫描 raw content 做 fallback。
8. Desktop 只消费 `ThreadDisplaySnapshot.items` / `ThreadDisplayPatch.operations`，不 replay `messages`，不按 raw `toolUseId` 合并工具。
9. 未知事件、缺失字段、非法 projection 进入 diagnostic / protocol error card，不走 silent legacy fallback。
10. 历史 replay 和实时 patch 对同一组事件收敛到同一份最终展示状态。

## Goal 拆分

推荐拆成 4 个后续 goal：

```text
FODR-01 输入协议硬化
-> FODR-02 DisplayFact 中间事实层
-> FODR-03 单状态机输出统一
-> FODR-04 Desktop 纯消费与黄金回归
```

拆分依据：

- 先让入口不能再绕过协议。
- 再把“解释事件语义”的职责从 projector / Desktop 收回到 reducer 前置事实层。
- 然后把 snapshot / patch 输出彻底变成同一 state 的两个 view。
- 最后清理 Desktop 侧剩余语义修正，并用黄金回归证明历史 replay 和实时 patch 等价。

## FODR-01：输入协议硬化

### 目标

把 `ThreadDisplayReducerInputEvent` 从“统一类型”升级为“所有展示输入必须经过的硬协议”。

它解决的问题是：入口不能再靠调用方自觉，不能再出现 reducer / projector / Desktop 某处直接吃 raw event 的旁路。

### 范围

1. 梳理所有展示输入入口。

   必查入口：

   - `AppServerThreadMessage[] -> appServerThreadMessagesToDisplayReducerInputEvents(...)`
   - `CoreTurnEvent -> coreTurnEventToDisplayReducerInputEvent(...)`
   - App Server 内部 system / compact / error / control 事件
   - 工具 lifecycle 事件
   - 附件 / 生成图片 / 文件事件
   - Desktop snapshot / patch 消费入口

2. 明确 `ThreadDisplayReducerInputEvent` 的硬字段。

   必须包含：

   - `threadId`
   - `source`
   - `orderKey`
   - `sourceIdentity`
   - `payload`
   - `diagnostics`

3. 增加运行时校验。

   要优先复用项目已有 schema / assert 能力；如果现有能力不足，再评估引入成熟运行时校验库。不要只依赖 TypeScript interface。

4. 统一未知事件处理。

   未知事件只能进入：

   - `payload.type = 'unsupported'`
   - diagnostic
   - protocol error card

   不允许：

   - 静默跳过
   - raw fallback 到普通消息
   - Desktop 侧补解释

### 非目标

- 不重写 projector。
- 不改变 Desktop 卡片视觉。
- 不清理所有 legacy 入口，只先封住主输入入口。

### 验收标准

- [x] 所有进入 reducer 的事件都有 `orderKey`。
- [x] 所有进入 reducer 的事件都有 `sourceIdentity`。
- [x] reducer 公开入口不接受 raw history message / raw core event。
- [x] 未知输入产生 diagnostic，而不是静默消失。
- [x] smoke 覆盖历史、实时、工具、附件、错误、system/control、未知事件。

### 完成记录

- `ThreadDisplayReducerInputEvent.diagnostics` 已从可选字段改为硬字段。
- adapter 输出历史 / 实时 input event 时会运行协议断言。
- `ThreadDisplayReducer.acceptMany(...)` / `acceptOne(...)` 会再次运行协议断言，防止 JS 或旧入口绕过 TypeScript。
- unsupported 输入会进入 reducer diagnostics，并投影为 `thread_display_input_diagnostic` 协议错误项。
- `smoke:thread-display-input-event` 固定 diagnostics 数组、unsupported diagnostic 和坏输入 fail fast。

## FODR-02：DisplayFact 中间事实层

### 目标

在 `ThreadDisplayReducerInputEvent` 和最终 `ThreadDisplayItem` 之间引入展示事实层（DisplayFact）。

它解决的问题是：projector 不应该解释 raw content，也不应该临时判断“这看起来像工具 / 图片 / 文件 / 错误”。

### 范围

1. 定义 `DisplayFact`。

   推荐形态：

   ```ts
   type DisplayFact =
     | MessageDisplayFact
     | ToolLifecycleDisplayFact
     | AttachmentDisplayFact
     | FileDisplayFact
     | ErrorDisplayFact
     | SystemDisplayFact
     | ControlDisplayFact
     | UnsupportedDisplayFact
   ```

2. reducer 前置阶段负责把 input event 解释成 fact。

   ```text
   ThreadDisplayReducerInputEvent
   -> resolveDisplayFact(...)
   -> DisplayFact
   -> reducer state transition
   ```

3. fact 必须携带 reducer 已确认的选择结果。

   例如：

   - `primaryBlock`
   - `contentIndex`
   - `toolUseId`
   - `attachmentId`
   - `filePath`
   - `errorSnapshot`
   - `sourceIdentity`
   - `orderKey`

4. projector 只消费 fact 或 reducer state item。

   不允许 projector：

   - 扫描 raw content block
   - 反推工具父链
   - 从普通文本路径创建图片附件
   - 把 unsupported raw content 当普通消息展示

### 非目标

- 不要求一次拆完所有 projector 文件。
- 不改变用户可见卡片样式。
- 不改变 provider adapter 的原始输出。

### 验收标准

- [x] tool / file / attachment / error projector 不直接解释 raw event。
- [x] 主要卡片类型都有对应 fact。
- [x] unsupported fact 能稳定投影为 diagnostic / protocol error。
- [x] 生成图片路径仍在 App Server 进入投影前物化，不回退到 Desktop 猜路径。

### 完成记录

- 新增 `src/app-server/threadDisplayFacts.ts`，定义 `ThreadDisplayFact` 联合类型，覆盖 message、tool lifecycle、file、attachment、error、system、control、unsupported。
- reducer 历史路径和实时路径都会先调用 `resolveThreadDisplayFacts(...)`，再把 fact 转成 state transition 或 patch operation。
- `ThreadDisplayItem.metadata.displayFact` 记录 reducer 已确认的事实类型、输入来源、`orderKey`、`sourceIdentity`、`contentIndex`、工具 / 文件字段。
- projector 优先使用 `metadata.displayFact`、`metadata.primaryBlock` 和 `metadata.attachmentBlocks` 限定投影范围，不再从混合 raw blocks 中猜工具 / 附件。
- 文件类工具的 started fact 会保留为 `file`，completed result 回填时不会把最终工具卡降级回普通 tool lifecycle。
- `smoke:thread-display-input-event` 覆盖 DisplayFact 类型、fact metadata、projector scoped blocks、unsupported fact 和生成图片物化边界。

## FODR-03：单状态机输出统一

### 目标

让 snapshot 和 patch 彻底成为同一 reducer state 的两种输出 view。

它解决的问题是：不能再出现历史 snapshot 组装一套、实时 patch 组装一套、Desktop merge 又修一套。

### 范围

1. reducer 只暴露状态机语义。

   推荐接口：

   ```ts
   reducer.accept(event)
   reducer.acceptMany(events)
   reducer.toSnapshot()
   reducer.consumePatch()
   reducer.getDiagnostics()
   ```

2. reducer 内部只维护一份 state。

   必须包含：

   - `orderedItemIds`
   - `itemsById`
   - `orderKeysByItemId`
   - `displayIdBySourceIdentity`
   - `toolLifecycleByToolUseId`
   - `diagnostics`
   - `counts`

3. 所有生命周期更新都必须是 state transition。

   示例：

   ```text
   tool_use started
   -> create / update tool display item
   -> emit append/update patch

   tool_result completed
   -> find existing tool display item by sourceIdentity / toolUseId
   -> update same item
   -> emit update patch
   ```

4. 找不到父项时快速诊断。

   不允许：

   - 在末尾新建假进度卡
   - 按到达顺序猜位置
   - 在 Desktop 侧补绑定

### 非目标

- 不删除公开协议里的兼容字段。
- 不重写 Desktop 视觉组件。
- 不把模型上下文组装链路并入 UI 展示 reducer。

### 验收标准

- [x] 同一组事件通过历史 replay 得到 snapshot。
- [x] 同一组事件通过实时逐条 patch 最终得到等价 state。
- [x] 并行工具、乱序 result、重复 progress 不产生重复卡。
- [x] orphan result / progress 产生 diagnostic。
- [x] counts 只做诊断和 telemetry，不驱动 UI 历史。

### 完成记录

- `ThreadDisplayReducer.acceptOne(...)` 已改为实时 input event 先进入 reducer state transition，再由这次 state transition 导出 `ThreadDisplayPatchOperation`；不再保留 `createPatchOperations(...)` / `applyPatchOperationToState(...)` 这种 patch-first 分支。
- `ThreadDisplayReducer.toSnapshot(...)` 成为 snapshot 输出 view，`buildThreadDisplaySnapshot(...)` 不再自行组装 snapshot counts / diagnostics。
- 工具生命周期 started / completed、并行工具、乱序 tool_result、重复 completed tool_use 都通过同一份 `toolLifecycleByToolUseId` 和 ordered state 收敛。
- 普通文本 delta 仍可补齐流式展示项，工具 orphan result 继续进入 diagnostic / protocol error card。
- `smoke:thread-display-input-event` 固定了旧 patch-first 函数名不得回归、历史 snapshot 与实时 patch state 的工具生命周期等价、orphan tool result diagnostic 和 delta 状态种子行为。

## FODR-04：Desktop 纯消费与黄金回归

### 目标

让 Desktop 彻底只消费展示协议，并用黄金回归固定历史 replay 和实时 patch 的一致性。

它解决的问题是：前台不能再当第二个 reducer。

### 范围

1. Desktop main 只保存和分发展示协议。

   - `ThreadDisplaySnapshot.items`
   - `ThreadDisplayPatch.operations`

2. Desktop Renderer 只做视觉模型转换。

   Renderer 不允许：

   - replay `messages`
   - 按 raw `toolUseId` 合并工具
   - 从 raw text 猜图片附件
   - 对缺 projection 做 raw fallback
   - 用 counts 修正 UI 历史

3. 建立黄金回归 fixture。

   至少覆盖：

   - 普通用户消息
   - assistant 文本
   - thinking summary
   - compact notice
   - TodoWrite / todo_reminder
   - 并行工具
   - 乱序 `tool_result`
   - orphan `tool_result`
   - 工具 progress
   - 文件工具
   - 用户图片
   - 模型生成图片
   - provider / tool / protocol error
   - unknown / unsupported item

4. 对比历史和实时最终态。

   ```text
   fixture events
   -> history replay
   -> snapshot final state

   fixture events
   -> realtime patches
   -> applied final state

   两者应等价
   ```

### 非目标

- 不做视觉样式重构。
- 不改模型上下文预算。
- 不改变 provider 协议。

### 验收标准

- [x] Desktop 不再有主路径语义补丁。
- [x] snapshot / patch 是唯一可见历史来源。
- [x] `messages` 仅保留为 current-context / legacy compat 载荷。
- [x] 黄金回归证明历史 replay 和实时 patch 最终展示一致。
- [x] 没有 silent legacy fallback。

### 完成记录

- Desktop main 刷新 `thread/messages/list` 后直接保存 `result.displaySnapshot ?? null`，移除 `mergeThreadDisplaySnapshot(...)` 防退化合并层，避免前台成为第二个展示 reducer。
- Desktop Renderer 继续只消费 `ThreadDisplaySnapshot.items` / `ThreadDisplayPatch.operations`，缺失或非法 projection 进入协议错误卡；旧工具生命周期合并入口仍显式命名为 legacy，ThreadDisplay 协议上下文不进入 raw `toolUseId` 合并。
- `smoke:desktop-session-state` 增加黄金回归：同一组展示输入分别走历史 snapshot 和实时 patch，经 Desktop 路由和 `sessionReducer` 后，最终 `DisplayEvent` 等价；覆盖普通用户图片、assistant 文本、thinking-only 系统提示、compact 完成提示、TodoWrite、模型生成图片、并行文件工具、乱序 `tool_result`、orphan `tool_result`、turn error 和 unsupported diagnostic。
- smoke 同时固定 Desktop main 不再导入 `threadDisplaySnapshotMerge`、不消费 `result.messages`、不做缺 projection raw fallback。

## 总验收

四个 FODR goal 完成后，代码层面必须满足：

```text
raw source
-> adapter
-> ThreadDisplayReducerInputEvent
-> DisplayFact
-> ordered display reducer state
-> snapshot / patch view
-> Desktop pure render
```

最终可接受的差异只有：

- 历史输入是批量事件，输出 snapshot。
- 实时输入是单事件流，输出 patch。
- Desktop 只负责视觉呈现，不负责展示事实归并。

## 建议推进顺序

1. 先启动 FODR-01，锁死输入协议。
2. FODR-01 通过后再做 FODR-02，避免 DisplayFact 继续从不可信 raw event 里猜。
3. FODR-02 通过后再做 FODR-03，让 state transition 只处理已确认事实。
4. 最后做 FODR-04，清前台语义补丁并补黄金回归。

不要把四个 goal 合成一个大改。每一阶段都必须独立验收、独立记录，不用“下一阶段会修”掩盖当前阶段的问题。
