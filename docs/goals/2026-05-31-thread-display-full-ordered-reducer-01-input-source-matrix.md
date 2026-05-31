# Goal: ThreadDisplay 全事件输入来源矩阵

状态：已完成。

关联文档：

- [ThreadDisplay 全事件 Ordered Display Reducer 深化](./2026-05-31-thread-display-full-ordered-reducer-next.md)
- [CCR 全事件统一 Ordered Display Reducer 设计方向](../architecture/thread-display-ordered-reducer-future-design.md)
- [CCR ThreadDisplay Reducer 契约](../architecture/thread-display-reducer-contract.md)

## 目标

建立所有展示来源到 `ThreadDisplayReducerInputEvent`、`DisplayFact`、reducer state 和 smoke 覆盖的矩阵。

本阶段只确认边界，不做大实现。每个来源必须得到一个结论：

- 已覆盖。
- 缺 adapter。
- 缺 `DisplayFact`。
- 缺 state transition。
- 缺 smoke。
- 明确暂不支持，并进入 unsupported diagnostic。

## 为什么先做它

第二阶段如果直接改 permission、附件或工具 progress，很容易边改边扩大范围。先做矩阵可以把当前真实缺口摊开，让后续每个小 goal 只处理一类展示语义。

## 范围

需要盘点的输入来源：

- history message
- realtime core event
- user / assistant / system message
- tool use / progress / result / failed / interrupted
- permission request / allowed / denied / cancelled
- compact / snip / preserved segment notice
- TodoWrite / todo reminder
- generated image / user upload / file attachment
- provider error / tool error / protocol error
- unknown / unsupported input

矩阵字段至少包括：

- 输入来源
- 当前代码入口
- `ThreadDisplayReducerInputEvent` 覆盖状态
- `DisplayFact` 覆盖状态
- reducer state 处理方式
- projector 处理方式
- Desktop 是否纯消费
- 当前 smoke
- 缺口和后续 goal

## 非目标

- 不实现新的展示类型。
- 不修改 Desktop UI。
- 不重写 reducer 状态机。
- 不删除 legacy 兼容入口。
- 不新增 silent fallback。

## 迭代拆分

### 迭代 1：入口清单

只读代码和现有 smoke，列出每类展示来源当前从哪里进入 `ThreadDisplayReducerInputEvent`。

输出：输入来源 -> 当前入口 -> 当前 smoke。

### 迭代 2：事实和状态矩阵

把每个输入来源继续映射到 `DisplayFact`、reducer state transition、projector 和 Desktop 消费边界。

输出：完整覆盖矩阵，并标注缺 adapter、缺 fact、缺 state、缺 smoke 或 unsupported。

### 迭代 3：后续小 goal 分派

把矩阵里的缺口分配到 2-2 到 2-5，不能留下“后面再看”的悬空项。

输出：每个缺口都有 owner goal 和验收建议。

## 输入来源覆盖矩阵

| 输入来源 | 当前代码入口 | `ThreadDisplayReducerInputEvent` | `DisplayFact` | reducer / state | projector / Desktop | 当前 smoke | 缺口和后续 goal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| history message | `appServerThreadMessagesToDisplayReducerInputEvents` / `appServerThreadMessageToDisplayReducerInputEvent` | 已覆盖，`source="history"`，`sourceIdentity` 按 message/tool/attachment/error/system/control/unsupported 归类 | 已覆盖，`resolveHistoryThreadDisplayFacts` 产出 message、tool_lifecycle、file、attachment、error、system 或 unsupported | `acceptMany` 重建 snapshot；message-like 直接 append，tool-like 进入 `toolLifecycleByToolUseId` | Desktop 消费 snapshot / projection，不再 raw merge | `smoke-thread-display-input-event.mjs`、`smoke-desktop-session-state.mjs` | 已覆盖；后续只维护矩阵一致性 |
| realtime core event | `coreTurnEventToDisplayReducerInputEvent` / `coreEventToThreadDisplayPatch` | 已覆盖，`source="realtime"`，按 core event kind 建立 orderKey、sourceIdentity 和 diagnostics | 已覆盖，`resolveRealtimeThreadDisplayFacts` 覆盖 item、turn、compact、permission、unsupported | `acceptOne` 增量 patch；item/tool/control/error/system 分支显式处理 | Desktop 消费 patch / projection；缺 projection 走 protocol error | `smoke-thread-display-input-event.mjs`、`smoke-desktop-session-state.mjs` | 已覆盖；细粒度 control 语义归 2-2 |
| user / assistant / system message | history adapter；realtime item_started / item_completed | 已覆盖，普通消息归 message，system / compact kind 归 system | 已覆盖，message 或 system fact | message/system item append；context compact realtime 走专门 state item | Desktop 纯消费 display item | `smoke-thread-display-input-event.mjs` | compact/snip/preserved segment 的展示边界归 2-2 |
| tool use / result | history tool_use/tool_result block；realtime item_started/item_completed | 已覆盖，`sourceIdentity.kind="tool"` | 已覆盖，tool_lifecycle 或 file fact | `acceptToolLikeDisplayFact` 维护 lifecycle；orphan result 产生 diagnostic | projector 使用 fact-scoped blocks，不按 raw toolUseId 合并 | `smoke-thread-display-input-event.mjs`、`smoke-desktop-session-state.mjs` | progress/failed/interrupted 生命周期细化归 2-4 |
| tool progress / failed / interrupted | realtime item_delta、tool_result error/status、turn_cancelled | 部分覆盖；当前没有独立 tool progress source kind | 部分覆盖；delta 先作为 control fact，tool_result error 进入 tool lifecycle | delta 可 seed streaming state；failed/interrupted 语义仍分散在 result/status/turn 事件 | Desktop 有基础错误和投影保护 | `smoke-thread-display-input-event.mjs` | 2-4 统一工具进度、失败、中断生命周期和乱序回归 |
| permission request / cancelled | realtime `permission_requested` / `permission_cancelled` | 已覆盖，`sourceIdentity.kind="control"` | 已覆盖，control fact，`shouldRender=true` | request append permission_request item；cancelled 更新 permission item status | Desktop 消费 patch；route 层已有 add-permission 覆盖 | `smoke-desktop-session-state.mjs` | allowed/denied 不是当前 CoreTurnEvent，2-2 明确来源边界和 smoke |
| permission allowed / denied | Desktop permission 交互状态 / 外层会话状态 | 未作为 ThreadDisplay core event 覆盖 | 未覆盖为独立 fact | 未进入 reducer state | Desktop 可能在 permission store / route 层消费 | 无直接 reducer smoke | 2-2 判断是否 fact 化；若不进入 ThreadDisplay，文档明确边界 |
| compact / snip / preserved segment notice | realtime context_compaction_started/context_compacted；history system/compact kind | compact 已覆盖；snip/preserved segment 未见独立 input kind | compact 已覆盖为 system fact；snip/preserved segment 暂无独立 fact | started append compact item；compacted complete compact item | Desktop 消费 system/compact display item | `smoke-thread-display-input-event.mjs` | 2-2 补 snip/preserved segment 边界，无法识别则进 unsupported diagnostic |
| TodoWrite / todo reminder | TodoWrite 作为 tool block；todo reminder 可能来自 system/control 消息 | TodoWrite 已覆盖为 tool/file；reminder 边界未完全锁定 | TodoWrite 已覆盖；reminder 视来源可能为 system/control/message | TodoWrite 进入 tool lifecycle；reminder 若为普通消息则 append | Desktop golden 已覆盖 TodoWrite 类投影 | `smoke-desktop-session-state.mjs` | 2-2 锁定 todo reminder 来源；必要时补 control fact smoke |
| generated image | generated output materialization / projection path | 作为 message/tool blocks 的 projection 输入被覆盖 | 依赖 message/tool/file/attachment fact scoped blocks | reducer 保留 blocks；projection 层 materialize generated output | Desktop 纯消费生成物 projection | `smoke-thread-display-input-event.mjs`、`smoke-desktop-display-events.mjs` | 多生成物、混合生成物归 2-3 |
| user upload / file attachment | history message blocks：attachment/image/file/audio/video | 已覆盖，`sourceIdentity.kind="attachment"` | 已覆盖，attachment fact | attachment item append | Desktop 消费 attachment projection | `smoke-thread-display-input-event.mjs`、`smoke-desktop-session-state.mjs` | 多附件、混合附件、identity 稳定性归 2-3 |
| file operation output | tool use/result：Read、Write、Edit、MultiEdit、NotebookEdit、Glob、Grep | 已覆盖，tool source identity | 已覆盖为 file fact 或 tool_lifecycle fact | file/tool lifecycle state 统一处理 | Desktop 消费 file/tool projection | `smoke-thread-display-input-event.mjs` | 更完整文件工具组合归 2-3 / 2-4 |
| provider error / turn error | realtime `turn_failed`；history error role | 已覆盖，`sourceIdentity.kind="error"` | 已覆盖，error fact | append error display item | Desktop 纯消费 error item | `smoke-thread-display-input-event.mjs` | MCP / provider 特殊错误归 2-5 golden 补齐 |
| tool error | tool_result error/status failed | 部分覆盖，仍以 tool result 进入 | 部分覆盖，tool lifecycle 负责失败状态 | 由 lifecycle reducer 合并 tool result | projector 展示 tool lifecycle 状态 | `smoke-thread-display-input-event.mjs` | 2-4 扩展 failed/interrupted/progress 回归 |
| protocol error | invalid input、invalid projection、unsupported input | 已覆盖，invalid input fail fast；unsupported 走显式 input event | 已覆盖，unsupported fact；projection error 走 protocol error item | diagnostic item append；无 silent fallback | Desktop 缺投影 / 无效投影显示 protocol error | `smoke-thread-display-input-event.mjs`、`smoke-desktop-session-state.mjs` | 2-5 做最终 golden 缺口复核 |
| unknown / unsupported input | `createUnsupportedDisplayReducerInputEvent` | 已覆盖，`sourceIdentity.kind="unsupported"`，payload 为 unsupported | 已覆盖，unsupported fact | `createInputDiagnosticDisplayItem` append protocol_error | Desktop 消费诊断项，不 raw fallback | `smoke-thread-display-input-event.mjs`、`smoke-desktop-session-state.mjs` | 已覆盖；新增 unknown source 必须显式归类或 unsupported |

## 缺口分派

- 2-2：permission allowed / denied 的来源边界，compact / snip / preserved segment notice，todo reminder / control fact 是否需要可渲染状态。
- 2-3：多附件、多生成物、混合附件与生成物的 identity 稳定性，以及 generated output materialization 的历史/实时等价回归。
- 2-4：工具 progress、failed、interrupted、orphan、duplicate、乱序生命周期的统一状态机和 smoke。
- 2-5：MCP / provider 特殊错误、最终 golden fixture、父 goal 状态收口和文档索引。

## 完成记录

本 goal 已完成输入来源矩阵审计。结论是：现有 reducer 已覆盖 history、realtime、message、tool use/result、attachment、compact、permission request/cancelled、error、protocol error 和 unsupported 的主路径；第二阶段后续工作不应新增 raw fallback，而应在 2-2 到 2-5 中补齐 control 语义、附件/生成物组合、工具生命周期和最终 golden 回归。

本阶段未修改实现代码。

## 验收标准

- 矩阵覆盖本 goal 列出的所有输入来源。
- 每个缺口都指向后续小 goal 或明确 unsupported。
- 没有把未知来源描述成“可由 raw fallback 处理”。
- 验证命令通过：

```text
git diff --check
```

## 下一步

完成矩阵后，进入 [permission / compact / control fact 化](./2026-05-31-thread-display-full-ordered-reducer-02-permission-compact-control-facts.md)。
