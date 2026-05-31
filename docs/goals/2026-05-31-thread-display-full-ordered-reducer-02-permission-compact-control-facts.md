# Goal: ThreadDisplay permission / compact / control fact 化

状态：已完成。

关联文档：

- [ThreadDisplay 全事件 Ordered Display Reducer 深化](./2026-05-31-thread-display-full-ordered-reducer-next.md)
- [ThreadDisplay 全事件输入来源矩阵](./2026-05-31-thread-display-full-ordered-reducer-01-input-source-matrix.md)
- [CCR ThreadDisplay Reducer 契约](../architecture/thread-display-reducer-contract.md)

## 目标

让权限、compact 和系统控制类展示语义先形成明确 `DisplayFact`，再由 `ThreadDisplayReducer` 的 state transition 生成 snapshot / patch。

目标链路：

```text
permission / compact / control 输入
-> ThreadDisplayReducerInputEvent
-> DisplayFact
-> reducer state transition
-> ThreadDisplaySnapshot / ThreadDisplayPatch
```

## 为什么先做它

这些事件不是普通 assistant 文本，也不完全等同工具生命周期。如果它们继续散在局部 helper 或 Renderer 补丁里，会破坏“Desktop 只消费展示协议”的边界。

## 范围

本阶段只处理：

- permission request
- permission allowed / denied
- permission cancelled
- compact 完成提示
- snip / preserved segment notice
- thinking-only / system notice
- internal control event
- Todo reminder 的边界确认

允许的处理结果：

- 已经 fact 化：补测试或文档矩阵。
- 未 fact 化：补 adapter / fact / reducer transition。
- 暂不支持：进入 unsupported diagnostic。

## 非目标

- 不改权限真实决策逻辑。
- 不改 compact 当前模型上下文语义。
- 不重写权限卡 UI。
- 不把控制事件伪装成 assistant 普通文本。
- 不把 unsupported 事件静默丢弃。

## 迭代拆分

### 迭代 1：现状审计

基于 2-1 矩阵，只查 permission、compact、control 相关入口，确认它们现在是否已有 input event、fact、state transition 和 smoke。

输出：已覆盖项、缺口项、暂不支持项。

### 迭代 2：最小 fact 化

只补缺失的 adapter / `DisplayFact` / reducer transition，不改真实权限决策和 compact 模型上下文。

输出：permission / compact / control 都进入 fact 或 unsupported diagnostic。

### 迭代 3：回归和文档收口

补历史 snapshot 与实时 patch 等价场景，或记录为什么暂时只能覆盖单路径；同步矩阵和父 goal 状态。

输出：smoke 覆盖、文档矩阵更新、剩余缺口。

## 现状审计结论

| 输入 | 当前结论 | 处理方式 |
| --- | --- | --- |
| permission request | 已 fact 化 | `coreTurnEventToDisplayReducerInputEvent` 归为 `control` source identity，`resolveThreadDisplayFacts` 生成 `control` fact，reducer append `permission_request` item。 |
| permission cancelled | 已 fact 化 | `permission_cancelled` 生成 `control` fact，reducer 根据 fact itemId 更新 permission item 为 `cancelled`。 |
| permission allowed / denied | 暂不进入 ThreadDisplay | 当前 `CoreTurnEvent` 没有 allowed / denied 事件；权限真实决策由 permission 服务处理，本阶段不新增展示事件，不伪造 assistant 文本。 |
| compact started / completed | 已 fact 化 | realtime compact 事件生成 `system` fact，reducer 由 state transition append / complete `system_notice`。history compact message 继续作为 system fact 进入 snapshot。 |
| snip / preserved segment notice | 暂不作为 ThreadDisplay 独立事件 | 目前属于 conversation materialization / transcript boundary；没有独立 `CoreTurnEvent`。若未来进入展示链路，必须新增明确 input event 或 unsupported diagnostic。 |
| thinking-only / system notice | 已覆盖 | thinking-only item 由 reducer 生成 system_notice；history system / compact kind 进入 system fact。 |
| internal control event | 已 fact 化但不渲染 | `thread_started`、`turn_started`、`turn_completed`、`turn_cancelled` 生成 `control` fact，`shouldRender=false`，用于边界确认和诊断，不输出 timeline item。 |
| Todo reminder | 不在本阶段新增展示语义 | TodoWrite 作为 tool lifecycle 处理；todo reminder 若来自 system/control 消息，沿现有 system/control 边界进入，复杂组合留给 2-5 golden 补齐。 |

## 本轮实现

- `ThreadDisplayFactMetadata` 增加 `systemKind`、`controlKind`、`shouldRender`，让 Desktop / projector 可以看到 reducer 已确认的控制语义。
- `threadDisplayFacts.ts` 增加 `isThreadDisplaySystemFact` 和 `isThreadDisplayControlFact`，reducer 不再用松散的 `firstFact` 猜控制事件。
- permission request / cancelled 的 realtime patch 改为优先使用 `control` fact 的 `itemId`、`text` 和 metadata。
- compact started / compacted 的 realtime patch 改为绑定 `system` fact metadata，保持 compact snapshot 仍由 reducer state transition 输出。
- `smoke-thread-display-input-event.mjs` 补充 permission、compact 和 internal control fact 断言，覆盖 `controlKind` / `systemKind` / `shouldRender` 与 patch metadata。

## 边界和不变式

- 不新增 permission allowed / denied 的 ThreadDisplay 事件；没有 core event 就不伪造展示项。
- 不把 internal control event 伪装成普通 assistant 文本；`shouldRender=false` 的 control fact 不进入 timeline。
- 不让 unsupported 控制输入静默丢弃；新增来源必须显式 adapter / fact 化，或走 unsupported diagnostic。
- Desktop Renderer 仍只消费 snapshot / patch / projection，本阶段没有新增 raw event 解释逻辑。

## 验证记录

已通过：

```text
npm.cmd run build
npm.cmd run smoke:thread-display-input-event
npm.cmd run smoke:desktop-session-state
npm.cmd run typecheck
git diff --check
```

## 剩余缺口

- permission allowed / denied 若未来需要展示，需要先在 core event 协议中明确事件来源，再进入 adapter / fact / reducer。
- snip / preserved segment notice 目前仍属于上下文物化边界；若要展示，放到 2-5 golden 复核时决定是否新增 unsupported 或独立 system fact。
- Todo reminder 的复杂展示组合留到 2-5，与最终 golden fixture 一起确认。

## 验收标准

- permission / compact / control 事件都有明确 fact 或 unsupported diagnostic。
- reducer 的 snapshot / patch 都从 state transition 输出。
- Desktop Renderer 不新增 raw event 解释逻辑。
- 黄金回归覆盖至少一个历史和实时等价场景，或明确记录下一阶段补充原因。
- 验证命令通过：

```text
npm.cmd run smoke:thread-display-input-event
npm.cmd run smoke:desktop-session-state
npm.cmd run typecheck
git diff --check
```

## 下一步

完成后进入 [attachment / generated output 多来源归一](./2026-05-31-thread-display-full-ordered-reducer-03-attachment-generated-output.md)。
