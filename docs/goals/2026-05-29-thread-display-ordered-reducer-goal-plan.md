# Goal Plan: ThreadDisplay Ordered Display Reducer

状态：ODR-01、ODR-02、ODR-03、ODR-04 已落地；更理想的全事件统一状态机作为后续独立 goal。

关联架构文档：

- [CCR 会话上下文与展示链路权威契约](../architecture/session-context-and-display-contract.md)
- [CCR ThreadDisplay Reducer 契约](../architecture/thread-display-reducer-contract.md)
- [CCR 全事件统一 Ordered Display Reducer 设计方向](../architecture/thread-display-ordered-reducer-future-design.md)

## 总目标

把 ThreadDisplay 展示链路从“历史 snapshot 和实时 patch 共用 reducer 类型”进一步推进为“全事件统一 ordered display reducer 状态机”。

最终形态：

```text
历史 transcript / 实时 Core event
-> adapter
-> 带 orderKey + sourceIdentity + payload 的 ThreadDisplayReducerInputEvent
-> ordered display reducer 唯一状态
-> ThreadDisplaySnapshot / ThreadDisplayPatch / diagnostics
-> Desktop Renderer
```

核心不变式：

- `orderKey` 只负责展示顺序。
- `sourceIdentity` 只负责生命周期归属，工具场景下包含 `toolUseId` / `toolCallId`。
- `payload` 只负责承载内容，不直接决定最终 UI 卡类型。
- 历史和实时只允许通过 adapter 进入 reducer。
- reducer 内部只有一份 ordered display state。
- projector 不维护生命周期，不猜顺序。
- Renderer 不 replay `messages`，不按 raw `toolUseId` 合并工具。
- 未知事件进入 diagnostic / protocol error card，不走 silent legacy fallback。

## Goal 拆分原则

这件事不建议一个 goal 做完，也不建议拆得过碎。

推荐拆成 4 个 goal：

```text
ODR-01 输入入口封口与顺序/身份契约
-> ODR-02 单一 ordered display reducer 状态机
-> ODR-03 projector 纯化
-> ODR-04 旧分支清理与回归固化
```

拆分依据：

- 先保证输入事实完整，再改 reducer 状态。
- reducer 状态接管生命周期后，才能要求 projector 纯化。
- projector 不再补链路后，才能安全删除旧分支。
- 每个 goal 都必须可以独立验收，不靠“下一步会修”掩盖问题。

## ODR-01：输入入口封口与顺序/身份契约

### 目标

收口 `ThreadDisplayReducerInputEvent` 的输入契约，让所有历史和实时展示事件都带统一的顺序与身份事实。

本 goal 不是重写展示语义，也不是重写 projector。它只解决：

```text
事件怎么排：orderKey
事件属于谁：sourceIdentity
事件带什么：payload
```

### 设计范围

1. 补强 `ThreadDisplayReducerInputEvent`。

   目标形态：

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

2. 定义 `ThreadDisplayOrderKey`。

   ```ts
   type ThreadDisplayOrderKey = {
     source: 'history' | 'realtime'
     ordinal: number
     timestamp?: string
     turnId?: string
     itemId?: string
   }
   ```

   规则：

   - 历史 adapter 用 transcript / message 原始顺序生成 `ordinal`。
   - 实时 adapter 用通知接收序号或 Core event 序号生成 `ordinal`。
   - `timestamp` 只能辅助诊断，不能替代 `ordinal`。
   - `tool_result` 自己保留 `orderKey`，但最终展示位置由绑定到的 `tool_use` 工具卡决定。

3. 定义 `ThreadDisplaySourceIdentity`。

   工具身份必须包含工具 ID 字段，而不是删除它们：

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

   其他身份可以逐步补齐：

   ```ts
   type MessageSourceIdentity = {
     kind: 'message'
     sourceId: string
   }

   type AttachmentSourceIdentity = {
     kind: 'attachment'
     sourceId: string
     parentSourceId?: string
   }

   type ErrorSourceIdentity = {
     kind: 'error'
     sourceId: string
     parentSourceId?: string
     toolUseId?: string
   }
   ```

4. 历史和实时 adapter 必须负责补齐顺序与身份。

   ```text
   AppServerThreadMessage[]
   -> appServerThreadMessagesToDisplayReducerInputEvents(...)
   -> ThreadDisplayReducerInputEvent[]
   ```

   ```text
   CoreTurnEvent
   -> coreTurnEventToDisplayReducerInputEvent(...)
   -> ThreadDisplayReducerInputEvent
   ```

5. 对未知或暂不支持的来源，必须进入显式 diagnostic。

   不允许：

   - 静默丢弃。
   - raw fallback 到主时间线。
   - Renderer 侧猜测。

### 非目标

- 不改 Desktop 视觉。
- 不改 tool / file / attachment / error projector 的展示语义。
- 不把 reducer 内部一次性改成最终 ordered state。
- 不删除旧分支。
- 不把 `payload.type` 当最终 UI 卡类型。

### 验收标准

- [x] 所有 `ThreadDisplayReducerInputEvent` 都有 `orderKey`。
- [x] 所有 `ThreadDisplayReducerInputEvent` 都有 `sourceIdentity`。
- [x] 工具身份里保留 `toolUseId` / `toolCallId` / `parentToolUseId` 能力。
- [x] 历史 adapter 输出的事件有稳定 `history ordinal`。
- [x] 实时 adapter 输出的事件有稳定 `realtime ordinal`。
- [x] reducer 公开入口不再直接接受 raw history message 或 raw core event。
- [x] 未知输入进入 diagnostic，不走 silent legacy fallback。
- [x] smoke 覆盖历史普通消息、实时消息、工具 use/result/progress、附件、错误、system/control、未知输入。

## ODR-02：单一 Ordered Display Reducer 状态机

### 目标

让 ThreadDisplay reducer 内部维护唯一有序展示状态。历史 snapshot 和实时 patch 都从同一份 state 派生。

### 设计范围

1. 引入 ordered display state。

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

2. 统一事件处理规则。

   ```text
   accept input event
   -> resolve sourceIdentity
   -> find existing display item or create new display item
   -> if new item, insert by orderKey
   -> if lifecycle update, update existing item
   -> emit patch operation
   ```

3. 工具生命周期由 reducer 负责。

   - `tool_use` 创建工具卡。
   - `tool_result` 回填工具卡。
   - `progress` 更新工具卡。
   - 找不到父工具卡时生成 diagnostic，不在末尾新建假进度卡。

4. Snapshot / Patch 从同一个 state 派生。

   ```text
   reducer.toSnapshot()
   reducer.consumePatch()
   ```

### 非目标

- 不重写 projector 视觉细节。
- 不删除所有旧 helper。
- 不引入 Desktop 组件重构。

### 验收标准

- [x] `orderedItemIds` 是 UI 历史顺序来源。
- [x] `itemsById` 是展示项事实来源。
- [x] snapshot items 从 `orderedItemIds + itemsById` 派生。
- [x] patch operations 从同一 state 的变更派生。
- [x] 并行工具和乱序 `tool_result` 不重复、不错位。
- [x] orphan `tool_result` / `progress` 进入 diagnostic。
- [x] counts 只做诊断，不反向驱动 UI。

## ODR-03：Projector 纯化

### 目标

把 projector 收敛成纯投影层。它们只负责格式化 reducer 已确认的展示事实，不维护生命周期，不猜顺序。

当前状态：已完成。

### 设计范围

1. 明确每个 projector 职责。

   | Projector | 允许做什么 | 不允许做什么 |
   | --- | --- | --- |
   | tool | 格式化工具标题、状态、摘要、参数、结果、错误 | 维护 tool lifecycle、补父链 |
   | file | 格式化文件路径、动作、diff、引用 | 决定事件顺序 |
   | attachment | 格式化附件、图片、生成物、路径动作 | 从正文路径猜附件 |
   | error | 格式化错误分类、诊断、操作按钮 | 吞掉协议错误 |
   | system/control | 格式化 compact、thinking notice、内部控制提示 | 把控制结果当普通消息 |

2. projector 输入必须是 reducer 已确认的事实。

   不允许 projector 直接从 raw history message / raw core event 重新解释展示语义。

3. 未知结构必须投影为 diagnostic / protocol error。

4. projector 选择内容块只能依赖 reducer 已确认的事实。

   允许来源：

   - `item.identity.contentIndex`
   - `item.metadata.primaryBlock`
   - 同类型块只有一个时的确定性选择

   不允许来源：

   - 扫描所有 raw content 并猜测“最像”的块。
   - 从 raw block 反推 `toolUseId` / `parentToolUseId` / `threadId` / `turnId`。
   - 在 Desktop Renderer 侧把普通文本路径反推为模型输出附件。

5. 生成图片这类“正文里带本地生成物路径”的兼容输入，必须在 App Server 进入投影前先物化成图片 / 附件块；attachment projector 只格式化已存在的图片块，不再从正文路径猜附件。

### 非目标

- 不改 provider adapter。
- 不改 Desktop 视觉组件骨架。
- 不删除 reducer 中必要的生命周期状态。

### 验收标准

- [x] projector 不保存跨事件状态。
- [x] projector 不执行 tool result 绑定。
- [x] projector 不决定历史 / 实时顺序。
- [x] projector 不做 raw fallback。
- [x] smoke 固定工具、文件、附件、错误、system/control 的 projection 不退化。

## ODR-04：旧分支清理与回归固化

### 目标

删除或显式隔离剩余重复路径，固定完整回归，确保代码里只剩一个 display reducer 主状态机。

当前状态：已完成当前阶段收口。

### 设计范围

1. 清理重复路径。

   重点检查：

   - 历史 snapshot 私有组装分支。
   - 实时 patch 私有组装分支。
   - Renderer 侧 raw `toolUseId` 合并。
   - `messages` replay 到主聊天 UI 的路径。
   - 缺 projection 时 raw fallback。
   - 旧 helper 是否还在主链路被调用。

2. 对必须保留的兼容入口显式命名。

   允许保留兼容入口，但必须：

   - 名称体现 compat / legacy。
   - 有日志或诊断。
   - 有文档说明触发条件。
   - 有 smoke 防止进入主展示链路。

3. 固化回归。

   需要覆盖：

   - 历史普通消息。
   - 实时 assistant 文本。
   - 并行工具。
   - 乱序 `tool_result`。
   - orphan `tool_result` / `progress`。
   - 用户上传图片。
   - 模型生成图片。
   - 文件工具。
   - 错误卡。
   - compact / thinking notice。
   - TodoWrite / todo_reminder。
   - projection 缺失 / 非法。

### 非目标

- 不删除公开协议里的兼容字段，除非另开破坏性变更 goal。
- 不把 Desktop 卡片视觉重构混入本 goal。
- 不重写模型上下文链路。

### 验收标准

- [ ] 主展示链路只剩一个 ordered display reducer 状态机。
- [x] 主展示链路只剩一个 ordered display reducer 状态机。
- [x] 历史和实时只作为 adapter / output view 的差异存在。
- [x] 没有 silent legacy fallback。
- [x] 所有兼容入口都有显式命名、文档和 smoke。
- [x] `ThreadDisplaySnapshot.items` / `ThreadDisplayPatch.operations` 仍是 Desktop 权威展示协议。
- [x] `git diff --check`、typecheck、build、相关 smoke 通过。

## 总验收

四个 goal 全部完成后，必须满足：

```text
同一份输入事实
-> 同一个 ordered display reducer state
-> 历史输出 snapshot
-> 实时输出 patch
```

并且：

- 顺序只由 `orderKey` 决定。
- 生命周期只由 `sourceIdentity` / tool lifecycle state 归并。
- `toolUseId` / `toolCallId` 保留为工具身份字段。
- projector 不保存状态。
- Renderer 不猜历史、不猜工具、不 replay `messages`。
- 任何未知事件都进入显式 diagnostic。

## 当前状态

状态：ODR-01、ODR-02、ODR-03、ODR-04 已完成。

ODR-01 已完成输入契约收口：`ThreadDisplayReducerInputEvent` 带 `orderKey`、`sourceIdentity`、`payload` 和显式 diagnostic；历史和实时入口先经 adapter，再进入 reducer。

ODR-02 已完成单一 ordered state 收口：`ThreadDisplayReducer` 内部维护 `orderedItemIds`、`itemsById`、`displayIdBySourceIdentity`、`toolLifecycleByToolUseId`、diagnostics 和 counts。历史 snapshot 从 `orderedItemIds + itemsById` 派生；实时 patch 先更新同一份 state，再进入 pending operations；smoke 覆盖反序历史输入、实时工具 use/result 生命周期和孤立 `tool_result` diagnostic。

ODR-03 已完成 projector 纯化收口：`threadDisplayProjectorFacts` 提供确认块选择和投影身份创建，tool / attachment / Desktop 展示侧不再扫描 raw content 猜测工具或模型输出附件；模型生成图片路径在 App Server 进入投影前物化为图片块，projector 只格式化已确认展示事实。后续进入 ODR-04 时，应继续清理旧兼容入口并固化更多回归，不恢复历史 / 实时分支各自组装的旧路径。

ODR-04 已完成当前阶段收口：Desktop 缺 projection 的 `thinking_summary` 不再有 raw fallback，所有 ThreadDisplay projection 缺失 / 非法项都走协议错误卡；Renderer 旧工具 result/progress 合并入口显式命名为 legacy 兼容路径，并由 `isThreadDisplayProtocolContext(...)` 排除主协议路径。`ThreadDisplaySnapshot.items` / `ThreadDisplayPatch.operations` 仍是 Desktop 权威展示协议，`messages` 只保留为 current-context / legacy compat 载荷。
