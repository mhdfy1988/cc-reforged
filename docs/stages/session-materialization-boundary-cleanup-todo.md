# CCR 会话物化边界收口 Todo

本文用于承接 `STD-HISTORY-11` 之后的边界收口工作。目标不是推翻前面方向，而是把已经混入原始 Claude Code 读侧的 CCR 恢复物化语义迁回第 3 层，让后续实现不再在 `sessionStorage.ts`、`loadFullLog(...)`、`loadTranscriptFile(...)` 里继续堆恢复产品语义。

## 目标仓库

`D:\agent_project\claude-code-reforged`

## 背景结论

当前会话恢复可分为五层：

1. 原始 transcript 存储层：写入 JSONL，保留 Claude Code 原始事实。
2. 原生读侧修复层：处理 preservedSegment、snip、并行工具 sibling、tool_result 补回等原生修复能力。
3. CCR 会话物化层：输出 `currentContextMessages`、`displayReplayEvents`、`currentContextTailUuid`、`diagnostics`。
4. Core / App Server 协议层：消费物化结果，提供恢复、快照和 patch。
5. Desktop Renderer 展示层：只消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`。

后续目标是：第 3 层逐步替代第 2 层的恢复主路径职责；第 2 层最终只作为 legacy helper、旧 CLI/TUI 兼容路径或诊断对照，不再承载 CCR 产品恢复语义。

## 权威输入

- [CCR 会话语义 Codex-like 适配层 Todo](./session-semantics-codex-migration-todo.md)
- [CCR 会话语义向 Codex 模型迁移方案](../architecture/session-semantics-codex-migration.md)
- [会话上下文物化修复说明](../architecture/session-context-materialization-repair.md)
- [CCR 历史恢复与实时展示统一协议](../architecture/realtime-history-display-contract.md)
- [并行工具结果来源绑定 Todo](./parallel-tool-result-source-binding-todo.md)
- 原始对照目录：`D:\agent_project\cc-haha-main`

## Goal 文档索引

- [STD-HISTORY-12-0 原始层改动清单](../goals/2026-05-25-std-history-12-0-native-layer-change-inventory.md)
- [STD-HISTORY-12-1 收回 sessionStorage ordered/rawIndex](../goals/2026-05-25-std-history-12-1-sessionstorage-ordered-rawindex-extraction.md)
- [STD-HISTORY-12-2 收回 compact 当前上下文裁剪](../goals/2026-05-25-std-history-12-2-sessionstorage-compact-prune-extraction.md)
- [STD-HISTORY-12-3 收回 loadFullLog leaf 策略](../goals/2026-05-25-std-history-12-3-loadfulllog-leaf-policy-extraction.md)
- [STD-HISTORY-12-4 conversationRecovery 边界定位](../goals/2026-05-25-std-history-12-4-conversationrecovery-boundary.md)
- [STD-HISTORY-12-5 共享层必要修改保留清单](../goals/2026-05-25-std-history-12-5-shared-layer-necessary-changes.md)
- [STD-HISTORY-12-6 原始共享层逐项审查](../goals/2026-05-25-std-history-12-6-shared-layer-file-audit.md)
- [STD-HISTORY-12-7 第 3 层直接读取 transcript](../goals/2026-05-25-std-history-12-7-materialization-direct-transcript-reader.md)
- [STD-HISTORY-12-8 buildConversationChain helper 边界](../goals/2026-05-25-std-history-12-8-buildconversationchain-helper-boundary.md)
- [STD-HISTORY-12-9 smoke 回归覆盖](../goals/2026-05-25-std-history-12-9-smoke-regression-coverage.md)
- [STD-HISTORY-12-10 文档规则和发布说明收口](../goals/2026-05-25-std-history-12-10-doc-rules-release-closeout.md)

## 当前任务列表（实时）

- [x] Goal 0：做原始层改动清单。Goal 文件：[STD-HISTORY-12-0](../goals/2026-05-25-std-history-12-0-native-layer-change-inventory.md)
- [x] Goal 1：收回 `sessionStorage.ts` 里的 ordered/rawIndex 能力。Goal 文件：[STD-HISTORY-12-1](../goals/2026-05-25-std-history-12-1-sessionstorage-ordered-rawindex-extraction.md)
- [x] Goal 2：收回 `sessionStorage.ts` 里的 compact 当前上下文裁剪。Goal 文件：[STD-HISTORY-12-2](../goals/2026-05-25-std-history-12-2-sessionstorage-compact-prune-extraction.md)
- [x] Goal 3：收回 `loadFullLog(...)` 里的 leaf 策略改动。Goal 文件：[STD-HISTORY-12-3](../goals/2026-05-25-std-history-12-3-loadfulllog-leaf-policy-extraction.md)
- [x] Goal 4：确认 `conversationRecovery.ts` 的边界定位。Goal 文件：[STD-HISTORY-12-4](../goals/2026-05-25-std-history-12-4-conversationrecovery-boundary.md)
- [x] Goal 5：保留必要共享层修改，并列明证据。Goal 文件：[STD-HISTORY-12-5](../goals/2026-05-25-std-history-12-5-shared-layer-necessary-changes.md)
- [x] Goal 6：审查 `messages.ts` / `query.ts` / `QueryEngine.ts` / `compact.ts`。Goal 文件：[STD-HISTORY-12-6](../goals/2026-05-25-std-history-12-6-shared-layer-file-audit.md)
- [x] Goal 7：让第 3 层直接读取原始 transcript。Goal 文件：[STD-HISTORY-12-7](../goals/2026-05-25-std-history-12-7-materialization-direct-transcript-reader.md)
- [x] Goal 8：短期保留 `buildConversationChain(...)` 作为 helper，但不继续增强第 2 层。Goal 文件：[STD-HISTORY-12-8](../goals/2026-05-25-std-history-12-8-buildconversationchain-helper-boundary.md)
- [x] Goal 9：补齐 smoke 回归。Goal 文件：[STD-HISTORY-12-9](../goals/2026-05-25-std-history-12-9-smoke-regression-coverage.md)
- [x] Goal 10：文档、规则和发布说明收口。Goal 文件：[STD-HISTORY-12-10](../goals/2026-05-25-std-history-12-10-doc-rules-release-closeout.md)

## 当前指针

- 当前进行中：无，当前权威任务列表已完成。
- 当前正在做：最终 gate 和人工验证准备。
- 完成后下一项：手动验证或 ordered reducer 后续迁移。

## 执行约束

1. 原始 Claude Code 层不是绝对冻结，但只能为了共享正确性修改，例如 provider/API/SDK/UUID/tool pairing/compact metadata/transcript 存储一致性。
2. 不得把 Desktop/App Server 展示诉求、历史恢复投影、临时兜底、当前 tail 解析、UI 历史裁剪语义塞进原始层。
3. 涉及 `src/utils/sessionStorage.ts`、`src/utils/messages.ts`、`src/query.ts`、`src/QueryEngine.ts`、`src/services/compact/compact.ts` 的修改，必须先说明属于“共享正确性”还是“CCR 物化语义迁出”。
4. `conversationMaterialization.ts` 应成为恢复主路径：模型上下文和 UI 历史都从它派生。
5. 第 2 层可以短期提供 helper，但不得再决定 `currentContextTail`，不得再承担 `ordered/rawIndex` 或 UI replay 职责。
6. compact 只裁当前模型上下文，不裁 UI 可见历史。
7. `tool_result` 不推进当前会话尾部，只能按 `tool_use_id` / `toolUseId` / `toolCallId` 绑定来源工具。
8. 通过 `cli.js`、`dist`、Electron main 或打包入口执行 smoke 前，必须先 build。
9. 每个 goal 完成后必须回写本文档：勾选状态、当前指针、后续记录。

## Goal 0：做原始层改动清单

Goal 文件：[STD-HISTORY-12-0 原始层改动清单](../goals/2026-05-25-std-history-12-0-native-layer-change-inventory.md)

目标：把当前仓库和 `D:\agent_project\cc-haha-main` 的会话相关差异分成三类：保留、迁出、待评估。

任务：

- [x] 对比 `src/utils/sessionStorage.ts`。
- [x] 对比 `src/utils/conversationRecovery.ts`。
- [x] 对比 `src/utils/messages.ts`。
- [x] 对比 `src/query.ts`。
- [x] 对比 `src/QueryEngine.ts`。
- [x] 对比 `src/services/compact/compact.ts`。
- [x] 输出三类清单：保留、迁出、待评估。

验收：

- [x] 每一项原始层改动都有去留判断。
- [x] 每一项保留理由都绑定共享正确性证据。
- [x] 每一项迁出项都说明目标落点。

## Goal 1：收回 `sessionStorage.ts` 里的 ordered/rawIndex 能力

Goal 文件：[STD-HISTORY-12-1 收回 sessionStorage ordered/rawIndex](../goals/2026-05-25-std-history-12-1-sessionstorage-ordered-rawindex-extraction.md)

目标：不再让 `loadTranscriptFile(...)` 暴露 CCR 物化层专用的 ordered/rawIndex 视图。

任务：

- [x] 移出 `OrderedTranscriptMessage`。
- [x] 移出 `TranscriptMalformedJsonlLine`。
- [x] 移出 `parseJSONLWithRawIndex(...)`。
- [x] 移出 `countJsonlLinesBeforeOffset(...)`。
- [x] 移出 `createOrderedTranscriptMessages(...)`。
- [x] 移出 `loadTranscriptFile(...)` 返回值里的 `orderedMessages` / `malformedJsonlLines`。
- [x] 在第 3 层补等价能力。

验收：

- [x] `sessionStorage.ts` 不再为 CCR materialization 返回 ordered/rawIndex。
- [x] `conversationMaterialization.ts` 仍能获得 ordered transcript events。
- [x] 现有恢复 smoke 不退化。

## Goal 2：收回 `sessionStorage.ts` 里的 compact 当前上下文裁剪

Goal 文件：[STD-HISTORY-12-2 收回 compact 当前上下文裁剪](../goals/2026-05-25-std-history-12-2-sessionstorage-compact-prune-extraction.md)

目标：compact 后当前模型上下文变小由第 3 层负责，不通过底层 reader 的普通 compact prune 实现。

任务：

- [x] 恢复或瘦身 `applyPreservedSegmentRelinks(...)` 中普通 compact prune 的改动。
- [x] 保留原生 preservedSegment relink 语义。
- [x] 在 `conversationMaterialization.ts` 中实现当前上下文 compact boundary 应用。
- [x] 保证 UI 历史不受 compact 裁剪影响。

验收：

- [x] compact 后 `currentContextMessages` 是压缩后的上下文。
- [x] compact 前 UI 历史仍可展示。
- [x] `sessionStorage.ts` 不再承载 CCR 当前上下文裁剪语义。

## Goal 3：收回 `loadFullLog(...)` 里的 leaf 策略改动

Goal 文件：[STD-HISTORY-12-3 收回 loadFullLog leaf 策略](../goals/2026-05-25-std-history-12-3-loadfulllog-leaf-policy-extraction.md)

目标：`loadFullLog(...)` 不再承载 CCR 的 current tail 产品语义。

任务：

- [x] 审查当前 `loadFullLog(...)` 多 main leaf 行为。
- [x] 将 current tail 解析限制在 `conversationMaterialization.ts`。
- [x] 多 leaf 仅作为 materialization diagnostic。
- [x] 明确旧 CLI/TUI 对 `loadFullLog(...)` 的兼容影响。

验收：

- [x] `currentContextTail` 只由第 3 层解析。
- [x] `loadFullLog(...)` 不输出 CCR 恢复主线选择语义。
- [x] 多 legacy leaf smoke 仍只产生诊断，不阻断普通恢复。

## Goal 4：确认 `conversationRecovery.ts` 的边界定位

Goal 文件：[STD-HISTORY-12-4 conversationRecovery 边界定位](../goals/2026-05-25-std-history-12-4-conversationrecovery-boundary.md)

目标：明确 `conversationRecovery.ts` 是 CCR 统一恢复 facade，还是应拆出 CCR 专用恢复入口。

任务：

- [x] 列出 `loadConversationForResume(...)` 调用方。
- [x] 判断 CLI/TUI/Core/App Server 是否都应走第 3 层。
- [x] 如果保留在 `conversationRecovery.ts`，文档明确它已经是 CCR fork 的统一恢复 facade。
- [x] 已判定不拆出，因此无需设计 Core/App Server 专用恢复函数。

验收：

- [x] 恢复入口边界有明确结论。
- [x] 不再出现模型恢复一套读法、UI 展示另一套读法。
- [x] 失败诊断不退回泛化的 `Session transcript not found`。

## Goal 5：保留必要共享层修改，并列明证据

Goal 文件：[STD-HISTORY-12-5 共享层必要修改保留清单](../goals/2026-05-25-std-history-12-5-shared-layer-necessary-changes.md)

目标：不要把 provider/API/SDK 正确性修改误撤。

任务：

- [x] 保留 `sourceToolAssistantUUID` UUID 校验，或说明替代方案。
- [x] 保留 compact metadata 安全读取，或说明替代方案。
- [x] 保留 SDK compact boundary 输出校验，或说明替代方案。
- [x] 保留 ESM `createRequire` 兼容，或说明替代方案。
- [x] 保留模型 API payload 正确性相关修复，或说明替代方案。

验收：

- [x] 每项保留项都有代码位置和原因。
- [x] 每项保留项都不是 UI 展示专用语义。
- [x] 不影响多 provider / SDK / CLI/TUI 基础路径。

## Goal 6：审查 `messages.ts` / `query.ts` / `QueryEngine.ts` / `compact.ts`

Goal 文件：[STD-HISTORY-12-6 原始共享层逐项审查](../goals/2026-05-25-std-history-12-6-shared-layer-file-audit.md)

目标：逐项判断这些原始共享层改动是否属于共享正确性。

任务：

- [x] 审查 `messages.ts` 的 API normalize / snip / tool_use_summary 相关改动。
- [x] 审查 `query.ts` 的 snip compact / continuation / tool_result 来源相关改动。
- [x] 审查 `QueryEngine.ts` 的 compact boundary / tool_use_summary / snip replay 相关改动。
- [x] 审查 `compact.ts` 的 metadata / preservedSegment / boundary UUID 相关改动。
- [x] 输出保留、迁出、待评估清单。

验收：

- [x] 不把 provider/API 必要修改误撤。
- [x] 不把 UI/恢复物化语义留在共享层。
- [x] 每个待评估项都有下一步验证命令或用户决策点。

## Goal 7：让第 3 层直接读取原始 transcript

Goal 文件：[STD-HISTORY-12-7 第 3 层直接读取 transcript](../goals/2026-05-25-std-history-12-7-materialization-direct-transcript-reader.md)

目标：`conversationMaterialization.ts` 自己从 JSONL 生成 ordered event model。

任务：

- [x] 自己读取 transcript JSONL。
- [x] 自己保留 `rawIndex`。
- [x] 自己处理坏行诊断。
- [x] 自己分类 user / assistant / tool_use / tool_result / compact_boundary / sidechain / system_event。
- [x] 自己输出 `currentContextMessages`、`displayReplayEvents`、`diagnostics`。

验收：

- [x] 第 3 层不依赖 `loadTranscriptFile(...)` 的 ordered/rawIndex 返回值。
- [x] Desktop 历史恢复仍走第 3 层。
- [x] Core 恢复上下文和 App Server display snapshot 同源。

## Goal 8：短期保留 `buildConversationChain(...)` 作为 helper

Goal 文件：[STD-HISTORY-12-8 buildConversationChain helper 边界](../goals/2026-05-25-std-history-12-8-buildconversationchain-helper-boundary.md)

目标：降低一次性迁移风险，保留并行工具和 tool_result 补回能力，但不继续强化第 2 层。

任务：

- [x] 明确 `buildConversationChain(...)` 当前仍被第 3 层临时复用的能力。
- [x] 禁止它决定 current tail。
- [x] 禁止新增 UI replay / ordered/rawIndex / currentContextTail 相关职责。
- [x] 设计后续 ordered reducer 完全替代 helper 的路径。

验收：

- [x] 第 2 层只作为 helper，不是恢复主路径。
- [x] 并行工具和 tool_result 不丢失。
- [x] 文档能说明 helper 退场条件。

## Goal 9：补齐 smoke 回归

Goal 文件：[STD-HISTORY-12-9 smoke 回归覆盖](../goals/2026-05-25-std-history-12-9-smoke-regression-coverage.md)

目标：把边界收口后的关键行为固化成自动回归。

任务：

- [x] 普通恢复 smoke。
- [x] compact 后恢复 smoke。
- [x] compact 前 UI 历史仍可见 smoke。
- [x] 并行 tool_use smoke。
- [x] tool_result 乱序 smoke。
- [x] 多 legacy leaf 只诊断 smoke。
- [x] materialization 失败不变成 `Session transcript not found` smoke。
- [x] App Server display snapshot smoke。
- [x] Desktop display events smoke。
- [x] compact 后摘要附属消息进入当前上下文 smoke。

验收：

- [x] `npm.cmd run typecheck` 通过。
- [x] `npm.cmd run build` 通过。
- [x] `npm.cmd run smoke:conversation-materialization` 通过。
- [x] `npm.cmd run smoke:app-server` 通过。
- [x] `npm.cmd run smoke:desktop-display-events` 通过。
- [x] `git diff --check` 通过。

## Goal 10：文档、规则和发布说明收口

Goal 文件：[STD-HISTORY-12-10 文档规则和发布说明收口](../goals/2026-05-25-std-history-12-10-doc-rules-release-closeout.md)

目标：让后续开发不再混淆第 2 层和第 3 层。

任务：

- [x] 更新会话层级文档。
- [x] 更新 `session-semantics-codex-migration.md` 的实施状态。
- [x] 更新项目 `AGENTS.md`。
- [x] 更新 `CHANGELOG.md`。
- [x] 在本文追加最终收口记录。

验收：

- [x] 文档明确第 2 层是 legacy helper，不是恢复主路径。
- [x] 文档明确第 3 层是恢复主路径。
- [x] 文档明确共享层可改但必须证明是共享正确性。

## 后续记录（追加）

- 2026-05-25：新建本文档。当前仅完成 TODO 建档，尚未开始执行代码修改。
- 2026-05-25：生成 STD-HISTORY-12-0 至 STD-HISTORY-12-10 共 11 份 Goal 文档，并绑定到本文的 Goal 索引、当前任务列表和各 Goal 小节。
- 2026-05-25：完成 Goal 0 原始层改动清单。结论：`sessionStorage.ts` 中的 ordered/rawIndex、底层 compact 当前上下文裁剪、`loadFullLog(...)` leaf 策略需要迁出；provider/API/SDK/UUID/tool pairing/compact metadata 相关共享正确性修复保留；`conversationRecovery.ts` facade 边界留到 Goal 4 定稿。
- 2026-05-25：完成 Goal 1 ordered/rawIndex 迁出。`sessionStorage.ts` 不再返回 ordered/rawIndex 或坏行列表；`conversationMaterialization.ts` 自己读取 JSONL 生成 ordered view、display replay 和 malformed diagnostics。验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`git diff --check` 全部通过。
- 2026-05-25：完成 Goal 2 compact 当前上下文裁剪迁出。`applyPreservedSegmentRelinks(...)` 只保留 live preservedSegment 原生 relink；普通 compact/stale/malformed 的当前上下文裁剪统一由 `conversationMaterialization.ts` 的 `applyCompactMaterialization(...)` 处理，UI display replay 不裁旧历史。验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`npm.cmd run smoke:app-server`、`git diff --check` 全部通过。
- 2026-05-25：完成 Goal 3 `loadFullLog(...)` leaf 策略迁出。`loadFullLog(...)` 不再选择 leaf 或 build current chain，只按物理顺序补全非 sidechain 主会话日志；恢复路径由 `conversationRecovery.ts` 的 materialization 覆盖最终模型上下文。验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`npm.cmd run smoke:cli-model`、`npm.cmd run smoke:app-server`、`git diff --check` 全部通过。
- 2026-05-25：完成 Goal 4 恢复入口边界定稿。结论：`conversationRecovery.ts` 是 CCR fork 的统一恢复 facade，CLI/TUI/Core/App Server initiated resume 都必须消费 materialized current-context contract；App Server display replay 同源消费 `materializeConversationFromTranscript(...)`。已补源码注释。验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`npm.cmd run smoke:app-server`、`git diff --check` 全部通过。
- 2026-05-25：完成 Goal 5 共享层必要修改保留清单。已列明 `sourceToolAssistantUUID`、tool_result pairing、compact metadata、SDK compact boundary、ESM `createRequire`、模型 API payload normalize、QueryEngine runtime guards、query loop continuation/snip、preservedSegment 写入等保留项，并明确 ordered/rawIndex、display replay、current tail、compact 当前上下文裁剪不属于共享正确性。补跑 `smoke:provider-tool-profile`、`smoke:provider-output-fixtures`、`smoke:openai-chat-protocol`、`git diff --check` 通过。
- 2026-05-25：完成 Goal 6 原始共享层逐项审查。结论：`messages.ts` / `query.ts` / `QueryEngine.ts` / `compact.ts` 里没有新的 Desktop/UI 恢复物化语义需要立即迁出；provider/API/tool pairing/SDK compact boundary/compact 写侧事实保留。灰区记录为后续 adapter 边界：`tool_use_summary`、`toolTimingMetadata`、`context_efficiency` / snip 提示。
- 2026-05-25：完成 Goal 7 第 3 层直读 transcript 边界收口。`conversationMaterialization.ts` 不再接受 `loaded.orderedMessages` / `loaded.malformedJsonlLines` 旧兼容字段；ordered/rawIndex/坏行诊断只来自第 3 层自己的 JSONL 读取或测试显式 options。验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`npm.cmd run smoke:app-server` 通过。
- 2026-05-25：完成 Goal 8 `buildConversationChain(...)` helper 边界收口。已在源码注释和 goal 文档中明确：helper 只重建 parent 链和补回并行 tool/tool_result，不负责 current tail、ordered/rawIndex、UI replay 或 compact 裁剪。验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`git diff --check` 通过。
- 2026-05-25：完成 Goal 9 smoke 回归覆盖。新增普通非 compact 恢复 smoke；核对 compact 后恢复、compact 前 UI 历史可见、并行 tool_use、tool_result 乱序、多 legacy leaf 诊断、materialization failure diagnostic、App Server snapshot、Desktop display events 覆盖。验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`npm.cmd run smoke:app-server`、`npm.cmd run smoke:desktop-display-events`、`git diff --check` 全部通过。
- 2026-05-25：完成 Goal 10 文档、规则和发布说明收口。已更新 `session-context-materialization-repair.md`、`session-semantics-codex-migration.md`、`realtime-history-display-contract.md`、项目 `AGENTS.md` 和 `CHANGELOG.md`，明确第 2 层只作 helper、第 3 层是恢复物化主入口、共享层可改但必须证明共享正确性。
- 2026-05-25：补修手动 compact 后实时上下文与历史恢复上下文不一致的问题。根因是实时路径使用 `buildPostCompactMessages(...)` 里的摘要、附件和 hook/system 附属消息，而恢复路径从 transcript 物化时只走到 compact summary 这个 tail，后续附属消息没有进入 `currentContextMessages`。已在第 3 层追加 compact tail 后的当前上下文附属消息，并让手动 compact 持久化后重新经由 `materializeConversationFromTranscript(...)` 刷新 Core 当前上下文。验证：`npm.cmd run smoke:conversation-materialization` 覆盖 `current_context_followers_appended`。
- 2026-05-25：补修 Desktop 顶部上下文数字实时刷新问题。现象是 compact 卡片显示 `20,109 -> 398`，但顶部仍显示 `20K`，切换历史恢复后才变成约 `404`；根因是 `ccr:get-status` 返回 Desktop main 缓存，没有同步刷新 `context/status` / `compact/status` / `memory/session/status`。已让 `get-status` 刷新 runtime snapshots，并让 compact 完成广播显式带上刷新后的 context/compact/memory。验证：`npm.cmd run typecheck`、`npm.cmd run desktop:build`、`npm.cmd run smoke:desktop-display-events`、`git diff --check` 通过。

- 2026-05-25：补修 compact 后实时上下文 token 仍显示压缩前大小、切换历史恢复后才变小的问题。根因不是 Topbar 计算口径，而是 `recordTranscript(...)` 写 JSONL 走异步队列；`runCompact(...)` 在持久化返回后立刻从 transcript 重新物化时，可能读到尚未 flush 的压缩前文件快照，并把 Core `#threadMessages` 覆盖回旧上下文。已在手动 compact 持久化成功后、回读物化前显式 `flushSessionStorage()`。验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`npm.cmd run smoke:core-session-parent-chain`、`npm.cmd run smoke:app-server`、`npm.cmd run desktop:build` 通过。

## 备注

- 当前状态：active
- 暂停原因：无。
- 下一步需要：运行最终 gate，随后进入手动验证或 ordered reducer 后续迁移。
