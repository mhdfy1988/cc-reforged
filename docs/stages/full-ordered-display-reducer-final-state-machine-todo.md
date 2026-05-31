# Full Ordered Display Reducer Final State Machine Todo

## 目标文档

- [Full Ordered Display Reducer Final State Machine](../goals/2026-05-30-full-ordered-display-reducer-final-state-machine.md)

## 当前任务列表

- [x] FODR-01-01 梳理历史 / 实时展示输入入口
- [x] FODR-01-02 将 `ThreadDisplayReducerInputEvent.diagnostics` 设为硬字段
- [x] FODR-01-03 增加 `ThreadDisplayReducerInputEvent` 运行时协议校验
- [x] FODR-01-04 在历史 / 实时 adapter 输出时断言协议完整
- [x] FODR-01-05 在 `ThreadDisplayReducer.acceptMany(...)` / `acceptOne(...)` 入口再次断言
- [x] FODR-01-06 unsupported 输入进入 reducer diagnostics 和协议错误展示项
- [x] FODR-01-07 smoke 固定 diagnostics 硬字段、unsupported diagnostic、坏输入 fail fast
- [x] FODR-01-08 更新 goal / todo / changelog / 架构文档
- [x] FODR-02-01 定义 `ThreadDisplayFact` 联合类型
- [x] FODR-02-02 实现 `resolveThreadDisplayFacts(...)`
- [x] FODR-02-03 历史 reducer 路径改为先处理 fact
- [x] FODR-02-04 实时 patch 路径改为先处理 fact
- [x] FODR-02-05 projector 优先消费 `metadata.displayFact` 限定块
- [x] FODR-02-06 smoke 固定 fact 类型、metadata、unsupported 和生成图片边界
- [x] FODR-02-07 更新 goal / todo / changelog / 架构文档
- [x] FODR-03-01 收敛 snapshot / patch 为同一 state 的两个输出 view
- [x] FODR-04-01 建立 Desktop 纯消费与黄金回归

## 当前指针

已完成：FODR-01 输入协议硬化；FODR-02 `DisplayFact` 中间事实层；FODR-03 单状态机输出统一；FODR-04 Desktop 纯消费与黄金回归。

当前完成边界：新的展示语义必须先进入 `ThreadDisplayFact` 和 reducer state，Desktop main / Renderer 只能消费 `ThreadDisplaySnapshot.items` / `ThreadDisplayPatch.operations`。不要在 Desktop 侧重新增加 snapshot merge、raw `toolUseId` 合并或 raw text 附件猜测。

## 约束

1. FODR-01 只硬化输入协议，不引入 `DisplayFact`。
2. 不允许 silent legacy fallback。
3. 未知输入必须进入 diagnostic / protocol error card。
4. reducer 入口必须 fail fast，不能靠 TypeScript 类型假设运行时输入一定正确。
5. Desktop 纯消费和黄金回归留给 FODR-04，不混入当前阶段。
6. FODR-02 后 projector 只能消费 reducer 写入的 `displayFact` / `primaryBlock` / `attachmentBlocks` 或既有 reducer state item，不允许新增 raw event 扫描分支。

## 后续记录

- 2026-05-30：完成 FODR-01。`ThreadDisplayReducerInputEvent.diagnostics` 改为硬字段；adapter 输出和 reducer 入口都执行运行时协议断言；unsupported 输入在 reducer 中进入 diagnostics，并投影为协议错误展示项；`smoke:thread-display-input-event` 固定正常输入 diagnostics 数组、unsupported diagnostic 和坏输入 fail fast。
- 2026-05-30：完成 FODR-02。新增 `ThreadDisplayFact` 中间事实层；历史 / 实时 reducer 路径先调用 `resolveThreadDisplayFacts(...)`，再生成 state transition 或 patch；工具、文件、附件、错误、系统、控制和 unsupported 都有事实类型；projector 优先使用 `metadata.displayFact` 限定投影范围；`smoke:thread-display-input-event` 固定 fact metadata 和生成图片物化边界。
- 2026-05-30：完成 FODR-03。`ThreadDisplayReducer.acceptOne(...)` 改为 state transition 先行，patch operation 只作为这次状态变化的输出 view；`buildThreadDisplaySnapshot(...)` 改为调用 `reducer.toSnapshot(...)`；移除 patch-first helper；smoke 固定历史 snapshot / 实时 patch state 的工具生命周期等价、并行工具乱序结果、重复 completed tool_use 和 orphan result diagnostic。
- 2026-05-30：完成 FODR-04。Desktop main 移除 `mergeThreadDisplaySnapshot(...)`，刷新时直接保存 App Server 返回的 `displaySnapshot`；`smoke:desktop-session-state` 增加历史 snapshot 和实时 patch 经 Desktop 路由后的最终 `DisplayEvent` 黄金回归，并固定 Desktop 不导入 snapshot merge、不消费 `result.messages`、不做缺 projection raw fallback。
- 2026-05-31：补强 FODR-04 黄金回归。`smoke:desktop-session-state` 的全量 fixture 现在覆盖普通用户图片、assistant 文本、thinking-only 系统提示、compact 完成提示、TodoWrite、模型生成图片、并行文件工具、乱序 `tool_result`、orphan `tool_result`、turn error 和 unsupported diagnostic；同时补齐实时 `unsupported` 输入在 reducer 中投影为协议错误展示项，避免返回空 operations。
