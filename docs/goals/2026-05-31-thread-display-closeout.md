# Goal: ThreadDisplay 残留入口与文档收口

状态：已完成。

关联文档：

- [CCR ThreadDisplay Reducer 契约](../architecture/thread-display-reducer-contract.md)
- [CCR 全事件统一 Ordered Display Reducer 设计方向](../architecture/thread-display-ordered-reducer-future-design.md)
- [Full Ordered Display Reducer Final State Machine](./2026-05-30-full-ordered-display-reducer-final-state-machine.md)

## 目标

完成 ThreadDisplay 当前阶段的收口，不继续扩大架构范围。

这轮只确认当前主链路是否还有残留旧入口、旧文档表述和黄金回归覆盖盲区；结论必须落成“删除、显式 legacy / compat 保留、或进入后续 goal”，不能留下静默 fallback。

## 为什么先做它

FODR-01 到 FODR-04 已经完成了主链路统一：

```text
历史 transcript / 实时 Core event
-> adapter
-> ThreadDisplayReducerInputEvent
-> DisplayFact
-> ThreadDisplayReducer ordered state
-> ThreadDisplaySnapshot / ThreadDisplayPatch
-> Desktop 纯消费
```

但仓库里可能还残留旧 `messages` replay、旧 raw fallback、旧工具合并 helper 或过期文档表述。它们不一定会马上造成 bug，但会让后续实现者误以为还有第二条展示主路径。

本 goal 的价值是把这些尾巴收干净，让“当前阶段完成”不是口头完成。

## 范围

1. 审计旧展示入口。

   只检查和 ThreadDisplay 主路径有关的入口：

   - Desktop main 是否仍有 `messages` replay 或 snapshot merge。
   - Desktop Renderer 是否仍有 raw `toolUseId` 合并、raw text 图片猜测、缺 projection raw fallback。
   - App Server 是否仍有旧 patch-first / snapshot helper 容易被误用。
   - legacy 命名函数是否真的只在兼容入口使用。

2. 明确每个残留入口的处理方式。

   允许三种结论：

   - 已无用：删除。
   - 兼容需要：保留，但必须命名为 `legacy` / `compat`，并写明触发条件。
   - 当前不做：挂到后续全事件 reducer goal，不能在主路径静默使用。

3. 对齐 ThreadDisplay 文档状态。

   清理或修正这类过期表达：

   - “后续还要补 FODR-04 黄金回归”
   - “Desktop 可能 merge snapshot”
   - “Renderer 可以从 raw message / raw tool result 修正展示”
   - “缺 projection 可以 fallback 到 raw content”

4. 补黄金回归覆盖矩阵。

   记录当前 `smoke:desktop-session-state` 黄金回归已经覆盖哪些展示类型，以及后续新增类型应该补到哪里。

   当前已覆盖：

   - 用户图片
   - assistant 文本
   - thinking-only 系统提示
   - compact 完成提示
   - TodoWrite
   - 模型生成图片
   - 并行文件工具
   - 乱序 `tool_result`
   - orphan `tool_result`
   - turn error
   - unsupported diagnostic

## 非目标

- 不启动新的全事件 reducer 状态机改造。
- 不重写 Desktop UI 卡片体系。
- 不把更多 raw event 解析逻辑加回 Desktop。
- 不新增 silent legacy fallback。
- 不把兼容接口伪装成当前主路径。

## 验收标准

- 仓库中 ThreadDisplay 主路径没有可被误用的旧 replay / raw fallback / snapshot merge 入口。
- 仍需保留的兼容函数都有明确 `legacy` / `compat` 命名或注释。
- 架构文档、goal、todo、CHANGELOG 对 FODR-04 状态口径一致。
- 黄金回归覆盖矩阵记录当前覆盖类型和后续补样例入口。
- 验证命令通过：

```text
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:thread-display-input-event
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

## 收口审计结论

| 检查项 | 当前结论 | 处理方式 |
| --- | --- | --- |
| Desktop main 旧 `messages` replay | 主路径只保存 / 转发 `ThreadDisplaySnapshot` 和 `ThreadDisplayPatch`；`thread/messages/list.result.messages` 仅是兼容载荷。 | 已清理；由 `smoke:desktop-session-state` 固定不得重新消费 `result.messages`。 |
| Desktop main snapshot merge | `apps/desktop/src/main/threadDisplaySnapshotMerge.ts` 已删除，刷新时不再由前台合并旧 snapshot。 | 已清理；文档当前落点改为“直接保存最新 snapshot”。 |
| Renderer raw projection fallback | 缺失或非法 projection 进入协议错误卡，不再从 raw content 恢复展示。 | 已清理；黄金回归覆盖缺 projection / invalid projection。 |
| Renderer 工具生命周期合并 | `findLegacyToolLifecycleEventIndex(...)` / `mergeLegacyToolLifecycleDisplayEvent(...)` 仍保留，但只服务旧实时事件；`source=history/live` 的 ThreadDisplay 协议上下文会在进入该分支前直接追加或按 itemId 更新。 | 显式 legacy 保留；不属于主路径 fallback。 |
| App Server 工具生命周期 reducer | `src/app-server/toolDisplayLifecycle.ts` 仍被 `ThreadDisplayReducer` 使用，用于 reducer 内部工具事实归并，不是 Desktop 旧合并入口。 | 当前主路径保留；后续如果继续 fact 化工具 progress，放入全事件 reducer 后续 goal。 |
| 旧文档过期当前落点 | `realtime-history-display-contract.md` 仍把已删除的 snapshot merge 文件列为当前代码落点。 | 已更新为 Desktop main 直接消费 snapshot / patch。 |

## 黄金回归覆盖矩阵

| 展示类型 | 当前覆盖入口 | 后续新增样例入口 |
| --- | --- | --- |
| 用户图片 | `smoke:desktop-session-state` 历史 snapshot / 实时 patch 等价 fixture | 继续追加到同一黄金 fixture。 |
| assistant 文本 | `smoke:desktop-session-state` | 继续追加到同一黄金 fixture。 |
| thinking-only 系统提示 | `smoke:desktop-session-state` | 后续 reasoning / control 细分样例进入全事件 reducer goal。 |
| compact 完成提示 | `smoke:desktop-session-state` | compact / snip / preserved segment 扩展进入后续 goal。 |
| TodoWrite | `smoke:desktop-session-state` | Todo reminder / named todo 扩展可补 `smoke:desktop-display-events`。 |
| 模型生成图片 | `smoke:desktop-session-state` 和 `smoke:thread-display-input-event` | 多 generated output 样例进入后续 goal。 |
| 并行文件工具 | `smoke:desktop-session-state` | 多文件 / diff / 引用类细节可补 `smoke:thread-display-input-event`。 |
| 乱序 `tool_result` | `smoke:desktop-session-state` | 工具 progress 细节进入后续 goal。 |
| orphan `tool_result` | `smoke:desktop-session-state` | MCP 特殊错误和 permission cancelled 进入后续 goal。 |
| turn error | `smoke:desktop-session-state` | provider / tool error 分类扩展进入后续 goal。 |
| unsupported diagnostic | `smoke:desktop-session-state` 和 `smoke:thread-display-input-event` | unknown item / unsupported item 扩展进入后续 goal。 |

## 完成记录

- 代码审计确认：ThreadDisplay 主路径没有重新暴露旧 replay、raw fallback 或 snapshot merge；保留的旧工具生命周期入口已显式命名为 legacy，并被 ThreadDisplay 协议上下文隔离。
- 文档审计确认：当前 authority 入口仍是 `session-context-and-display-contract.md` 与 `thread-display-reducer-contract.md`；后续全事件深化只挂到 `2026-05-31-thread-display-full-ordered-reducer-next.md`，不混入本 goal。
- CHANGELOG 已记录 FODR-04、黄金回归、缺 projection 不 fallback、Desktop 不再 snapshot merge 等用户可见口径。

## 下一步

完成本 goal 后，再启动后续的 [ThreadDisplay 全事件 Ordered Display Reducer 深化](./2026-05-31-thread-display-full-ordered-reducer-next.md)。
