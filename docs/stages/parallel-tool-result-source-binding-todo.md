# 并行工具结果来源绑定 Todo

本文是 [并行工具结果来源绑定修改计划](./parallel-tool-result-source-binding-plan.md) 的执行 todo。计划文档负责讲清楚设计原因和不变式；本文只作为后续实现、验收、恢复接续的权威任务列表。

## 目标仓库

`D:\agent_project\claude-code-reforged`

## 权威输入

- [并行工具结果来源绑定修改计划](./parallel-tool-result-source-binding-plan.md)
- [CCR 历史恢复与实时展示统一协议](../architecture/realtime-history-display-contract.md)
- [会话上下文物化修复说明](../architecture/session-context-materialization-repair.md)
- [Codex / OpenClaw 实时与历史恢复源码证据索引](../references/codex-openclaw-live-history-source-evidence.md)
- [历史恢复与实时展示统一协议实施计划](./realtime-history-display-contract-todo.md)

## Goal 文档索引

- [STD-HISTORY-10-1 有序 transcript 视图](../goals/2026-05-24-std-history-10-1-ordered-transcript-view.md)
- [STD-HISTORY-10-2 当前模型上下文与可见历史双投影](../goals/2026-05-24-std-history-10-2-context-display-dual-projection.md)
- [STD-HISTORY-10-3 工具来源 ID 绑定归并器](../goals/2026-05-24-std-history-10-3-tool-source-binding-reducer.md)
- [STD-HISTORY-10-4 历史快照内容块级归并](../goals/2026-05-24-std-history-10-4-history-block-level-snapshot.md)
- [STD-HISTORY-10-5 展示投影单展示项单主语义](../goals/2026-05-24-std-history-10-5-display-projection-single-item.md)
- [STD-HISTORY-10-6 实时增量补丁接入工具生命周期](../goals/2026-05-24-std-history-10-6-realtime-patch-tool-lifecycle.md)
- [STD-HISTORY-10-7 Renderer 状态归并收口](../goals/2026-05-24-std-history-10-7-renderer-state-merge-cleanup.md)
- [STD-HISTORY-10-8 旧兼容路径清理](../goals/2026-05-24-std-history-10-8-legacy-compat-cleanup.md)
- [STD-HISTORY-10-9 并行工具冒烟覆盖](../goals/2026-05-24-std-history-10-9-parallel-tool-smoke-coverage.md)
- [STD-HISTORY-10-10 真实桌面端手工回归](../goals/2026-05-24-std-history-10-10-desktop-manual-regression.md)
- [STD-HISTORY-10-11 文档规则发布说明收口](../goals/2026-05-24-std-history-10-11-doc-rules-release-closeout.md)

## 当前任务列表（实时）

- [x] [Goal 1：显式保留 transcript 物理顺序。](../goals/2026-05-24-std-history-10-1-ordered-transcript-view.md)
- [x] [Goal 2：物化层拆分当前模型上下文和可见历史。](../goals/2026-05-24-std-history-10-2-context-display-dual-projection.md)
- [x] [Goal 3：工具调用和工具结果按来源 ID 绑定。](../goals/2026-05-24-std-history-10-3-tool-source-binding-reducer.md)
- [x] [Goal 4：历史展示从消息级映射改为内容块级归并器。](../goals/2026-05-24-std-history-10-4-history-block-level-snapshot.md)
- [x] [Goal 5：展示投影保持一条展示项一个主语义。](../goals/2026-05-24-std-history-10-5-display-projection-single-item.md)
- [x] [Goal 6：实时增量补丁使用同一套工具生命周期语义。](../goals/2026-05-24-std-history-10-6-realtime-patch-tool-lifecycle.md)
- [x] [Goal 7：Renderer 状态归并和清理收口。](../goals/2026-05-24-std-history-10-7-renderer-state-merge-cleanup.md)
- [x] [Goal 8：旧兼容路径清理。](../goals/2026-05-24-std-history-10-8-legacy-compat-cleanup.md)
- [x] [Goal 9：冒烟测试覆盖并行工具和异常边界。](../goals/2026-05-24-std-history-10-9-parallel-tool-smoke-coverage.md)
- [x] [Goal 10：真实桌面端手工回归。](../goals/2026-05-24-std-history-10-10-desktop-manual-regression.md)
- [x] [Goal 11：文档、规则和发布说明收口。](../goals/2026-05-24-std-history-10-11-doc-rules-release-closeout.md)

## 当前指针

- 当前进行中：[Goal 11：文档、规则和发布说明收口。](../goals/2026-05-24-std-history-10-11-doc-rules-release-closeout.md)
- 当前正在做：全部当前任务列表已完成。
- 完成后下一项：本专项完成；后续新增恢复 / 展示能力时，先从 [CCR 历史恢复与实时展示统一协议实施计划](./realtime-history-display-contract-todo.md) 重新开 goal。

## 执行约束

1. 不修改原始 Claude Code transcript 存储语义；如确实需要触碰共享基线，必须先单独评估并征求用户确认。
2. 不恢复“最长链优先”兜底。多个 main leaf 是异常诊断，不是普通恢复策略。
3. `tool_result` 不参与 leaf 竞争，只能通过来源 ID 回填对应工具展示项。
4. 协议层必须保持一工具调用一工具展示项；Renderer 可以视觉归组，但不能改变协议语义。
5. Core 当前模型上下文和 UI 可见历史是两个投影。compact 只缩短当前模型上下文，不裁掉 UI 可见历史。
6. 历史快照和实时增量补丁必须使用同一套工具生命周期归并语义。
7. Renderer 主路径只消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`，不得重新解释 transcript 或 raw tool event。
8. 缺失 projection、缺来源 ID、孤立 tool result 只能进入诊断卡，不得伪装成正常展示项。
9. 每个 goal 完成后必须回写本文档：勾选状态、当前指针、后续记录。
10. 任何通过 `cli.js`、`dist`、Electron main 或打包入口执行的 smoke，必须先确认构建产物已同步，避免继续跑旧 `dist`。

## Goal 1：显式保留 transcript 物理顺序

目标：让物化层知道每条 transcript message 来自第几条 JSONL 记录。

任务：

- [x] 核对现有 transcript 读取入口：`sessionStorage.ts`、`loadTranscriptFile(...)`、`loadMessagesFromJsonlPath(...)`、`loadFullLog(...)`。
- [x] 新增或改造有序 transcript 视图，生成稳定 `rawIndex`。
- [x] 确保 `rawIndex` 不写回原始 transcript。
- [x] 确保 malformed JSONL 行只进入诊断，不破坏有效 entry 的来源位置。
- [x] 将有序 transcript 视图接入 `conversationMaterialization.ts`。

验收：

- [x] 同一个 transcript 重复读取，`rawIndex` 稳定。
- [x] compact / snip / preservedSegment 后仍能诊断原始来源位置。
- [x] malformed JSONL 行跳过数量可诊断。

## Goal 2：物化层拆分当前模型上下文和可见历史

目标：同一个 transcript 解释层输出两个投影。

任务：

- [x] 让 `conversationMaterialization.ts` 显式输出 `currentContextMessages`。
- [x] 让 `conversationMaterialization.ts` 显式输出 `displayReplayEvents` 或等价展示事件。
- [x] 保留并标注兼容 `messages` 字段语义，避免再被误认为完整 UI 历史。
- [x] compact / snip / sidechain 只影响当前模型上下文，不裁掉可见历史回放。
- [x] 多 main leaf 输出诊断，不静默选最长。

验收：

- [x] compact 后 Core context 变短。
- [x] compact 后 UI 历史仍可展示压缩前可见内容。
- [x] `thread/resume` 不再把 Core 当前上下文当完整 UI 历史。

## Goal 3：工具调用和工具结果按来源 ID 绑定

目标：把工具生命周期从消息 uuid / 返回顺序切到工具调用 ID。

任务：

- [x] 实现 `tool_use.id` / `toolUseId` / `tool_use_id` 等工具调用 ID 归一化。
- [x] 实现 `tool_result.tool_use_id` / `toolCallId` / `tool_call_id` 等结果来源 ID 归一化。
- [x] 新增工具生命周期归并器：tool_use 创建或更新工具展示项，tool_result 回填对应展示项。
- [x] 支持同一 assistant message 内多个 `tool_use`。
- [x] 支持同一 user message 内多个 `tool_result`。
- [x] 支持 `tool_result` 返回顺序和 `tool_use` 顺序不同。
- [x] 缺来源或来源不存在时生成孤立工具结果诊断项。

验收：

- [x] `tool_result B` 先回来、`tool_result A` 后回来时，B / A 分别回填正确工具项。
- [x] 工具展示顺序仍按 `tool_use A`、`tool_use B` 首次出现顺序。
- [x] 同一工具调用不会生成两张卡。

## Goal 4：历史展示从消息级映射改为内容块级归并器

目标：一个 transcript message 可以生成多个展示项。

任务：

- [x] 审查 `src/app-server/threadDisplay.ts` 当前 `messages.map(...)` 展示生成路径。
- [x] 将历史快照构建改成内容块级归并。
- [x] 文本内容生成 user / assistant message 展示项。
- [x] 每个 `tool_use` 生成或更新一个工具展示项。
- [x] 每个 `tool_result` 按来源 ID 回填工具展示项。
- [x] compact boundary 生成轻量系统提示卡，不替代 UI 历史。
- [x] 为工具展示项生成稳定 ID：`tool:${toolUseId}`。
- [x] 为孤立工具结果生成稳定诊断 ID：`orphan-tool-result:${messageUuid}:${contentIndex}`。

验收：

- [x] 一个 assistant message 内多个 `tool_use` 能生成多个工具展示项。
- [x] `ThreadDisplayItem.identity` 能表达 `toolUseId`、`messageUuid`、`rawIndex`、`contentIndex`。
- [x] 历史 snapshot 与实时完成后的最终展示项数量一致。

## Goal 5：展示投影保持一条展示项一个主语义

目标：不要让展示投影层在一条展示项里猜多个工具块。

任务：

- [x] 审查 `src/display/threadDisplayProjection.ts` 的工具块提取逻辑。
- [x] App Server 在进入展示投影前先拆成单语义展示项。
- [x] 展示投影继续处理一条展示项的一个主语义。
- [x] TodoWrite 专用展示投影以单个 `toolUseId` 为主键。
- [x] 展示投影 schema 校验 `identity.toolUseId`、`identity.contentIndex`、`identity.rawIndex`。

验收：

- [x] 展示投影不会因为只看第一个 block 而丢第二个工具。
- [x] 缺展示投影仍生成协议错误卡，不回退 raw 解析。
- [x] 一个展示投影事件只对应一个主展示语义。

## Goal 6：实时增量补丁使用同一套工具生命周期语义

目标：历史恢复和实时展示行为一致。

任务：

- [x] `thread/display/patch` 的 append / update / complete 使用同一 `toolUseId` 和 itemId。
- [x] 实时工具开始时 append 工具展示项。
- [x] 实时工具结果回来时 update / complete 同一工具展示项。
- [x] 实时结果先于调用到达时进入 pending-orphan 诊断状态。
- [x] permission request / cancelled / turn failed / compacted 全部通过展示增量补丁进入同一归并器。
- [x] 确认旧 `item/*`、`permission/*`、`context/compacted`、`turn/failed` 展示通知没有绕过主路径。

验收：

- [x] 页面刷新前后工具卡数量、顺序、状态一致。
- [x] 实时和历史都不会出现同一个工具调用两张卡。
- [x] 旧实时通知不会绕过展示增量补丁直接进入 Renderer。

## Goal 7：Renderer 状态归并和清理收口

目标：Renderer 只消费 App Server 展示协议，不再自行合并工具来源。

任务：

- [x] `sessionState.ts` 只按 `ThreadDisplayPatch` / `ThreadDisplaySnapshot` 归并 timeline。
- [x] `ChatTimeline` 不根据 raw content 自己拆 tool blocks。
- [x] 工具卡、权限卡、文件卡、TodoWrite 浮层只消费展示投影。
- [x] snapshot 切换、工作区切换、线程切换清理旧 pending-orphan / active tool 状态。
- [x] optimistic user input 保留为本地临时态，snapshot 到达后由 App Server 事实源覆盖。

验收：

- [x] Renderer 缺展示投影时只展示协议错误卡。
- [x] 切换会话不会残留上一个会话的 running tool / pending permission。
- [x] 刷新页面后 timeline 由 snapshot 完整恢复。

## Goal 8：旧兼容路径清理

目标：删除会再次绕回旧错误语义的兼容入口。

任务：

- [x] Desktop main 不再缓存旧 `threadMessages` 作为展示状态。
- [x] `thread/messages/list` 若保留 `messages`，必须标注为兼容接口或当前上下文接口。
- [x] 清理旧 `messages` replay fallback。
- [x] 清理 raw content fallback。
- [x] 清理旧展示通知路径。
- [x] 确认源码和 `dist` 构建产物同步。

验收：

- [x] 搜索不到 Renderer 主路径消费旧 `threadMessages`。
- [x] 快照或增量补丁缺失展示投影时不会被 raw fallback 渲染成正常卡片。
- [x] `npm.cmd run build` 后 `dist` 与源码行为一致。

## Goal 9：冒烟测试覆盖并行工具和异常边界

目标：把这次问题变成可回归测试。

任务：

- [x] 补一个 assistant message 内两个 `tool_use` 的历史恢复 fixture。
- [x] 补 `tool_result B` 先于 `tool_result A` 到达的实时回放 fixture。
- [x] 补缺少 `tool_use_id` 的孤立工具结果诊断 fixture。
- [x] 补指向不存在 `tool_use` 的孤立工具结果诊断 fixture。
- [x] 补 compact 后恢复：Core context 变短、display history 不丢。
- [x] 补多 main leaf 只诊断、不走最长链。
- [x] 补实时增量补丁与历史快照最终 timeline 一致性断言。
- [x] 补 dist 入口冒烟，确认没有跑旧构建产物。

验收命令：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:app-server
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:conversation-materialization
git diff --check
```

## Goal 10：真实桌面端手工回归

目标：用真实 CCR DEV 验证用户可见体验。

任务：

- [x] 普通问答实时展示。
- [x] 一个 turn 内多个工具调用。
- [x] 多个工具结果乱序返回。
- [x] 工具执行失败。
- [x] 权限请求、拒绝、取消。
- [x] 上下文手动压缩。
- [x] 上下文自动压缩。
- [x] 压缩后继续发消息。
- [x] 切换到其他会话再切回。
- [x] 刷新页面。
- [x] 重启 CCR DEV。
- [x] 恢复历史会话。
- [x] 历史恢复后继续对话。
- [x] compact 前旧 UI 历史可见，Core context 不回到 compact 前。
- [x] 孤立工具结果显示诊断卡，不伪装成正常工具卡。

验收：

- [x] 用户可见 timeline 与实时结束状态一致。
- [x] 顶部上下文 token 显示与 Core 当前上下文一致。
- [x] 历史 UI 不因为 compact 被裁掉。
- [x] 工具结果不会重复成 assistant 普通文本。
- [x] 没有 `缺少 ThreadDisplayItem.projection` 的正常路径错误。

## Goal 11：文档、规则和发布说明收口

目标：让后续开发不会再回到旧语义。

任务：

- [x] 更新 `docs/architecture/realtime-history-display-contract.md`。
- [x] 更新 `docs/architecture/session-context-materialization-repair.md`。
- [x] 更新 `docs/references/codex-openclaw-live-history-source-evidence.md`。
- [x] 更新 `docs/stages/realtime-history-display-contract-todo.md`。
- [x] 更新项目规则：不修改原始 Claude Code transcript 存储语义、工具结果按来源 ID 回填、不新增 raw fallback 展示主路径。
- [x] 更新发布说明：Desktop 主路径不再支持旧 replay 展示协议，并说明并行工具结果乱序返回支持情况。

验收：

- [x] 架构文档、todo、goal 和 release note 口径一致。
- [x] 新增规则能被后续开发直接引用。
- [x] 没有文档仍把 compact context 当完整 UI history。

## 备注

当前状态：active

执行说明：用户已确认开始实现，按 Goal 文档顺序从 Goal 1 推进。

下一步需要：完成 Goal 7 的 Renderer 状态归并和清理收口。

## 后续记录（追加）

- 初始化：建立并行工具结果来源绑定专项 todo。当前只设计 todo，不进入实现；后续从 Goal 1 开始。
- Goal 文档设计：新增 STD-HISTORY-10-1 到 STD-HISTORY-10-11 共 11 个 goal 文档，并在本文加入 Goal 文档索引。当前仍保持 paused，尚未进入实现。
- 启动实现：用户确认开始，当前状态从 paused 切为 active，从 Goal 1 开始。
- Goal 1 完成：`loadTranscriptFile(...)` 增加只读 `orderedMessages` / `malformedJsonlLines`，`conversationMaterialization.ts` 改为消费有序 transcript 视图并输出 malformed JSONL 诊断；验证通过 `npm.cmd run typecheck`、`git diff --check`。下一步进入 Goal 2。
- Goal 2 完成：`MaterializedConversation` 显式输出 `currentContextMessages` 和 `displayReplayEvents`，兼容 `messages` 标注为当前模型上下文；`thread/resume` 改为消费同一物化结果里的展示回放，不再单独读一套 display replay。验证通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`git diff --check`。下一步进入 Goal 3。
- Goal 3 完成：新增 `src/app-server/toolDisplayLifecycle.ts`，实现工具调用 ID / 工具结果来源 ID 归一化和工具生命周期归并器；`smoke:app-server` 增加乱序结果、重复 tool_use、缺来源诊断覆盖。验证通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:app-server`、`git diff --check`。下一步进入 Goal 4。
- Goal 4 完成：`buildThreadDisplaySnapshot(...)` 从 message 级映射改成内容块级归并；包含多个工具块的历史消息会拆成独立工具展示项，工具结果按来源 ID 回填，snapshot smoke 覆盖并行工具拆分。验证通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:app-server`、`git diff --check`。下一步进入 Goal 5。
- Goal 5 完成：展示投影层保留 App Server 单语义拆分后的原始身份字段，TodoWrite / tool projection 只处理一个主语义块；工具调用投影会携带已回填结果，schema 补充 `rawIndex` / `materializedIndex` / `sourceIndex` 校验。验证通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:desktop-display-events`、`git diff --check`。下一步进入 Goal 6。
- Goal 6 完成：实时 `thread/display/patch` 的工具开始和工具结果接入同一 `ToolDisplayLifecycleReducer`；并行工具实时开始 append 独立 `tool:<id>` 项，乱序结果 complete 同一项，孤立结果进入诊断错误卡。验证通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:desktop-display-events`、`git diff --check`。下一步进入 Goal 7。
- Goal 7 完成：Renderer 协议路径只按 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 的 itemId / projection 归并，不再按 raw `toolUseId` 自行合并工具结果；`ChatTimeline` 去掉 raw toolUseId 反推；`reset-session` 清空旧 running tool / pending permission 的断言已补齐。验证通过 `npm.cmd run typecheck`、`npm.cmd run smoke:desktop-session-state`、`npm.cmd run smoke:desktop-display-events`。下一步进入 Goal 8。
- Goal 8 完成：`thread/resume` / `thread/messages/list` 的 `messages` 增加 `messagesSemantics` 标注，Desktop 主路径继续只消费 `ThreadDisplaySnapshot`；Renderer 删除无来源 ID 的 contentIndex 工具合并 fallback，旧 `threadMessages` / `item/*` 展示路径复核无回流。验证通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:desktop-session-state`、`npm.cmd run smoke:desktop-display-events`、`git diff --check`。下一步进入 Goal 9。
- Goal 9 完成：补齐历史 snapshot 中缺来源 / 指向不存在工具的孤立工具结果诊断 fixture，并新增实时 patch 最终工具项与历史 snapshot 工具项一致性断言；compact 后上下文/展示分离、多 main leaf 诊断和 dist 入口均由现有 smoke 覆盖。验证通过 `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:conversation-materialization`、`git diff --check`。下一步进入 Goal 10。
- Goal 10 完成：真实 CCR DEV 完成普通 turn、多工具卡、工具失败、手动 compact、压缩后继续、历史恢复、刷新/重启恢复和权限拒绝路径回归；补修权限响应后 Desktop main 刷新 `ThreadDisplaySnapshot` 并由 Renderer 对明确状态事件重放 snapshot，解决拒绝后仍停在“等待授权”的实时 UI 问题。验证通过 `npm.cmd run typecheck`、`npm.cmd run smoke:desktop-session-state`、`npm.cmd run smoke:desktop-display-events`、`npm.cmd run smoke:conversation-materialization`、`npm.cmd run build`、`git diff --check`。下一步进入 Goal 11。
- Goal 11 完成：同步架构协议、当前上下文物化说明、Codex/OpenClaw 源码证据索引、总实施计划、项目规则和 `CHANGELOG.md`；明确 Desktop 主路径不再支持旧 replay / raw fallback，compact context 不等于 UI history，工具结果按来源 ID 回填且不参与 leaf 竞争。验证通过 `npm.cmd run typecheck`、`git diff --check`。本专项完成。
- 2026-05-25 复核补验：STD-HISTORY-11 继续补齐恢复语义底座。并行工具结果 sibling / 乱序返回已进入 `classifiedTranscriptEvents` 和 current context tail smoke；`tool_result` 不再参与当前尾部解析，旧 parent leaf 只作为 `legacy_multiple_main_leaves_diagnostic`。新增 compact + 并行工具组合 fixture，确认 Core current context 和 UI display replay 仍是双投影。
