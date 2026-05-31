# Goal: STD-HISTORY-15-0 UI display reducer deepening

## 目标

继续深化 UI 展示 reducer 收敛。

当前 `STD-HISTORY-14-0` 已完成第一轮入口和基础 projector 收口：历史 snapshot 与实时 patch 已委托同一个 `createThreadDisplayReducer(...)`，附件 / 错误 projection 也已拆出独立 projector。

本 goal 在这个基础上继续推进三件事：

1. 先拆 `tool projector`。
2. 再拆 `file projector`。
3. 最后评估并推进真正单一 `display reducer` 状态机。

## 为什么要做

`threadDisplayProjection.ts` 仍承担过多职责。附件 / 错误已经拆出，但工具卡、文件卡、todo、compact、thinking 等投影仍混在主投影器里。

其中工具和文件最容易影响用户可见行为：

- 工具卡：涉及工具调用、工具结果、MCP、命令、搜索、浏览器、生成图片、错误分类、耗时和主时间线显示策略。
- 文件卡：涉及读写编辑、路径安全、文件引用、搜索结果、按钮动作和内容摘要。

如果不先拆这两块，后续真正统一 display reducer 状态机时会继续被巨大投影器拖住。

## 顺序

本 goal 按固定顺序推进：

1. `tool projector`
2. `file projector`
3. 单一 `display reducer` 状态机

不得跳过前两项直接重写状态机。

## 范围

### 阶段 1：tool projector

- 从 `threadDisplayProjection.ts` 拆出工具相关投影逻辑。
- 保持现有工具卡行为不变。
- 不改变 `ThreadDisplayProjection` 协议字段。
- 保持工具生命周期绑定仍由 App Server reducer 负责。
- 补或复用工具生命周期 smoke，确保历史 snapshot 和实时 patch 最终工具时间线一致。

### 阶段 2：file projector

- 从 `threadDisplayProjection.ts` 拆出文件相关投影逻辑。
- 保持文件读写、搜索、引用、路径安全和动作按钮语义不变。
- 不把 Renderer 重新变成 raw content parser。
- 补或复用文件 projection smoke。

### 阶段 3：单一 display reducer 状态机

- 在前两阶段完成后，再评估是否把 `reduceThreadMessagesToDisplayItems(...)` 和 `reduceCoreEventDisplayPatchOperations(...)` 收敛成真正统一状态机。
- 历史 transcript 与实时 CoreTurnEvent 应先转成统一 display input event，再由同一个 reducer 处理。
- snapshot 与 patch 只是输出形态不同，不应再复制展示语义。

## 明确不做

- 不修改模型上下文 `currentContextMessages` 链路。
- 不修改 transcript 物化逻辑。
- 不改变 Desktop Renderer 的协议消费边界。
- 不引入 silent legacy fallback。
- 不为了拆文件而改变 UI 文案、按钮或卡片结构。

## 不变式

1. Renderer 只消费合法 `ThreadDisplayProjection`。
2. 缺失或非法 projection 继续显示协议错误卡，不 raw fallback。
3. 工具结果绑定仍按 App Server 工具生命周期 reducer 的 `toolUseId` / source identity 执行。
4. 历史 snapshot 和实时 patch 对同一工具序列的最终 projection 必须一致。
5. 附件 / 图片不能退回成 `[图片]` 占位或本地路径正文。
6. 错误 projection 必须保留 `errorSnapshot`，不能只剩文本。
7. 拆 projector 是结构收敛，不改变用户可见行为。

## 阶段 3 评估：单一 Display Reducer 状态机

当前已经完成的统一程度：

- 历史 snapshot 与实时 patch 都从 `createThreadDisplayReducer(...)` 进入。
- 历史普通消息、实时 started/completed item、工具生命周期展示项和系统类特殊项复用公共 `ThreadDisplayItem` factory。
- 附件、错误、工具、文件投影都已从主投影器拆出 projector，主投影器职责变成展示分派和消息级投影。

当前还没有真正单一状态机的地方：

- `reduceThreadMessagesToDisplayItems(...)` 仍然面向历史 `AppServerThreadMessage[]`。
- `reduceCoreEventDisplayPatchOperations(...)` 仍然面向实时 `CoreTurnEvent`。
- 二者输出形态不同：历史一次性输出 `ThreadDisplayItem[]`，实时输出 `ThreadDisplayPatchOperation[]`。

建议的下一步不是直接合并两个函数，而是先新增统一输入层：

1. 定义 `ThreadDisplayReducerInputEvent`，把历史消息和实时 CoreTurnEvent 都转换成同一种展示输入事件。
2. 让 reducer 内部维护同一个 `ToolDisplayLifecycleReducer` 和同一套 `ThreadDisplayItem` factory。
3. 历史 snapshot 走 `acceptMany(inputEvents).toSnapshotItems()`。
4. 实时 patch 走 `acceptOne(inputEvent).toPatchOperations()`。
5. 最后再删除或内联 `reduceThreadMessagesToDisplayItems(...)` / `reduceCoreEventDisplayPatchOperations(...)` 的重复分支。

这一步应单独开下一个 goal 推进，原因是它会改状态机边界和 patch 输出语义，风险高于本轮 projector 拆分。

## 验收标准

- [x] `tool projector` 从 `threadDisplayProjection.ts` 拆出，主投影器只做分派。
- [x] 工具生命周期、工具结果、工具错误、工具分类、工具详情仍通过 smoke。
- [x] `file projector` 从 `threadDisplayProjection.ts` 拆出，主投影器只做分派。
- [x] 文件读写、搜索、引用、路径安全和动作语义仍通过 smoke。
- [x] 文档和 CHANGELOG 更新。
- [x] `typecheck`、`typecheck:desktop`、`build`、`smoke:desktop-session-state`、`smoke:desktop-display-events`、`smoke:app-server`、`git diff --check` 全部通过。
- [x] 阶段 3 前必须写清楚状态机方案，不得直接大改。

## 当前状态

状态：完成。

当前指针：本 goal 已收口。

已完成：

- `threadDisplayToolProjector.ts` 已拆出工具 snapshot、工具分类、工具状态、耗时、错误归因和主时间线隐藏策略。
- `threadDisplayProjection.ts` 保留工具事件组装、附件 / 错误 / 文件投影调度，不再承载工具分类和错误细节。
- 工具生命周期相关 smoke 已通过，历史 snapshot 与实时 patch 仍由 App Server reducer 统一绑定工具卡。
- `threadDisplayFileProjector.ts` 已拆出文件 snapshot、搜索引用、路径安全、文本范围、diff 和文件动作。
- 文件投影相关 smoke 已通过，文件读写 / 搜索 / 引用仍通过同一 projection 进入 Desktop 展示协议。
- 单一 `display reducer` 状态机已完成方案评估：下一步应先建统一展示输入事件，不直接把历史和实时两个入口硬合并。
- `CHANGELOG.md`、goal、todo 均已更新，验证命令全部通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server
git diff --check
```
