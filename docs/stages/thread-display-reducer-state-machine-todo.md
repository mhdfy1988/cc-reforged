# ThreadDisplayReducer State Machine Todo

## 目标文档

- [STD-HISTORY-17-0 ThreadDisplayReducer State Machine](../goals/2026-05-28-std-history-17-0-thread-display-reducer-state-machine.md)

## 当前任务列表

- [x] TDRSM-01 梳理现有历史 reducer、实时 reducer、工具 lifecycle 状态边界
- [x] TDRSM-02 设计 `ThreadDisplayReducer` 状态结构
- [x] TDRSM-03 实现 `acceptMany(inputEvents)` 历史入口
- [x] TDRSM-04 实现 `acceptOne(inputEvent)` 实时入口
- [x] TDRSM-05 将工具 lifecycle 状态接入 reducer 实例
- [x] TDRSM-06 历史 snapshot 改为从 reducer `toSnapshotItems()` 输出
- [x] TDRSM-07 实时 patch 改为从 reducer pending operations 输出
- [x] TDRSM-08 补或更新 smoke，固定统一 reducer 状态机路径
- [x] TDRSM-09 确认 snapshot / patch 用户可见输出不变
- [x] TDRSM-10 阶段收口：更新 goal、CHANGELOG、验证记录
- [x] TDRSM-11 清理历史主路径独立 reducer 分支入口
- [x] TDRSM-12 清理实时主路径独立 reducer 分支入口
- [x] TDRSM-13 将 reducer 内部状态深化为 `orderedItemIds + itemsById`
- [x] TDRSM-14 将实时 patch 应用回同一份 reducer state
- [x] TDRSM-15 补 ODR-02 smoke：反序历史输入、实时工具生命周期、孤立 `tool_result` diagnostic
- [x] TDRSM-16 清理 Desktop 缺 projection 的 `thinking_summary` raw fallback
- [x] TDRSM-17 将 Renderer 旧工具生命周期合并入口显式命名为 legacy 兼容路径
- [x] TDRSM-18 补 ODR-04 smoke：缺 projection 的 thinking 也必须走协议错误卡，ThreadDisplay 主路径不按 raw `toolUseId` 合并
- [x] TDRSM-19 阶段收口：更新 ODR-04 goal、架构契约、CHANGELOG、验证记录

## 当前指针

已完成：ODR-04 旧分支清理与回归固化。后续如继续深化，应另开新的“全事件统一 ordered display reducer 最终状态机”goal，不恢复历史 / 实时各自组装旧分支。

## 约束

1. 本 goal 要让历史和实时进入同一个 reducer 类型，不停留在 facade 分派。
2. 本 goal 清理历史 / 实时主路径上的独立 reducer 分支入口；projector 细节保持现状。
3. 不改变 Renderer 协议。
4. 不改变用户可见 UI 行为。
5. 不修改 `currentContextMessages` 链路。
6. 不允许 silent legacy fallback。
7. 旧逻辑如果暂时保留，只能作为 reducer 内部被迁移中的实现细节，不允许作为失败兜底。

## 后续记录

- 2026-05-28：创建 goal / todo。当前从状态边界梳理开始，目标是把历史 snapshot 和实时 patch 都推进同一个 `ThreadDisplayReducer` 状态机。
- 2026-05-28：完成 `ThreadDisplayReducer` 状态结构收口。reducer 实例现在维护 snapshot items、pending patch operations、工具 lifecycle 和 toolUseId 绑定表；历史通过 `acceptMany(...).toSnapshotItems()` 输出，实时通过 `acceptOne(...).consumePatchOperations()` 输出。
- 2026-05-28：实时工具 lifecycle 从独立全局 lifecycle map 收进 live `ThreadDisplayReducer` 实例；同一 turn 的 `item_started` / `item_completed` 复用同一个 reducer，从而保留工具状态。
- 2026-05-28：更新 `smoke:thread-display-input-event`，直接验证 `ThreadDisplayReducer.acceptMany` 与历史 snapshot 输出一致、同一个 reducer 连续处理实时 started/completed 后输出完整 patch operations。
- 2026-05-28：验证通过：`typecheck`、`typecheck:desktop`、`build`、`smoke:thread-display-input-event`、`smoke:desktop-session-state`、`smoke:desktop-display-events`、`smoke:app-server`。
- 2026-05-28：继续收口主路径分派边界：历史 input event 处理逻辑进入 `ThreadDisplayReducer.acceptHistoryInputEvent(...)`，实时 input event 处理逻辑进入 `ThreadDisplayReducer.createPatchOperations(...)`；移除状态机外残留的实时 reducer 分支函数。
- 2026-05-28：本轮验证通过：`typecheck`、`typecheck:desktop`、`build`、`smoke:thread-display-input-event`、`smoke:desktop-session-state`、`smoke:desktop-display-events`、`smoke:app-server`、`git diff --check`。
- 2026-05-29：ODR-02 收口。`ThreadDisplayReducer` 内部状态深化为 `orderedItemIds`、`itemsById`、`displayIdBySourceIdentity`、`toolLifecycleByToolUseId`、diagnostics 和 counts；历史 snapshot 与实时 patch 都从同一份 state 派生。
- 2026-05-29：补 ODR-02 smoke，固定反序历史输入仍按 `orderKey` 输出、实时工具 started/completed 后 reducer state 完整回填、孤立 `tool_result` 进入 diagnostic。
- 2026-05-29：启动 ODR-03 projector 纯化。新增 `threadDisplayProjectorFacts`，统一由 reducer 已确认的 `contentIndex` / `primaryBlock` / 唯一匹配块选择投影输入；projector 不再扫描 raw content 猜工具块，也不从 raw block 反推投影身份。
- 2026-05-29：模型生成图片路径兼容前移到 App Server 物化层：assistant 文本里的 `.ccr/generated_outputs/*.png` 会先补成图片块，再由 attachment projector 正常格式化；attachment projector 和 Desktop Renderer 不再从普通文本路径创建附件卡。
- 2026-05-29：ODR-03 验证范围：`smoke:thread-display-input-event` 固定 projector 不做 raw fallback 和生成图片物化；`smoke:app-server` 固定工具结果仍能回填主工具卡；`smoke:desktop-display-events` 固定 Desktop 不再单独猜模型输出附件。
- 2026-05-30：ODR-04 收口第一轮。删除 Desktop `canFallbackMissingThreadDisplayProjection`，缺 projection 的 `thinking_summary` 不再走 raw content fallback；Renderer 旧工具生命周期合并入口改为 `findLegacyToolLifecycleEventIndex` / `mergeLegacyToolLifecycleDisplayEvent`，只作为非 ThreadDisplay 旧事件兼容路径。
- 2026-05-30：补 ODR-04 smoke。`smoke:desktop-session-state` 固定缺 projection / 非法 projection 均显示协议错误卡，包含 thinking summary；同时固定 ThreadDisplay 主路径不按 raw `toolUseId` 在 Renderer 侧合并工具结果。
