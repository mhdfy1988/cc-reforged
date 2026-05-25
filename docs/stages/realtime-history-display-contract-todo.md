# CCR 历史恢复与实时展示统一协议实施计划

本文是 [CCR 历史恢复与实时展示统一协议](../architecture/realtime-history-display-contract.md) 的实施计划。长期设计口径以 architecture 文档为准；本文只记录后续开发顺序、验收点和当前推进清单。

源码依据见 [Codex / OpenClaw 实时与历史恢复源码证据索引](../references/codex-openclaw-live-history-source-evidence.md)。

## 总目标

把 CCR Desktop 的历史恢复和实时展示统一到同一套 App Server 展示协议：

```text
历史恢复:
transcript -> display reducer -> ThreadDisplaySnapshot -> Renderer

实时展示:
live event -> display reducer -> ThreadDisplayPatch -> Renderer
```

最终要求：

- 刷新页面后，从 transcript 恢复出来的可见时间线与实时结束时一致。
- Renderer 不直接解释 transcript、`parentUuid`、`sidechain`、工具 raw event。
- 数量口径明确区分 raw transcript events、Core context messages、visible timeline items、hidden timeline items。
- 普通恢复不再出现“短链”概念。
- 不修改原始 Claude Code transcript 语义；如需触碰共享基线，先评估并征求用户确认。

## 当前阶段状态

状态：阶段 9 的“当前上下文物化修复”已完成第一版，阶段 9 后复审已完成 App Server 可见历史 display projection 与 Core 当前模型上下文拆分；STD-HISTORY-10 已完成并行工具结果来源绑定、旧兼容路径清理、真实 Desktop UI 回归和发布说明收口。Core 当前模型上下文按 compact / snip / sidechain 语义物化，恢复后继续保持压缩后的上下文大小；App Server `thread/resume` 的 `ThreadDisplaySnapshot` 从 transcript 展示投影恢复压缩前后完整可见历史，不再把压缩后的 Core context 当作完整 UI 历史。历史恢复使用必选 `ThreadDisplaySnapshot`，实时展示使用 `thread/display/patch`，`ThreadDisplayItem.projection` 由 App Server / shared projector 输出并经过运行时校验；Renderer 主路径不再使用旧 `messages` replay、旧实时展示通知或缺失 projection 的 raw content fallback。

阶段 9 的新增目标是“当前模型上下文物化修复”：Core resume 必须重放 compact / snip / sidechain 语义，恢复时不再用“最长链优先”等启发式选择 leaf。这里的 compact boundary 裁剪只作用于 Core 当前模型上下文，不作用于 UI 可见历史。

2026-05-24 再校准：这里的“共享物化结果”不能理解成 Core 和 App Server 都消费同一个 `messages` 数组。正确口径是共享 transcript 解释层，输出两个投影：

- `currentContextMessages`：压缩后的当前模型上下文，用于 Core 继续对话。
- `displayReplayItems`：可见历史展示投影，用于 `ThreadDisplaySnapshot`，不应因为模型上下文压缩就默认丢掉压缩前可见历史。

已完成：

- 明确普通历史恢复只有主线，没有“短链恢复”。
- 明确 `parentUuid` 是 transcript 链路字段，不是业务父子任务。
- 明确 `sidechain` / 子任务 / fork / branch 与普通恢复的边界。
- 核对 Codex 源码：历史 rollout 与实时 event 最终收敛到 `Turn / ThreadItem`。
- 核对 OpenClaw 源码：`chat.history` 与 WebSocket 实时事件最终由 `buildChatItems()` 合并展示。
- 输出 architecture 设计文档和 source evidence 文档。
- App Server 已在 snapshot / patch item 上输出 rich projection，覆盖工具卡、文件卡、附件、错误快照、TodoWrite 和内部 plan draft 隐藏规则。
- Renderer 已改为 projection-only；snapshot / patch item 缺失或携带非法 projection 时展示协议错误卡，不再按 raw content 预拆分。
- Desktop 主进程已补 `ThreadDisplaySnapshot` 与旧 `messages` merge 保护，避免短 snapshot 覆盖更完整状态。
- Desktop / Renderer 已补空 `ThreadDisplaySnapshot` 与线程/工作区切换清理护栏：空快照也会清空旧时间线，新线程和跨工作区会清旧展示状态，同一工作区刷新不会误清当前会话。
- 旧 `item/*`、`permission/*`、`context/compacted`、`turn/failed` 展示通知已停止下发；权限请求、权限取消和 turn failed 状态由 `thread/display/patch` 接管。
- App Server `thread/resume` 已拆分可见历史展示与 Core 当前模型上下文：`messages` / `displaySnapshot` 使用 transcript display replay，`coreContextMessages` 只统计 Core 当前上下文；compact boundary 不再裁掉 UI 可见历史。

长期保留边界：

- Composer 里的用户输入 optimistic state 仍是 Renderer 本地临时展示态，不作为 App Server 持久事实源；刷新后以 snapshot 恢复为准。
- Desktop main 里只作为状态合并保护输入的旧 `threadMessages` 字段已清理；`thread/messages/list` 的 `messages` 仍作为 App Server 兼容接口存在，不进入 Desktop status。
- Desktop 主路径从本专项后不再支持旧 replay 展示协议；旧 `messages` 只作为兼容字段或当前模型上下文读取，不作为完整 UI 历史。

## 当前任务列表（实时）

- [x] 阶段 3：实时 Patch Mapper 收口。
- [x] 阶段 4：Renderer 收口。
- [x] 阶段 5：Smoke 与回归。
- [x] 阶段 6：审计补项与再次验收。
- [x] 阶段 7：Rich Projection 接管专项。
- [x] 阶段 8：兼容路径清理与 projection 校验。
- [x] 阶段 9：当前上下文物化修复。

## 当前指针

已完成：阶段 9 当前模型上下文物化修复；阶段 9 后复审修正；STD-HISTORY-10 并行工具来源绑定与 Desktop 展示主路径收口。

当前正在做：本实施计划已收口，后续只保留发布或新需求触发的增量维护。

完成后下一项：无；如后续新增恢复 / 展示能力，先按本文风险与护栏重新开 goal。

## 阶段 9 外后续收口项

- [x] App Server 可见历史 display projection 与 Core 当前模型上下文拆分：`thread/resume` / `ThreadDisplaySnapshot` 展示压缩前后完整可见历史，compact boundary 只作为展示卡片/分隔项；Core resume 继续只使用压缩后的当前上下文。
- [x] 真实 Desktop UI 手工回归：历史恢复、实时流式、工具卡、权限卡、上下文压缩、刷新恢复、窗口刷新 / 重启恢复。
- [x] 旧 `threadMessages` 过渡字段清理：Desktop main 不再缓存 `status.threadMessages`，snapshot merge 不再依赖 `mergedMessages`。
- [x] 发布说明收口：明确从本专项后 Desktop 主路径不再支持旧 replay 展示协议。

## 阶段 1：协议锁定

目标：先定义 App Server 与 Renderer 的稳定展示协议，避免边实现边发明字段。

任务：

- [x] 在 App Server 协议层新增或扩展展示协议类型：
  - `ThreadDisplaySnapshot`
  - `ThreadDisplayPatch`
  - `ThreadDisplayItem`
  - `ThreadDisplayCounts`
- [x] 明确 `ThreadDisplayItem` 的第一版 item 类型：
  - user message
  - assistant message
  - thinking summary / progress
  - tool call
  - tool result
  - permission request
  - file change
  - system notice
  - error
- [x] 明确 patch op 第一版语义：
  - append item
  - update item
  - complete item
  - replace active stream
  - update counts
- [x] 给旧接口保留兼容层，不立即删除现有 Desktop 消费路径。

完成记录：

- `src/app-server/protocol.ts` 已定义 `ThreadDisplaySnapshot`、`ThreadDisplayPatch`、`ThreadDisplayItem`、`ThreadDisplayCounts` 和第一版 patch op。
- `apps/desktop/src/renderer/src/domain/displayTypes.ts` 已通过 type-only alias 读取 App Server 协议类型，避免 Renderer 后续再发明一套展示协议。
- `ThreadResumeResult` 预留 `displaySnapshot` 兼容字段；现有 `messages` 兼容路径不删除。
- 验证通过：`npm.cmd run typecheck:desktop`、`npm.cmd run typecheck`。

验收：

- 类型定义能通过 `npm.cmd run typecheck:desktop` 或对应 App Server typecheck。
- 文档中的 counts 字段在协议里有对应字段。
- Renderer 不需要知道“历史/实时来源”才能渲染一个 display item。

## 阶段 2：历史恢复 Snapshot Builder

目标：历史恢复从 transcript 生成 `ThreadDisplaySnapshot`，不要让 Desktop 自己猜 replay 逻辑。

任务：

- [x] 新增 `buildThreadDisplayFromTranscript(...)` 或等价 App Server builder。
- [x] builder 内部复用已有 transcript 读取、主线选择、sidechain 隔离逻辑。
- [x] 将 raw transcript 行转换为 `ThreadDisplayItem`。
- [x] 输出 `ThreadDisplayCounts`：
  - `rawTranscriptEvents`
  - `coreContextMessages`
  - `projectedDisplayItems`
  - `visibleTimelineItems`
  - `hiddenDisplayItems`
  - `filteredTranscriptEvents`
  - `hiddenTimelineItems`
- [x] 历史恢复接口返回 snapshot，或在现有 response 中附带 snapshot。
- [x] 恢复提示文案不再显示数量，只说明历史上下文已加载、可以继续对话；数量口径保留给调试和诊断。

完成记录：

- 新增 `src/app-server/threadDisplay.ts`，提供 `buildThreadDisplaySnapshot(...)`。
- `thread/resume` 继续返回兼容 `messages`，并附带 `displaySnapshot`。
- snapshot 已包含 `source`、`items`、`counts`、`canonicalLeafUuid` 和诊断信息。
- Desktop 恢复提示不再展示 `displaySnapshot.counts`，避免用户看到不稳定或易误解的恢复条数。
- `scripts/smoke-app-server.mjs` 已断言 history snapshot 的来源、threadId、拆分计数和恢复内容。
- 验证通过：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:app-server`、`npm.cmd run typecheck:desktop`、`npm.cmd run desktop:build`。

剩余：

- Renderer 仍在消费旧 `messages` 兼容路径，尚未切到 `displaySnapshot`。

验收：

- 恢复历史会话后，用户消息、助手消息、工具卡、错误卡能正确展示。
- `sidechain` 子任务不参与主线尾部选择。
- branch / fork 不混入原会话恢复。
- 不再出现“已回放 16 条历史事件”但界面只显示 5 条且无解释的情况。

## 阶段 3：实时 Patch Mapper

目标：实时事件也进入同一套展示模型，只是传输方式为增量 patch。

任务：

- [x] 新增 `applyLiveEventToThreadDisplay(...)` 或等价 mapper。
- [x] 用户输入 optimistic state 边界明确：保留为 Renderer 本地临时 display item，不进入 App Server patch 事实源；刷新后由 snapshot 恢复。
- [x] 助手 delta 映射为 active stream patch。
- [x] 工具调用开始 / 更新 / 完成映射为 tool item patch。
- [x] 权限请求映射为 permission request item patch。
- [x] 文件变更映射为 file change item patch。
- [x] turn completed 后确认 completed item 能从 transcript 重新构建。

完成记录：

- `src/app-server/threadDisplay.ts` 新增 `coreEventToThreadDisplayPatch(...)`。
- `src/app-server/coreEventMapper.ts` 新增 `coreEventToThreadDisplayPatchNotification(...)`。
- App Server `createAppServerContext(...)` 保留旧实时通知，同时优先发送 `thread/display/patch`，让 Desktop 能先进入 patch 模式，再忽略旧展示通知。
- `item_delta` 以 `update_item` + `deltaMode: append_text` 表示增量文本，并携带 `assistant_message` / `thinking_summary` item 类型。
- 文件写入/编辑类工具在 App Server display item 层标记为 `file_change`；Renderer 仍复用既有工具卡和文件快照渲染。
- `scripts/smoke-app-server.mjs` 已断言 turn failed 会同步产生 `thread/display/patch` error item，且 patch 先于旧 `turn/failed` 展示通知。
- `scripts/smoke-desktop-session-state.mjs` 已断言 patch delta、thinking delta、permission request、file change 和 snapshot rebuild 走同一套 Session reducer。
- 验证通过：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:app-server`、`npm.cmd run typecheck:desktop`、`npm.cmd run smoke:desktop-session-state`、`npm.cmd run smoke:desktop-display-events`。

验收：

- 实时流式显示不依赖 Renderer 自己解析 raw event。
- 工具结果完成后不重复显示。
- turn 结束后刷新页面，完成态内容不丢失。
- active stream、tool in-flight、permission pending 这类临时态只作为 patch 状态存在，不成为事实源。

## 阶段 4：Renderer 收口

目标：Renderer 只消费 `ThreadDisplaySnapshot` 和 `ThreadDisplayPatch`。

任务：

- [x] ChatTimeline 接收统一 DisplayEvent，由 snapshot / patch 统一转换为 SessionAction。
- [x] 历史 replay 入口改为优先 apply snapshot。
- [x] 实时通知入口改为优先 apply patch。
- [x] Renderer 对 transcript / tool raw event / parent chain 的解释逻辑已隔离为旧 `messages` 兼容 fallback，不再是主路径。
- [x] UI 本地状态只保留展开、滚动、复制、选中、搜索、Composer optimistic 等纯展示/临时状态。

完成记录：

- Desktop main status 新增 `threadDisplaySnapshot`，`thread/resume` 和 `thread/messages/list` 都把 App Server snapshot 带到 Renderer。
- Renderer `applyDesktopStatusSnapshot(...)` 和历史恢复入口优先消费 `ThreadDisplaySnapshot`。
- Renderer `routeDesktopEvent(...)` 新增 `thread/display/patch` 路由。
- Renderer 一旦收到 `thread/display/patch`，后续旧 `item/*`、`permission/*`、`context/compacted`、`turn/failed` 只保留生命周期动作，过滤旧展示动作，避免重复卡片。

验收：

- Renderer 组件不直接依赖 transcript 字段判断主线。
- 同一类 item 在历史恢复和实时展示下使用同一个组件。
- 历史恢复和实时展示的视觉结果一致。

## 阶段 5：Smoke 与回归

目标：用自动化验证锁住刷新一致性和数量口径。

任务：

- [x] 新增刷新一致性 smoke：
  - 发送用户消息。
  - 收到助手流式输出。
  - 触发至少一个工具调用和工具结果。
  - 记录实时结束后的 visible timeline。
  - 模拟刷新或重新加载历史。
  - 断言 restored visible timeline 与实时结束态一致。
- [x] 新增计数 smoke：
  - 构造包含系统事件、工具事件、隐藏项、可见消息的 transcript。
  - 断言 raw / core / visible / hidden 计数分别正确。
- [x] 补一个历史异常诊断 smoke：
  - 多 main leaf / 异常 parent 链不导致恢复崩溃。
  - 异常路径必须有可观测 diagnostic，不能成为普通恢复 fallback。
- [x] 运行 Desktop/App Server 定向 typecheck 和 smoke。

完成记录：

- `scripts/smoke-app-server.mjs` 覆盖：
  - history snapshot counts：raw / visible / hidden。
  - `thread/messages/list` snapshot。
  - 多 leaf 恢复诊断。
  - display patch 先于旧展示通知。
- `scripts/smoke-desktop-session-state.mjs` 覆盖：
  - `thread/display/patch` 文本 delta、thinking delta、permission request、file change。
  - `ThreadDisplaySnapshot` 重新构建用户消息和文件工具卡。
- `scripts/smoke-desktop-display-events.mjs` 保持既有工具卡、文件卡、附件、错误卡回归。
- `scripts/smoke-core-session-parent-chain.mjs` 覆盖：
  - 恢复正常 transcript 后继续一轮 mock turn，新 user 必须接到恢复前 canonical leaf。
  - 新 assistant 必须接到刚写入的 user，所有 `parentUuid` 都指向同一 transcript 文件内的消息。
- 已验证命令：
  - `npm.cmd run typecheck`
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run build`
  - `npm.cmd run desktop:build`
  - `npm.cmd run smoke:core-session-parent-chain`
  - `npm.cmd run smoke:app-server`
  - `npm.cmd run smoke:desktop-session-state`
  - `npm.cmd run smoke:desktop-display-events`

建议命令：

```powershell
npm.cmd run typecheck:desktop
npm.cmd run smoke:core-session-parent-chain
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server
```

实际命令以 `package.json` 当前脚本为准，执行前先核对脚本是否存在。

验收：

- 刷新一致性 smoke 通过。
- 计数 smoke 通过。
- Desktop 真实界面恢复历史时不丢消息、不重复消息、不混淆数量。

## 阶段 6：审计补项与再次验收

目标：把 2026-05-23 复审里发现的“看起来完成但边界仍不稳”的问题补齐，并用代码、文档和验证重新确认当前状态。

任务：

- [x] 修复 Desktop 主进程中 `ThreadDisplaySnapshot` 与旧 `messages` merge 保护不一致的问题，避免短 snapshot 覆盖更完整的实时/历史状态。
- [x] 评估并推进 App Server 接管工具卡 / 文件卡 rich projection 的落点；如果本轮不能安全整体迁移，必须把剩余边界写成明确的下一阶段任务，而不是继续用“已经统一”口径覆盖。
- [x] 同步 architecture 文档到当前真实协议字段、当前实现路径、兼容 fallback 和未完成边界。
- [x] 补充自动回归，并评估真实 Desktop 手工回归能否在本轮执行；未执行必须写明原因和可执行入口。
- [x] 完成后重新审核：协议一致性、刷新不丢消息、Renderer 边界、文档真实性、验证覆盖。

完成记录：

- 新增 `apps/desktop/src/main/threadDisplaySnapshotMerge.ts`，`thread/messages/list` 返回较短 snapshot 时不再覆盖同线程已有的更完整 `ThreadDisplaySnapshot`。
- `apps/desktop/src/main/index.ts` 的 `refreshThreadDisplaySnapshot()` 已只缓存 `threadDisplaySnapshot`；旧 `threadMessages` 展示 bridge 已在阶段 9 后复审中删除。
- `scripts/smoke-desktop-session-state.mjs` 已覆盖短 snapshot 不丢 display items、同 ID 新字段仍可更新、换线程不会泄漏旧 snapshot。
- [CCR 历史恢复与实时展示统一协议](../architecture/realtime-history-display-contract.md) 已在阶段 6 同步到当时真实协议字段，并把 rich projection 迁移拆成阶段 7；阶段 7 的完成状态见下文。
- 阶段 6 没有硬搬工具卡 / 文件卡 rich projection：当时 Renderer 逻辑牵涉 `ToolSnapshot`、`FileToolSnapshot`、附件快照、错误快照、内部 plan 隐藏规则；后续阶段 7 已通过 shared projector 收口。
- 自动验证通过：
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run smoke:desktop-session-state`
  - `npm.cmd run typecheck`
  - `npm.cmd run smoke:app-server`
  - `npm.cmd run smoke:desktop-display-events`
  - `npm.cmd run build`
  - `npm.cmd run desktop:build`
  - `git diff --check`
- 真实 Desktop 手工回归本轮未启动：当前用户正在使用 CCR 桌面主入口，为避免打开第二个可见窗口或影响当前会话，本轮只做非交互构建与 smoke。可执行入口仍是 `npm.cmd run desktop:dev` 后手工检查历史恢复、实时流式、工具卡、权限卡、刷新恢复。
- 阶段 6 当时的复审结论：阶段 6 的目标是“修复短 snapshot 覆盖、同步文档、补验证、明确未迁完边界”，这一轮已完成；当时剩余大项是阶段 7 的 rich projection 完整接管，以及真实 Desktop 手工回归。阶段 7 后续已完成，真实 UI 手工回归仍作为独立后续收口项。

验收：

- `thread/messages/list` 返回短 snapshot 时，Desktop 状态不会丢掉已有更完整 snapshot。
- 文档里的 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 字段与 `src/app-server/protocol.ts` 对齐。
- todo 和 architecture 文档不再把未完成的 rich projection / 手工回归说成已完成。
- 自动验证至少覆盖 snapshot merge 保护；真实 Desktop 回归若未执行，必须保留明确风险说明。

## 阶段 7：Rich Projection 接管专项

目标：把工具卡、文件卡、附件、错误快照和内部隐藏规则从 Renderer adapter 迁到 App Server / shared projector，让 Renderer 真正只做渲染和局部 UI 状态。

任务：

- [x] 抽出 shared display projector，覆盖工具卡、文件卡、附件、错误快照、TodoWrite 和内部 plan draft 隐藏规则。
- [x] 在 App Server `ThreadDisplayItem` 上输出稳定 rich projection，而不是只输出 raw `content` 加 `type`。
- [x] Renderer `notificationRouter.ts` / `displayEvents.ts` 优先消费 App Server rich projection；旧 `normalizeContentBlocks(item.content)` 只作为兼容 fallback。
- [x] 为工具卡、文件卡、附件、错误卡、内部 plan draft 隐藏规则分别补 snapshot/patch 一致性 smoke。
- [x] 执行自动验证和 packaged Desktop App Server 回归；为避免影响当前主入口，本轮采用独立 packaged smoke 验证打包产物 App Server 可启动，真实 UI 手工回归作为独立后续收口项。

完成记录：

- 新增 `src/display/threadDisplayProjection.ts`，作为 App Server / shared display projector；第一版输出 `projection.version = 1` 和 `projection.event`。
- `projection.event` 覆盖用户消息、TodoWrite、工具调用、工具结果、文件工具快照、附件快照、引用快照、错误快照、内部 plan draft 隐藏规则和 normalized content blocks。
- `src/app-server/protocol.ts` 的 `ThreadDisplayItem` 新增 `projection?: ThreadDisplayProjection`。
- `src/app-server/threadDisplay.ts` 在历史 snapshot item、实时 patch append item、completed item 上统一调用 `projectThreadDisplayItem(...)`；projection 的 `timelineHidden` 会同步回 item。
- `apps/desktop/src/renderer/src/domain/displayEvents.ts` 新增 `createDisplayEventFromThreadDisplayProjection(...)`，阶段 7 当时 completed item 主路径先读 `projection`；后续阶段 8 已删除缺失 projection 的 raw fallback。
- `apps/desktop/src/renderer/src/app/notificationRouter.ts` 的 snapshot / patch 主路径先读 `projection`；有 projection 的 completed item 不再按 raw `content` 预拆分，避免多块 raw content 把 projection 卡片拆散或重复。
- `scripts/smoke-app-server.mjs` 已断言历史 snapshot user item 带 projection content blocks、实时 failure patch item 带 App Server error projection。
- `scripts/smoke-desktop-session-state.mjs` 已断言实时 patch 和历史 snapshot 都优先使用 projection 里的 Write/README 文件卡，即使 raw content 故意写成 Read/SHOULD_NOT_BE_USED；同时覆盖多块 raw content 不会绕开 projection-first 路径。
- 打包产物验证通过：`release/desktop/win-unpacked/CCR.exe` 可用 `ELECTRON_RUN_AS_NODE=1` 启动 packaged app-server，并完成 initialize / shutdown。
- 自动验证通过：
  - `npm.cmd run typecheck`
  - `npm.cmd run typecheck:desktop`
  - `npm.cmd run smoke:desktop-session-state`
  - `npm.cmd run build`
  - `npm.cmd run smoke:app-server`
  - `npm.cmd run smoke:desktop-display-events`
  - `npm.cmd run desktop:build`
  - `npm.cmd run desktop:pack`
  - `npm.cmd run smoke:desktop-packaged`
  - `git diff --check`

验收：

- App Server 生成的 snapshot / patch item 带 `projection` 字段，包含工具/文件/附件/错误等 UI 需要的 rich 结构。
- Renderer 主路径遇到 `projection` 时不再解析 raw `content` 来生成工具卡/文件卡。
- 阶段 7 当时旧 raw fallback 只服务旧消息或兼容输入；后续阶段 8 已进一步清理为缺失 / 非法 projection 展示协议错误卡。
- smoke 覆盖历史 snapshot 与实时 patch 两条路径的一致性。

## 阶段 8：兼容路径清理与 projection 校验

目标：在真实 Desktop UI 回归和最终文档收口前，先把阶段 7 后剩下的四条兼容尾巴做成明确代码状态：旧 `messages` replay fallback 不再参与 Desktop 展示主链路，旧实时展示通知不再下发，缺失 `projection` 的 snapshot / patch item 不再被 raw content 解释，`projection` 有运行时校验。

任务：

- [x] 清理旧 `messages` replay fallback：`ThreadResumeResult` / `ThreadMessagesListResult` 的 `displaySnapshot` 改为必选，Renderer 不再从 `threadMessages` 构造历史展示动作。
- [x] 清理旧实时展示通知：App Server 不再下发旧 `item/*` / `permission/*` / `context/compacted` / `turn/failed` 展示通知；Renderer 去掉 `displayPatchEnabledRef` 旧展示过滤分支。
- [x] 清理 raw content fallback：snapshot / patch item 缺失或携带非法 `projection` 时不再走 `normalizeContentBlocks(item.content)` 生成工具卡 / 文件卡，而是作为协议错误展示。
- [x] 增加 projection 运行时校验：App Server 生成 projection 后校验，Renderer 消费 projection 前校验，smoke 覆盖缺失和非法 projection。

完成记录：

- `src/app-server/protocol.ts` 将 `ThreadResumeResult.displaySnapshot`、`ThreadMessagesListResult.displaySnapshot` 改为必选。
- `apps/desktop/src/renderer/src/main.tsx` 删除旧 `createHistoryReplayActions(...)`、旧 replay 计数 fallback 和 `displayPatchEnabledRef` 过滤分支。
- `src/app-server/coreEventMapper.ts` 对旧展示事件返回 `null`；`src/app-server/router.ts` 只发送 `thread/display/patch` 和必要生命周期通知。
- `apps/desktop/src/main/index.ts` 从 `thread/display/patch` 接管权限 pending / cancel 与 turn failed 状态。
- `src/display/threadDisplayProjectionSchema.ts` 新增 projection 运行时校验；App Server 生成 projection 后校验，Renderer 消费前校验。
- `apps/desktop/src/renderer/src/app/notificationRouter.ts` 与 `apps/desktop/src/renderer/src/domain/displayEvents.ts` 对缺失 / 非法 projection 生成协议错误卡，不再 raw fallback 生成工具卡 / 文件卡。
- smoke 已覆盖旧展示通知不再下发、权限 patch、失败 patch、缺失 / 非法 projection 错误卡、旧 `messages` replay fallback 清理。
- 复审补齐空快照和切换边界：`apps/desktop/src/renderer/src/main.tsx` 收到空 `threadDisplaySnapshot` 时也执行 `reset-session`，避免恢复空会话或新会话时残留旧卡片；`apps/desktop/src/main/index.ts` 仅在新线程或真实跨工作区时清理线程展示状态，避免同工作区刷新误清当前会话。
- `scripts/smoke-desktop-session-state.mjs` 增加护栏，防止后续把状态恢复误改回“只有 replay actions 非空才清屏”。
- 2026-05-24 追加计数拆分：`ThreadDisplayCounts` 新增 `projectedDisplayItems`、`hiddenDisplayItems`、`filteredTranscriptEvents`，`hiddenTimelineItems` 退为兼容聚合值；这些数量只用于调试和诊断，Desktop 普通恢复提示不再报数。

验收：

- `createStatusReplayActions()` / `createResumeReplayActions()` 不再调用旧 `createHistoryReplayActions(...)`。
- `createAppServerContext(...)` 不再把同一个 Core event 同时转换成 display patch 和旧展示 notification。
- snapshot / patch item 缺失 `projection` 时，Desktop 出现协议错误卡，不再解析 raw content。
- 自动验证通过后再进入真实 Desktop UI 回归。

## 阶段 9：当前上下文物化修复

目标：把历史恢复从“选链”改成“重放状态”。Core resume、App Server `thread/resume`、App Server `thread/messages/list` 必须共享同一套当前上下文物化结果，恢复时重放 compact / snip / sidechain 语义，压缩后切换会话再切回来上下文不能回到压缩前。

正式 Goal 文档：

1. [STD-HISTORY-09-1 会话物化源码入口核对](../goals/2026-05-24-std-history-09-1-source-entry-audit.md)
2. [STD-HISTORY-09-2 MaterializedConversation 物化协议定型](../goals/2026-05-24-std-history-09-2-materialized-conversation-contract.md)
3. [STD-HISTORY-09-3 compact / snip / preservedSegment 语义统一](../goals/2026-05-24-std-history-09-3-compact-snip-preserved-segment.md)
4. [STD-HISTORY-09-4 Core resume 只消费物化结果](../goals/2026-05-24-std-history-09-4-core-resume-materialized-context.md)
5. [STD-HISTORY-09-5 App Server 恢复展示消费同一物化结果](../goals/2026-05-24-std-history-09-5-app-server-display-materialized-context.md)
6. [STD-HISTORY-09-6 异常只诊断不伪装成功](../goals/2026-05-24-std-history-09-6-diagnostics-not-fallback.md)
7. [STD-HISTORY-09-7 缓存和持久化顺序闭环](../goals/2026-05-24-std-history-09-7-cache-and-persistence-order.md)
8. [STD-HISTORY-09-8 自动验证覆盖关键路径](../goals/2026-05-24-std-history-09-8-smoke-coverage.md)
9. [STD-HISTORY-09-9 文档和后续回归收口](../goals/2026-05-24-std-history-09-9-doc-closeout.md)

任务：

- [x] 源码核对先行：确认 `loadMessagesFromJsonlPath(...)`、`loadFullLog(...)`、`loadThreadResumeReplayPayload(...)`、`applyPreservedSegmentRelinks(...)`、App Server display snapshot 构建路径的真实代码现状；先定位“最长链优先”和 compact boundary 问题具体位置，再动实现。
- [x] 新增或收敛共享物化入口，例如 `materializeConversationFromTranscript(...)`。
- [x] 明确 `MaterializedConversation` 输出：物化后的 Core messages、canonical leaf、diagnostics、计数信息必须来自同一次物化结果。
- [x] 修复 Core 当前模型上下文的 compact boundary 恢复语义：没有 `preservedSegment` 的普通 compact，小文件完整读取路径也必须从 currentContext 裁掉 boundary 前旧消息。
- [x] 保留 live `preservedSegment` relink 能力；stale / malformed segment 必须记录 diagnostic，不能静默加载完整旧上下文。
- [x] 保留 `snip` 恢复语义：`applySnipRemovals(...)` 的删除和 relink 规则必须继续生效，compact 修复不能让 snip 删除过的中间消息重新出现在当前上下文。
- [x] 保留 transcript 非聊天元数据：summary、custom title、tag、mode、agent setting、file history snapshot、attribution snapshot、content replacement、context collapse metadata 等读取路径不能被物化层误删；如果不进入 `MaterializedConversation.messages`，也必须通过明确字段或原有 maps 继续传给需要的调用方。
- [x] 物化后再计算 main terminal / canonical leaf；sidechain 不参与主线 parent / child 集合。
- [x] Core `loadMessagesFromJsonlPath(...)` / resume 改为使用共享物化结果，删除正常路径里的 `tipChainLength` / 最长链优先。
- [x] App Server `loadThreadResumeReplayPayload(...)` / snapshot 改为使用共享物化结果，不再 `keepAllLeaves: true` 后独立选最长链。
- [x] `loadFullLog(...)` 等历史列表懒加载路径同步物化语义，避免侧栏 / 恢复 / Core 三处口径不一致。
- [x] 多 main leaf 只作为异常诊断，不作为普通恢复 fallback。
- [x] 明确 App Server fallback 边界：只有缺少 transcriptPath 且 Core 当前消息就是事实源时，才允许用 Core 当前消息生成 snapshot；读取失败、物化失败、多个 main leaf、malformed preserved segment 不能伪装成普通恢复成功。
- [x] 核对 compact 成功持久化顺序：`context_compacted` / 成功卡片只能在 compact boundary 和压缩后消息已经进入持久事实源后发出；切换会话、刷新、重启后 `context/status` 和 `displaySnapshot` 必须来自同一压缩后事实源。
- [x] 核对缓存一致性：`getSessionMessages.cache`、线程内存消息、历史列表懒加载和 App Server snapshot 不能在压缩 / 物化后继续引用 compact 前旧 message set。
- [x] 补 smoke：
  - 普通 compact 小 transcript 恢复后的 currentContext 不包含 boundary 前旧消息；UI 历史不应用这个断言。
  - 大文件 `readTranscriptForLoad(...)` 路径和小文件路径语义一致。
  - live `preservedSegment` 被保留并 relink。
  - malformed / stale `preservedSegment` 只产生 diagnostic 或明确失败，不加载完整旧上下文。
  - snip 删除过的中间消息恢复后仍不出现，且后续 survivor parentUuid 已 relink。
  - sidechain terminal 不抢主线 leaf。
  - 多 main leaf 只输出 diagnostic，不进入“谁最长选谁”的普通恢复 fallback。
  - Core `context/status` 与 App Server `displaySnapshot.counts.coreContextMessages` 一致。
  - 端到端验证：压缩后切到别的会话再切回，Core context 和 App Server snapshot 都不能回到压缩前。
- [x] 验证和文档收口：跑 typecheck / build / 相关 smoke，同步 todo 与 architecture 文档，把已完成、未完成、后续清理写清楚；真实 Desktop UI 回归放在物化修复之后，不和本阶段实现混在一起。

验收：

- 压缩成功后上下文大小下降，切到其他会话再切回仍保持压缩后的上下文。
- 普通恢复不再使用“最长链优先”作为正常策略。
- App Server replay 与 Core resume 不再各自独立读取 transcript 选 leaf。
- Renderer 仍只消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`，不解释 compact / parentUuid / sidechain。

## 风险与护栏

### 风险 1：协议和现有 UI 状态双轨过久

如果 snapshot / patch 引入后仍长期让 Renderer 同时消费旧 raw replay actions，会继续出现数量和展示不一致。

处理：

- 过渡期只允许 App Server 兼容接口继续返回旧 `messages` 字段；Desktop main / Renderer 展示主路径不得缓存或消费旧 raw replay actions。
- 新功能必须只走 display snapshot / patch。
- 旧入口迁移完后再删非主路径兼容代码；不得为旧异常 transcript 保留会影响正常恢复语义的兜底。

### 风险 2：实时 patch 没有落回 transcript

实时看到了，但刷新后没了，说明 completed item 没有进入持久化事实源，或历史 builder 不认识它。

处理：

- 每新增一种实时 item，都必须补“从 transcript 重建”的测试。
- patch mapper 和 snapshot builder 共享 item 归一化函数。

### 风险 3：误改 Claude Code 基线语义

历史恢复问题容易诱导去改 `parentUuid`、`sidechain`、branch/fork 语义。

处理：

- 默认只改 CCR App Server / Desktop 适配层。
- 触碰共享基线前必须先写评估并征求用户确认。
- 原始 Claude Code 源码暂时不瞎改。

### 风险 4：计数仍然混口径

如果 UI 继续只显示“历史事件数”，用户仍然无法理解实际看到几条。

处理：

- 普通恢复成功提示不显示数量；必须展示数量的诊断文案才使用 visible timeline items。
- 调试区才展示 raw transcript events。
- Core context messages 只用于恢复和上下文诊断。

## 下一步建议

阶段 9 当前上下文物化修复和 STD-HISTORY-10 展示协议收口已经完成自动验证和真实 Desktop 回归。后续不要重新引入旧语义；新增能力前先核对：

1. Core 当前模型上下文和 UI 可见历史是否仍是同源双投影。
2. 实时 patch 完成后是否能从 transcript 重新构建同样的可见 timeline。
3. 工具结果是否仍按来源 ID 回填对应工具展示项。
4. Renderer 是否仍只消费合法 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` projection。
5. 是否触碰了原始 Claude Code transcript / CLI/TUI 语义；如触碰，必须先单独评估并征求用户确认。

## 后续记录（追加）

- 2026-05-23：完成阶段 3-5 第一版。App Server 补齐 `thread/display/patch`、`thread/messages/list.displaySnapshot`、文件变更 item 类型；Desktop Renderer 优先消费 snapshot / patch，并过滤旧展示通知；补齐 App Server 和 Desktop session smoke。Composer optimistic user 明确为本地临时展示态，不进入 App Server 持久事实源。
- 2026-05-23：完成阶段 8。旧 `messages` replay fallback、旧实时展示通知和缺失 projection raw fallback 已清理；projection 已补运行时校验。自动验证通过：`npm.cmd run typecheck`、`npm.cmd run typecheck:desktop`、`npm.cmd run build`、`npm.cmd run smoke:desktop-session-state`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:app-server-client`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run desktop:build`、`git diff --check`。
- 2026-05-23：阶段 8 复审补项完成。补齐空 `ThreadDisplaySnapshot` 也必须清屏、线程切换必须清旧展示状态、同工作区刷新不能误清当前会话三条边界，并已重新通过自动验证与 todo gate。
- 2026-05-24：按“界面可见会话记录”和“全部会话记录”复核结论完成计数拆分。新增 `projectedDisplayItems`、`hiddenDisplayItems`、`filteredTranscriptEvents`；随后根据真机反馈取消普通恢复提示里的数量展示，只保留“历史上下文已加载，可继续对话”，计数留给调试和诊断。
- 2026-05-24：按“以后不乱”的目标补齐 parent 链路定向 smoke。新增 `smoke:core-session-parent-chain`，验证恢复正常 transcript 后继续写入时，新 user/assistant 会接回 canonical leaf，避免后续恢复写入再次制造断链。
- 2026-05-24：根据 Codex / OpenClaw 源码复核和 CCR 压缩恢复问题，新增阶段 9“当前上下文物化修复”。后续恢复从“选链”改为“重放状态”，不再把“最长链优先”作为正常恢复策略。
- 2026-05-24：完成 Goal 1 源码入口核对。已确认 Core `loadMessagesFromJsonlPath(...)`、App Server `loadThreadResumeReplayPayload(...)`、history `getLastSessionLog(...)` / `loadAllLogsFromSessionFile(...)` 仍存在最长链或最新 leaf 选择；`applyPreservedSegmentRelinks(...)` 的无 `preservedSegment` / malformed segment 分支是 compact 恢复关键风险；下一步进入 Goal 2 物化协议定型。
- 2026-05-24：完成 Goal 2 物化协议定型。新增 `src/utils/conversationMaterialization.ts`，提供 `MaterializedConversation`、统一物化入口、诊断字段、计数字段和 metadata 保留边界；主线 leaf 改为物化后唯一性校验，多个主线 leaf 只作为异常诊断，不再在协议层保留“最长链优先”兜底。
- 2026-05-24：完成 Goal 3 compact / snip / preservedSegment 语义统一。物化层已处理普通 compact 小/大 transcript、live / stale / malformed `preservedSegment`、snip 删除和 relink、sidechain 排除；新增 `smoke:conversation-materialization` 覆盖这些边界，下一步替换 Core resume 正常路径的独立选链逻辑。
- 2026-05-24：完成 Goal 4 Core resume 接入。`loadMessagesFromJsonlPath(...)` 和 `loadConversationForResume(...)` 已消费共享物化结果；Core 正常恢复路径不再出现 `tipChainLength` / 最长链选择。`smoke:core-session-parent-chain` 已扩展为 compact 恢复场景，验证旧消息仍在磁盘但不会回流到 Core 当前上下文，新 turn 接到 canonical leaf。
- 2026-05-24：完成 Goal 5 App Server 恢复展示接入。`loadThreadResumeReplayPayload(...)` 不再独立选最长 leaf，并从物化结果读取 raw counts、canonical leaf 和 diagnostics；`loadFullLog(...)` 不再最长链兜底，普通 compact / malformed segment 的底层读取语义同步收紧。阶段 9 后复审已修正该目标的展示边界：`thread/resume` snapshot 使用 transcript display replay，Core 当前消息只作为继续对话上下文和 `coreContextMessages` 计数来源。
- 2026-05-24：完成 Goal 6 异常边界收紧。多个主线 leaf / 无主线 leaf 返回物化错误和 diagnostic，不输出普通恢复 messages；App Server 读取失败或物化失败只标记为“仅展示 Core 当前消息”，不再伪装成 transcript 正常恢复。
- 2026-05-24：完成 Goal 7 cache / persistence 顺序闭环。`persistThreadMessages(...)` 改为返回是否写稳；手动 compact 只有持久化成功后才发 `context_compacted`，失败会恢复 compact 前内存并抛 `compact_failed`；流式 compact boundary 也只有持久化成功后才裁剪内存和发成功事件。
- 2026-05-24：完成 Goal 8 smoke 覆盖补齐。新增 `smoke:conversation-materialization`，扩展 `smoke:core-session-parent-chain`、`smoke:app-server` 和 `smoke:app-server-context`，覆盖 compact 小/大 transcript、live/stale/malformed preservedSegment、snip、sidechain、多 main leaf、Core/App Server 同源展示和 context 状态。
- 2026-05-24：完成 Goal 9 文档和后续回归收口。同步 architecture 文档、transcript 语义文档和源码证据索引，明确阶段 9 已完成自动验证与物化修复；真实 Desktop UI 手工回归和发布说明作为后续独立项。
- 2026-05-24：阶段 9 后复审修正。发现物化器主线 leaf 计算不应被 sidechain 子任务或 terminal system 子节点干扰；已改为从非 sidechain terminal 回溯最近主线 user/assistant，并排除仍有主线 conversation 子节点的中间消息。`smoke:conversation-materialization` 新增 sidechain child 和 terminal system child 覆盖。
- 2026-05-24：阶段 9 后复审继续清理旧 Desktop `threadMessages` 展示 bridge。Desktop main 移除 `status.threadMessages`，`refreshThreadDisplaySnapshot()` 只缓存 `ThreadDisplaySnapshot`，`mergeThreadDisplaySnapshot()` 不再接收 `mergedMessages`；`smoke:desktop-session-state` 增加断言防止旧 bridge 回流。
- 2026-05-24：阶段 9 后复审完成 App Server 可见历史 display projection 与 Core 当前模型上下文拆分。`thread/resume` / `ThreadDisplaySnapshot` 从 transcript display replay 展示 compact 前后可见历史；`thread/messages/list` 保持 Core 当前模型上下文语义。自动验证通过：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`npm.cmd run smoke:core-session-parent-chain`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:desktop-session-state`、`npm.cmd run smoke:desktop-display-events`、`git diff --check`。
- 2026-05-24：STD-HISTORY-10 完成并行工具结果来源绑定和 Desktop 主展示路径收口。历史 snapshot 改为内容块级归并，一个 `tool_use` 一个工具展示项，`tool_result` 按来源 ID 回填；Renderer 主路径缺 projection 只展示协议错误卡，不再 raw fallback。真实 CCR DEV 已覆盖普通问答、多工具、工具失败、权限拒绝、手动 compact、压缩后继续、历史恢复、刷新 / 重启恢复。验证通过 `npm.cmd run typecheck`、`npm.cmd run smoke:desktop-session-state`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:conversation-materialization`、`npm.cmd run build`、`git diff --check`。
