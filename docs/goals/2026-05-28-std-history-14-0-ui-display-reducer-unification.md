# Goal: STD-HISTORY-14-0 UI display reducer unification

## 目标

把 UI 可见历史和实时 patch 的展示投影继续向 Codex 语义收敛。

当前 `currentContextMessages` 已经迁到 ordered reducer；本 goal 处理另一条链路：`ThreadDisplaySnapshot` 和 `ThreadDisplayPatch` 的展示项生成逻辑。

完成后，历史恢复和实时展示应逐步共享同一套 display item factory / projector，再进一步共享工具生命周期、附件、错误、图片等特殊项 reducer。

## 为什么要做

Codex 的历史 replay 和实时 notification 虽然入口不同，但都会收敛到统一的 turn / thread item 展示模型。

CCR 当前已经做到 Renderer 只消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`，但 App Server 内部仍有两套入口分支：

- 历史 snapshot：`threadMessagesToDisplayItems(...)`
- 实时 patch：`getCoreEventDisplayPatchOperations(...)`

两者共享了一些投影能力，但普通消息、完成消息、工具生命周期、特殊卡片仍有重复判断。继续放任会导致历史/实时展示口径再次分叉。

## 范围

本 goal 分阶段执行。

第一阶段只做最小统一：

1. 抽出公共 `display item factory / projector`。
2. 让历史普通消息、实时 started item、实时 completed item 复用同一套基础 item 构造。
3. 不重写所有实时 patch。
4. 不迁移完整工具生命周期 reducer。

第二阶段再处理特殊项：

1. 工具生命周期 reducer。
2. 附件 / 文件 / 图片。
3. 错误卡。
4. permission / compact / thinking 等特殊事件。

第三阶段再清理重复分支：

1. 收敛 `threadMessagesToDisplayItems(...)`。
2. 收敛 `getCoreEventDisplayPatchOperations(...)`。
3. 清理剩余 legacy raw fallback。

## 明确不做

- 不修改当前模型上下文 `currentContextMessages` reducer。
- 不重写 transcript 物化。
- 不改变 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 协议字段。
- 不把 Desktop Renderer 重新变成 raw transcript 解释器。
- 不在第一阶段重构所有工具卡细节。

## 不变式

1. Renderer 只消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 中的合法 projection。
2. 缺失或非法 projection 不能 raw fallback 成工具卡 / 文件卡。
3. 历史和实时的普通消息展示项必须由同一个基础 factory 生成。
4. 工具结果绑定仍由 App Server 的工具生命周期逻辑负责，Renderer 不按 raw `toolUseId` 猜测合并。
5. 当前模型上下文和 UI 可见历史仍是两种投影，不能重新混用。
6. 保留明确的 legacy thinking fallback 仅用于旧 thinking summary 展示，不作为通用 fallback。

## 验收标准

- [x] 新增或整理第一阶段公共 display item factory / projector。
- [x] 历史普通消息、实时 started item、实时 completed item 复用公共 factory。
- [x] `thread/display` 协议路径不按 raw `toolUseId` 在 Renderer 侧合并工具结果。
- [x] 缺 projection 的工具 / 文件类展示项仍生成协议错误卡。
- [x] 旧 thinking summary 特例仍不变成错误卡。
- [x] 相关 smoke 通过。

## 执行结果

状态：完成。

完成内容：

- `threadDisplay.ts` 新增公共基础 `createProjectedDisplayItem(...)`。
- 历史普通消息、实时 `item_started`、实时 `item_completed` 的普通展示项已复用公共 factory。
- `thread/display` 协议路径保持由 App Server snapshot / patch 负责工具生命周期绑定，Renderer 不再按 raw `toolUseId` 合并协议项。
- 缺失 projection 的工具 / 文件类展示项仍生成协议错误卡；旧 thinking summary 特例保留。
- 第二阶段已先小步收敛工具生命周期展示项：`createToolLifecycleDisplayItem(...)` 复用公共 factory，但工具 reducer 本身暂不重写。
- 第二阶段继续收敛系统类特殊项：turn failed、permission request、reasoning-only notice、context compaction started / completed 已复用公共 factory；`withThreadDisplayProjection(...)` 只作为公共 factory 内部实现保留。
- 普通图片 / 附件 projection 已补回归：历史 snapshot 和实时 patch 都固定验证用户上传图片、模型输出图片会生成 `attachmentSnapshots`，并移除 `[图片]` 占位或本地生成路径正文。
- 历史 snapshot 与实时 patch 入口已委托同一个 `createThreadDisplayReducer(...)`。原 `threadMessagesToDisplayItems(...)` / `getCoreEventDisplayPatchOperations(...)` 不再作为入口口径，改为 reducer 内部 helper。
- 附件 / 错误 projection 已拆出独立 projector：`threadDisplayAttachmentProjector.ts` 负责附件快照、模型输出路径清理和用户图片占位清理；`threadDisplayErrorProjector.ts` 负责工具错误与 App Server 错误 snapshot 构造。

验证：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run typecheck:desktop`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:desktop-session-state`：通过。
- `npm.cmd run smoke:desktop-display-events`：通过。

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

## 后续

本 goal 已收口。后续深化已拆到 `STD-HISTORY-15-0 UI display reducer deepening`、`STD-HISTORY-16-0 ThreadDisplayReducerInputEvent`、`STD-HISTORY-17-0 ThreadDisplayReducer State Machine` 和 `STD-HISTORY-18-0 ThreadDisplay Legacy Path Removal` 继续完成。
