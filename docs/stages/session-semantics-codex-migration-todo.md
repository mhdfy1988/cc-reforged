# CCR 会话语义 Codex-like 适配层 Todo

本文是 [CCR 会话语义向 Codex 模型迁移实施计划](./session-semantics-codex-migration-plan.md) 的标准 todo。计划文档负责解释背景、源码证据和整体路线；本文作为后续实现、验收、恢复接续的权威任务列表。

## 目标仓库

`D:\agent_project\claude-code-reforged`

## 权威输入

- [CCR 会话语义向 Codex 模型迁移方案](../architecture/session-semantics-codex-migration.md)
- [CCR 会话语义向 Codex 模型迁移实施计划](./session-semantics-codex-migration-plan.md)
- [Codex / OpenClaw 实时与历史恢复源码证据索引](../references/codex-openclaw-live-history-source-evidence.md)
- [CCR 历史恢复与实时展示统一协议](../architecture/realtime-history-display-contract.md)
- [会话上下文物化修复说明](../architecture/session-context-materialization-repair.md)
- [并行工具结果来源绑定 Todo](./parallel-tool-result-source-binding-todo.md)

## Goal 文档索引

- [STD-HISTORY-11-0 Claude Code transcript 原生语义审计](../goals/2026-05-25-std-history-11-0-claude-transcript-native-audit.md)
- [STD-HISTORY-11-1 物化层事件分类器](../goals/2026-05-25-std-history-11-1-materialization-event-classifier.md)
- [STD-HISTORY-11-2 当前上下文尾部解析](../goals/2026-05-25-std-history-11-2-current-context-tail-resolution.md)
- [STD-HISTORY-11-3 当前上下文组装过渡护栏](../goals/2026-05-25-std-history-11-3-context-assembly-transition-guard.md)
- [STD-HISTORY-11-4 展示投影不变式保护](../goals/2026-05-25-std-history-11-4-display-projection-invariant.md)
- [STD-HISTORY-11-5 冒烟与真实样本覆盖](../goals/2026-05-25-std-history-11-5-smoke-real-fixtures.md)
- [STD-HISTORY-11-6 错误语义和诊断收口](../goals/2026-05-25-std-history-11-6-error-diagnostics-closeout.md)
- [STD-HISTORY-11-7 有序 reducer 迁移设计](../goals/2026-05-25-std-history-11-7-ordered-reducer-migration.md)
- [STD-HISTORY-11-8 文档规则和发布说明收口](../goals/2026-05-25-std-history-11-8-doc-rules-closeout.md)

## 当前任务列表（实时）

- [x] Goal 0：完成 Claude Code transcript 原生语义审计。Goal 文件：[STD-HISTORY-11-0](../goals/2026-05-25-std-history-11-0-claude-transcript-native-audit.md)
- [x] Goal 1：新增物化层事件分类器。Goal 文件：[STD-HISTORY-11-1](../goals/2026-05-25-std-history-11-1-materialization-event-classifier.md)
- [x] Goal 2：替换正常恢复路径里的 leaf 选取。Goal 文件：[STD-HISTORY-11-2](../goals/2026-05-25-std-history-11-2-current-context-tail-resolution.md)
- [x] Goal 3：收口当前上下文组装过渡护栏。Goal 文件：[STD-HISTORY-11-3](../goals/2026-05-25-std-history-11-3-context-assembly-transition-guard.md)
- [x] Goal 4：保护 UI 展示投影不被当前上下文裁剪影响。Goal 文件：[STD-HISTORY-11-4](../goals/2026-05-25-std-history-11-4-display-projection-invariant.md)
- [x] Goal 5：补齐冒烟和真实样本回归。Goal 文件：[STD-HISTORY-11-5](../goals/2026-05-25-std-history-11-5-smoke-real-fixtures.md)
- [x] Goal 6：收口恢复错误语义和诊断展示。Goal 文件：[STD-HISTORY-11-6](../goals/2026-05-25-std-history-11-6-error-diagnostics-closeout.md)
- [x] Goal 7：设计有序 reducer 迁移路径。Goal 文件：[STD-HISTORY-11-7](../goals/2026-05-25-std-history-11-7-ordered-reducer-migration.md)
- [x] Goal 8：文档、规则和发布说明收口。Goal 文件：[STD-HISTORY-11-8](../goals/2026-05-25-std-history-11-8-doc-rules-closeout.md)

## 当前指针

- 当前进行中：Goal 8：文档、规则和发布说明收口。Goal 文件：[STD-HISTORY-11-8](../goals/2026-05-25-std-history-11-8-doc-rules-closeout.md)
- 当前正在做：全部当前任务列表已完成。
- 完成后下一项：后续新增恢复能力时，从本文和 [CCR 会话语义向 Codex 模型迁移方案](../architecture/session-semantics-codex-migration.md) 重新读取不变式。

## 执行约束

1. 暂不修改 Claude Code 原生层：`src/utils/sessionStorage.ts`、`src/utils/messages.ts`、`src/query.ts`、`src/QueryEngine.ts` 只读审计；如确需修改，必须先单独评估并征求确认。
2. 不直接改写 Claude Code transcript 存储格式，不新增会污染原始 JSONL 的 CCR 专用字段。
3. `parentUuid` 只作为原始存储指针、来源线索和诊断信息；正常恢复主路径不得再用 `leaf`、`longest chain`、`terminal leaves` 决定当前主线。
4. 并行工具 DAG 是 Claude Code 原生 transcript 形态，不是异常分支；`sourceToolAssistantUUID` 是工具结果来源绑定，不是脏数据。
5. `tool_result` 不推进当前会话尾部，只能按 `tool_use_id` / `toolUseId` / `toolCallId` 绑定到来源工具调用。
6. 当前模型上下文和 UI 可见历史是两个投影。compact 只改变当前模型上下文，不裁掉 UI 可见历史。
7. 当前模型上下文输出必须满足模型 API 的 `tool_use` / `tool_result` 配对要求；UI 展示可以另行归组，但不能反向污染模型上下文。
8. `buildConversationChain(...)` 不能整体删除。它的 leaf 选择职责要迁出正常路径；并行工具 sibling / tool_result 补回能力要保留或迁入新 reducer。
9. Renderer 主路径只消费 `ThreadDisplaySnapshot` / `ThreadDisplayPatch`，不得重新解释 transcript、raw content 或 `parentUuid`。
10. 任何通过 `cli.js`、`dist`、Electron main 或打包入口执行的 smoke，必须先 build，避免跑到旧产物。
11. 每个 goal 完成后必须回写本文档：勾选状态、当前指针、后续记录。

## Goal 0：Claude Code transcript 原生语义审计

Goal 文件：[STD-HISTORY-11-0 Claude Code transcript 原生语义审计](../goals/2026-05-25-std-history-11-0-claude-transcript-native-audit.md)

目标：先弄清 Claude Code 原生 transcript 写入、压缩、工具结果绑定和 API 配对语义。

任务：

- [x] 只读审计 `useLogMessages(...)`、`recordTranscript(...)`、`insertMessageChain(...)`、`loadTranscriptFile(...)`、`buildConversationChain(...)`。
- [x] 只读审计 compact、snip、preservedSegment、legacy progress 的读写语义。
- [x] 只读审计 `sourceToolAssistantUUID` 和工具结果写入路径。
- [x] 只读审计 `ensureToolResultPairing(...)` 对模型 API payload 的不变式。
- [x] 在架构文档和实施计划中记录原生语义边界。

验收：

- [x] 能解释为什么并行工具会形成 DAG。
- [x] 能解释为什么 `tool_result` 可能指向不同 assistant sibling。
- [x] 能解释 compact boundary 为什么裁当前模型上下文而不是 UI 历史。
- [x] 后续计划不再把并行工具 DAG 当旧异常数据处理。

## Goal 1：物化层事件分类器

Goal 文件：[STD-HISTORY-11-1 物化层事件分类器](../goals/2026-05-25-std-history-11-1-materialization-event-classifier.md)

目标：在 `conversationMaterialization.ts` 内部从 ordered transcript 视图生成分类事件，后续恢复和诊断都先消费这个事件视图。

任务：

- [x] 新增 transcript event 分类类型，至少覆盖用户输入、助手回复、工具调用、工具结果、压缩边界、sidechain、系统辅助事件、异常诊断事件。
- [x] 明确只有普通用户输入和助手回复能推进当前会话尾部。
- [x] 明确工具调用和工具结果通过来源 ID 绑定，不参与尾部竞争。
- [x] 将分类结果写入物化诊断，包含 `uuid`、`rawIndex`、`parentUuid`、`sourceToolAssistantUUID`、事件类别和跳过原因。
- [x] 保持原始 transcript 只读，不写回 JSONL。

验收：

- [x] 纯 `tool_result` user message 被分类为工具结果，不再被当成普通用户输入。
- [x] sidechain message 不推进当前会话尾部。
- [x] compact boundary 不推进当前会话尾部。
- [x] 分类诊断能定位到原始 `rawIndex`。

## Goal 2：当前上下文尾部解析

Goal 文件：[STD-HISTORY-11-2 当前上下文尾部解析](../goals/2026-05-25-std-history-11-2-current-context-tail-resolution.md)

目标：正常恢复不再通过 `getCanonicalMainLeaf(...)` 或最长链决定当前上下文尾部。

任务：

- [x] 新增 `resolveCurrentContextTail(...)` 或等价函数。
- [x] 输入使用 Goal 1 的 ordered classified events。
- [x] 当前尾部语义改成“最后一个可推进当前会话的用户输入或助手回复”。
- [x] `getCanonicalMainLeaf(...)` 降级为异常诊断工具，不参与正常恢复。
- [x] 对外兼容字段如 `canonicalLeafUuid` 如暂时保留，内部语义必须改为 `currentContextTailUuid`。

验收：

- [x] 并行工具结果 sibling 不会触发普通恢复失败。
- [x] 当前上下文尾部不会是 `tool_result`、compact boundary、sidechain 或系统辅助事件。
- [x] 不恢复“最长链优先”兜底。
- [x] 真实失败样本可以完成当前上下文物化。

## Goal 3：当前上下文组装过渡护栏

Goal 文件：[STD-HISTORY-11-3 当前上下文组装过渡护栏](../goals/2026-05-25-std-history-11-3-context-assembly-transition-guard.md)

目标：在不一次性重写 Claude Code 原生读侧修复逻辑的情况下，先保证当前模型上下文正确。

任务：

- [x] 用 Goal 2 得到的 `currentContextTail` 作为上下文组装入口。
- [x] 保留 compact / snip / preservedSegment 处理能力。
- [x] 保留并行工具 sibling / tool_result 补回能力，但确保它不反向决定 tail。
- [x] dangling parent、多个 terminal leaf、异常 sibling 只输出诊断，不触发最长链恢复。
- [x] current context 输出继续经过模型 API pairing 保护。

验收：

- [x] compact 后恢复的 `currentContextMessages` 是压缩后的上下文。
- [x] 并行工具调用和结果能进入当前模型上下文。
- [x] 工具结果乱序回来时，不丢结果、不串绑。
- [x] sidechain 不混入当前主线模型上下文。

## Goal 4：展示投影不变式保护

Goal 文件：[STD-HISTORY-11-4 展示投影不变式保护](../goals/2026-05-25-std-history-11-4-display-projection-invariant.md)

目标：确认当前上下文修复不会误伤 UI 可见历史，历史恢复和实时展示继续消费展示协议。

任务：

- [x] 确认 `displayReplayEvents` / `ThreadDisplaySnapshot` 仍从完整可见历史投影生成。
- [x] compact boundary 只显示为轻量提示或分隔项，不裁掉 boundary 前 UI 历史。
- [x] 工具展示继续走 `toolDisplayLifecycle` 和来源 ID 绑定。
- [x] Renderer 不新增 raw transcript fallback。
- [x] 对历史 snapshot 和实时 patch 做展示结果一致性校验。

验收：

- [x] compact 前历史内容恢复后仍可见，或按产品设计折叠展示。
- [x] 历史 snapshot 和实时 patch 的工具卡绑定语义一致。
- [x] 缺 projection / 孤立工具结果只显示诊断，不伪装成正常工具卡。
- [x] UI 展示不会反向改变当前模型上下文。

## Goal 5：冒烟与真实样本覆盖

Goal 文件：[STD-HISTORY-11-5 冒烟与真实样本覆盖](../goals/2026-05-25-std-history-11-5-smoke-real-fixtures.md)

目标：把这次反复出现的问题固化成自动回归和真实样本验证。

任务：

- [x] 扩展 `scripts/smoke-conversation-materialization.mjs`。
- [x] 新增并行工具 sibling 用例：同轮 tool_use A/B，tool_result B 先回，tool_result A 后回。
- [x] 新增 compact + 并行工具组合用例。
- [x] 新增 sidechain sibling 不参与当前尾部用例。
- [x] 新增真实失败 transcript 的最小化 fixture，或增加本机样本只读验证脚本。
- [x] 运行源码、构建产物和必要 App Server smoke。

验收：

- [x] `npm.cmd run typecheck`
- [x] `npm.cmd run build`
- [x] `npm.cmd run smoke:conversation-materialization`
- [x] 必要时补 `npm.cmd run smoke:app-server`
- [x] 真实失败样本不再报 `multiple_main_leaves` 或被包装成 `Session transcript not found`。

## Goal 6：错误语义和诊断收口

Goal 文件：[STD-HISTORY-11-6 错误语义和诊断收口](../goals/2026-05-25-std-history-11-6-error-diagnostics-closeout.md)

目标：恢复失败时显示真实诊断，不把物化错误伪装成 transcript 文件不存在。

任务：

- [x] 审查 App Server / Core resume 错误映射。
- [x] 区分 transcript 文件不存在、JSONL malformed、物化语义异常、工具结果孤立、compact preservedSegment 异常。
- [x] UI 错误卡显示真实诊断摘要。
- [x] 日志保留 diagnostic code、session path、rawIndex 和相关 UUID。
- [x] 保证历史会话弹窗的错误不会掩盖具体会话项。

验收：

- [x] `multiple_main_leaves` 不再显示成 `Session transcript not found`。
- [x] 文件确实不存在时仍显示 transcript not found。
- [x] 用户能从错误卡判断是文件问题、物化语义问题还是工具绑定问题。

## Goal 7：有序 reducer 迁移设计

Goal 文件：[STD-HISTORY-11-7 有序 reducer 迁移设计](../goals/2026-05-25-std-history-11-7-ordered-reducer-migration.md)

目标：把过渡期仍依赖 parent walk 的上下文组装，设计成后续可迁移到 ordered event reducer 的清晰路径。

任务：

- [x] 设计 `MaterializedConversationEvent` / `MaterializedConversationModel`。
- [x] 明确 current context、visible history、diagnostics、tool lifecycle 从同一个 ordered event model 派生。
- [x] 明确 `parentUuid` 只作为 source metadata 和 legacy diagnostic。
- [x] 明确 `buildConversationChain(...)` 何时从主路径退为 legacy helper。
- [x] 给出不破坏 Claude Code 原生层的迁移步骤和回滚点。

验收：

- [x] 文档能说明如何从当前过渡实现迁到 ordered reducer。
- [x] 后续不需要再引入新的 leaf / longest-chain 兜底。
- [x] current context 与 UI history 的边界清楚。
- [x] 该设计经过 Goal 1-6 的实现结果回填修订。

## Goal 8：文档规则和发布说明收口

Goal 文件：[STD-HISTORY-11-8 文档规则和发布说明收口](../goals/2026-05-25-std-history-11-8-doc-rules-closeout.md)

目标：让后续开发不再回到旧 leaf 语义，也不再重复踩 dist / smoke / 原生层误改的问题。

任务：

- [x] 更新 `session-semantics-codex-migration.md` 的实施状态。
- [x] 更新 `session-context-materialization-repair.md`，标记旧 leaf 主路径已下线或仍保留的边界。
- [x] 更新 `parallel-tool-result-source-binding-todo.md`，说明此前并行工具漏验与补验结论。
- [x] 必要时补项目 `AGENTS.md`：会话恢复不得新增最长链兜底；dist smoke 必须先 build；Claude Code 原生层修改要先评估。
- [x] 更新 CHANGELOG 或发布说明。

验收：

- [x] 文档里不再把 `leaf` 当正常产品语义。
- [x] 后续 todo / goal 能直接引用本 todo。
- [x] 新增恢复能力前能从本文找到不变式和验收要求。

## 后续记录（追加）

### 2026-05-25

- 新建本 todo，作为“会话语义向 Codex-like 适配层迁移”的权威推进文档。
- 当前阶段 0 已完成；下一步从 Goal 1 物化层事件分类器开始。
- Goal 1 已完成：`conversationMaterialization.ts` 输出 `classifiedTranscriptEvents`，并新增 `transcript_events_classified` 诊断摘要；smoke 覆盖 `tool_result`、compact boundary、sidechain 分类语义。
- 验证通过：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`git diff --check`。
- 当前指针切换到 Goal 2：当前上下文尾部解析。
- Goal 2 已完成：正常恢复路径使用 `resolveCurrentContextTail(...)` 从分类事件解析 `currentContextTailUuid`；`canonicalLeafUuid` 仅作兼容字段，语义等同当前上下文尾部。
- 旧 parent leaf 判断降级为 `legacy_multiple_main_leaves_diagnostic`，不再输出 `multiple_main_leaves` 阻断普通恢复。
- 验证通过：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`git diff --check`。
- 当前指针切换到 Goal 3：当前上下文组装过渡护栏。
- Goal 3 已完成：current context 组装入口使用 `currentContextTail`，同时保留 `buildConversationChain(...)` 的并行工具 sibling / tool_result 补回能力。
- 新增并行工具 sibling smoke：同轮 tool_use A/B、tool_result B 先回、tool_result A 后回，最终 current context 保留 A/B 工具调用与结果。
- 验证通过：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`git diff --check`。
- 当前指针切换到 Goal 4：展示投影不变式保护。
- Goal 4 已完成：本阶段未改 Renderer 展示主路径，验证 `displayReplayEvents`、App Server snapshot / patch 和 Desktop display events 仍保持展示投影语义。
- 验证通过：`npm.cmd run smoke:app-server`、`npm.cmd run smoke:desktop-display-events`。
- 当前指针切换到 Goal 5：冒烟与真实样本覆盖。
- Goal 5 已完成：新增分类事件、并行工具 sibling、compact + 并行工具组合、多个旧 leaf 候选不阻断恢复等最小 fixture。
- 验证通过：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`npm.cmd run smoke:app-server`、`git diff --check`。
- 当前指针切换到 Goal 6：错误语义和诊断收口。
- Goal 6 已完成：`loadMessagesFromJsonlPath(...)` / `materializeLogForResume(...)` 遇到物化失败时抛出 `history_materialization_failed`，错误消息保留 diagnostic code 和 transcript path，不再返回空消息让 Core 包装成 `Session transcript not found`。
- 新增失败诊断 smoke：只有 orphan tool_result 的 transcript 会保留 `no_current_context_tail`，并确认错误消息不包含 `Session transcript not found`。
- 验证通过：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:conversation-materialization`、`npm.cmd run smoke:app-server`、`git diff --check`。
- 当前指针切换到 Goal 7：有序 reducer 迁移设计。
- Goal 7 已完成：在 `session-semantics-codex-migration.md` 增加 Ordered Reducer 目标模型，定义 `MaterializedConversationEvent`、`MaterializedConversationModel`、投影边界、迁移步骤和回滚点。
- 验证通过：`git diff --check`。
- 当前指针切换到 Goal 8：文档规则和发布说明收口。
- Goal 8 已完成：同步 `session-semantics-codex-migration.md`、`session-context-materialization-repair.md`、`parallel-tool-result-source-binding-todo.md`、项目 `AGENTS.md` 和 `CHANGELOG.md`。
- 本专项完成。当前已完成的是过渡层：分类事件、current context tail、错误诊断和 smoke；后续 ordered reducer 仍是后续迁移，不写成已完成。
