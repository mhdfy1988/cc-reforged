# Goal: ThreadDisplay tool progress 生命周期并入 reducer state

状态：已完成。

关联文档：

- [ThreadDisplay 全事件 Ordered Display Reducer 深化](./2026-05-31-thread-display-full-ordered-reducer-next.md)
- [CCR ThreadDisplay Reducer 契约](../architecture/thread-display-reducer-contract.md)
- [CCR 全事件统一 Ordered Display Reducer 设计方向](../architecture/thread-display-ordered-reducer-future-design.md)

## 目标

把工具 started、progress、result、failed、interrupted 的展示生命周期统一到 `ThreadDisplayReducer` state transition 中。

目标链路：

```text
tool lifecycle input
-> ThreadDisplayReducerInputEvent
-> tool lifecycle DisplayFact
-> reducer tool lifecycle binding table
-> one display item
-> snapshot / patch
```

## 为什么单独做

工具 progress 是风险最高的部分。它同时涉及顺序、身份、乱序 result、orphan result、权限状态和主时间线隐藏策略。必须单独验收，避免把 raw `toolUseId` 合并逻辑带回 Renderer。

## 范围

本阶段处理：

- tool started
- tool progress
- tool completed result
- tool failed
- tool interrupted / cancelled
- orphan `tool_result`
- duplicate completed tool_use
- 同一 turn 内并行工具
- result 乱序返回

## 非目标

- 不把 `toolUseId` 提升为全局 display identity。
- 不恢复 Renderer raw `toolUseId` 合并。
- 不让 projector 保存工具生命周期状态。
- 不改工具真实执行协议。
- 不重写工具卡视觉组件。

## 迭代拆分

### 迭代 1：工具生命周期审计

只查 tool started、progress、result、failed、interrupted、orphan result 当前路径，确认哪些已经由 reducer state 管理，哪些仍靠局部 helper。

输出：工具生命周期状态矩阵。

### 迭代 2：progress / failed / interrupted 并入 state

把缺失的 progress、failed、interrupted 转换成工具生命周期 fact 和 reducer state transition。

输出：同一工具生命周期只更新同一展示项。

### 迭代 3：乱序和异常回归

补并行工具、乱序 result、orphan result、duplicate completed tool_use 的历史 / 实时等价回归。

输出：工具黄金 fixture、Renderer legacy 入口隔离验证、文档矩阵更新。

## 工具生命周期状态矩阵

| 输入 | 当前结论 | reducer 处理 |
| --- | --- | --- |
| tool started | 已并入 state | `tool_use` 生成 tool/file fact，`ToolDisplayLifecycleReducer` 创建 `tool:${toolUseId}` 展示项。 |
| tool progress | 已并入 state | realtime `item_delta` 中的 `progress` block 生成 `tool_progress` fact，更新同一工具展示项的 `progressBlock`。 |
| tool completed result | 已并入 state | `tool_result` 绑定已有 `toolUseId`，输出 `complete_item`，不新增第二张工具卡。 |
| tool failed | 已并入 state | `tool_result` 的 `is_error` / failed status 进入 lifecycle，展示项状态为 `failed`。 |
| tool interrupted / cancelled | 已并入 state | `tool_result.status=cancelled/interrupted` 归一为 `interrupted`，仍更新同一工具展示项。 |
| orphan tool_result | 已诊断化 | 找不到对应 `tool_use` 时生成 diagnostic / protocol error，不伪造工具卡。 |
| orphan tool progress | 已诊断化 | 找不到对应 `tool_use` 时生成 `orphan_tool_progress` diagnostic。 |
| duplicate completed tool_use | 已过滤 | completed 事件中重复出现的已知 `tool_use` 不再 append 第二张工具卡。 |
| 同一 turn 并行工具 / result 乱序 | 已覆盖主路径 | lifecycle binding table 按 `toolUseId` 更新各自展示项；result 早于 use 视为 orphan diagnostic。 |

## 本轮实现

- `ToolDisplayLifecycleEvent` 增加 `tool_progress`，`ToolDisplayLifecycleItem` 增加 `progressBlock`。
- `ToolDisplayLifecycleReducer.acceptToolProgress` 将 progress 绑定到已有工具项；缺 id 或找不到 tool_use 时走 diagnostic。
- `threadDisplayFacts.ts` 将 `progress` block 纳入 tool lifecycle fact，realtime `item_delta` 中的工具进度不再走普通 streaming message。
- `threadDisplayInputEvent.ts` 将 `progress` 纳入 tool source identity 识别，保持 `toolUseId` 归属明确。
- `threadDisplay.ts` 在 `item_delta` 分支优先处理 tool lifecycle fact，progress 输出 `update_item` 并保留已有 file/tool fact。
- `smoke-thread-display-input-event.mjs` 增加 progress、duplicate completed tool_use、failed、interrupted 断言。

## 边界和不变式

- 同一工具生命周期仍只以 `tool:${toolUseId}` 作为展示项 id；`toolUseId` 不提升为全局 display identity。
- Renderer 不新增 raw `toolUseId` 合并逻辑；ThreadDisplay 协议上下文仍只消费 reducer 输出的 projection。
- 早到的 result/progress 不静默补假工具卡，而是进入 diagnostic。
- progress 只更新已有工具 state，不覆盖 started 阶段确认出的 file fact。

## 验证记录

已通过：

```text
npm.cmd run build
npm.cmd run smoke:thread-display-input-event
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:app-server
npm.cmd run typecheck
git diff --check
```

## 剩余缺口

- 更完整的 MCP / provider 特殊失败、progress 与权限交织场景留到 2-5 黄金回归矩阵统一复核。
- 当前 result 早于 use 明确作为 orphan diagnostic；如果未来协议需要乱序缓存，必须新增显式状态和超时策略，不能静默 fallback。

## 验收标准

- 同一工具生命周期只生成或更新一张工具展示项。
- progress / result / failed / interrupted 都由 reducer state transition 决定。
- orphan result 进入 diagnostic / protocol error 展示项，不生成假工具卡。
- Renderer legacy 工具合并入口不处理 ThreadDisplay 协议上下文。
- 历史 snapshot 和实时 patch 的工具生命周期展示事实等价。
- 验证命令通过：

```text
npm.cmd run smoke:thread-display-input-event
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:app-server
npm.cmd run typecheck
git diff --check
```

## 下一步

完成后进入 [黄金回归矩阵扩展与最终 closeout](./2026-05-31-thread-display-full-ordered-reducer-05-golden-closeout.md)。
