# CCR 会话语义向 Codex 模型迁移实施计划

本文是 [CCR 会话语义向 Codex 模型迁移方案](../architecture/session-semantics-codex-migration.md) 的实施计划。目标不是一次性重写整套会话系统，而是在不改坏 Claude Code 原始 transcript 存储语义的前提下，逐步把 CCR 的恢复、上下文和展示语义迁到 Codex-like 模型。

## 总路线

```text
Claude Code 原始 transcript
-> CCR transcript 语义适配层
-> Codex-like 有序会话模型
-> 当前模型上下文 currentContextMessages
-> UI 可见历史 ThreadDisplaySnapshot / ThreadDisplayPatch
```

关键原则：

1. 不直接修改 Claude Code 原始 transcript 写入协议。
2. 不把 `parentUuid` 当 CCR 产品语义，只把它当原始存储指针和诊断线索。
3. 不再用 `leaf` / `longest chain` / `terminal leaves` 作为正常恢复路径。
4. 先从当前会持续出错的恢复物化路径改起，再逐步收敛到 ordered reducer。
5. 每一步都要有 smoke 或真实样本验证，避免再次变成补丁堆叠。

## 当前必须解决的问题

当前 `conversationMaterialization.ts` 仍然在正常路径中使用 `getCanonicalMainLeaf(...)`。这会导致并行工具结果 sibling、compact boundary、系统辅助消息或 sidechain sibling 参与主线尾部竞争。

第一阶段必须先把这个错误主路径切掉，否则后续 UI、工具卡、压缩展示再怎么补，仍会被旧 leaf 推断反咬。

但在切物化主路径前，必须先补一层 Claude Code transcript 原生语义审计。否则迁移计划只懂 CCR 适配层，不懂 Claude Code 写入层，容易把原始 transcript 里的存储约束误判成错误数据。

## 阶段 0：Claude Code transcript 原生语义审计

目标：先确认 Claude Code 原始写入层到底保证了什么、不保证什么，再决定 CCR 物化层如何转成 Codex-like 语义。

必须审清的源码入口：

- `src/hooks/useLogMessages.ts`
  - React / TUI 消息数组如何增量写入 transcript。
  - `startingParentUuidHint` 如何跨增量 slice 维持 parent 游标。
  - compact、snip、rewind 时为什么不能按普通 append 理解。
- `src/utils/sessionStorage.ts`
  - `recordTranscript(...)` 如何过滤已写消息。
  - `insertMessageChain(...)` 如何写 `parentUuid`。
  - `sourceToolAssistantUUID` 为什么会覆盖普通 parent。
  - `loadTranscriptFile(...)` 如何读 JSONL、桥接 legacy progress、处理 compact / snip。
  - `buildConversationChain(...)` 如何补回并行工具结果 sibling。
- `src/utils/messages.ts`
  - `createUserMessage(...)` 如何承载 `sourceToolAssistantUUID`。
  - `normalizeMessagesForAPI(...)` / `ensureToolResultPairing(...)` 对 tool_use / tool_result 有哪些 API 层不变式。
- `src/services/compact/compact.ts`
  - `buildPostCompactMessages(...)` 的输出顺序：boundary、summary、messagesToKeep、attachments、hookResults。
- `src/core/sessionCore.ts` / `src/query.ts` / `src/QueryEngine.ts`
  - Core、query loop、SDK / App Server 入口分别什么时候调用 `recordTranscript(...)`。
  - compact boundary 持久化成功前后，内存上下文如何更新。
- `src/services/tools/toolExecution.ts` / `src/services/tools/StreamingToolExecutor.ts`
  - tool_result 生成时如何写入 `sourceToolAssistantUUID`。

当前已经确认的原生事实：

1. `parentUuid` 是 Claude Code transcript 的物理链路字段，不是纯 UI 展示顺序。
2. `recordTranscript(...)` 会按“已写 prefix / 新消息 slice”维护 parent 游标；compact 场景里 messagesToKeep 可能是已写旧 UUID，不能当成普通新链。
3. `compact_boundary` 写入时会让 boundary 的 `parentUuid` 为 `null`，并用 `logicalParentUuid` 保留逻辑前驱。
4. `tool_result` 在写入时可能用 `sourceToolAssistantUUID` 把自己的 `parentUuid` 指向包含对应 `tool_use` 的 assistant message。
5. 并行工具流式输出可能形成 DAG：多个 assistant sibling 各自带 tool_use，多个 tool_result sibling 分别指回各自来源 assistant。
6. `buildConversationChain(...)` 不是普通 parent walk，它还承担了补回并行工具结果 sibling 的原生兼容职责。
7. `normalizeMessagesForAPI(...)` / `ensureToolResultPairing(...)` 对 tool_use / tool_result 有模型 API 层顺序和配对要求，CCR 物化不能随便重排成 UI 想看的顺序。

阶段 0 输出：

- [x] 在架构文档中补一节“Claude Code transcript 原生语义边界”。
- [x] 在本计划中明确哪些原生能力必须保留，哪些只在 CCR 适配层转换。
- [x] 标出 `buildConversationChain(...)` 里哪些能力是“必须迁走的 leaf 选择”，哪些能力是“暂时必须保留的原生修复”。
- [x] 明确 current context 的顺序必须仍满足 Claude / Anthropic API 的 tool_use / tool_result 配对要求。

验收：

- [x] 后续阶段 1 / 2 的实现方案能解释 `sourceToolAssistantUUID` 的存在原因。
- [x] 后续阶段 1 / 2 不会把并行工具 DAG 当成 transcript 异常。
- [x] 后续阶段 1 / 2 不会把 `buildConversationChain(...)` 整体删除。
- [x] 后续阶段 1 / 2 不会为了 UI 顺序破坏模型 API 的 tool_use / tool_result 顺序。

完成记录：

- 已完成只读审计，未修改 `src/utils/sessionStorage.ts`、`src/utils/messages.ts`、`src/query.ts`、`src/QueryEngine.ts`。
- 已确认 `parentUuid` 在普通场景近似顺序链，但在并行 tool、compact、snip、legacy progress 场景中不能直接当 CCR 主线语义。
- 已确认 `tool_result` 通过 `sourceToolAssistantUUID` 回指来源 assistant 是原生设计，不是异常数据。
- 已确认 `buildConversationChain(...)` 里有两类职责：`leaf` 选择应从正常路径迁出；并行工具 sibling / tool_result 补回能力必须保留或迁入新 reducer。
- 已确认 current context 不能为了 UI 展示顺序随意重排，仍要满足模型 API 的 `tool_use` / `tool_result` 配对要求。

## 阶段 1：物化层事件分类器

目标：在进入当前上下文恢复前，先按 transcript 物理顺序生成事件分类结果。

任务：

- [ ] 在 `src/utils/conversationMaterialization.ts` 新增 transcript event 分类类型。
- [ ] 分类至少覆盖：
  - 用户输入
  - 助手回复
  - 工具调用
  - 工具结果
  - 压缩边界
  - sidechain
  - 系统 / 辅助事件
  - 异常诊断事件
- [ ] 明确只有用户输入和助手回复能推进当前主会话尾部。
- [ ] 明确 `tool_result` 只能按来源 ID 绑定工具调用，不参与尾部竞争。
- [ ] 将分类结果保留在物化诊断中，便于后续排查。

验收：

- [ ] 纯 `tool_result` user message 被分类为工具结果，不再被当成普通用户输入。
- [ ] sidechain message 不推进主线尾部。
- [ ] compact boundary 不推进主线尾部。
- [ ] 分类逻辑不改写原始 transcript。

## 阶段 2：替换正常路径里的 leaf 选取

目标：正常恢复不再调用 `getCanonicalMainLeaf(...)` 决定当前上下文尾部。

任务：

- [ ] 新增 `resolveCurrentContextTail(...)` 或等价函数。
- [ ] 输入使用 ordered classified events，而不是 parent graph terminal leaf。
- [ ] 当前 tail 语义改为“最后一个可推进主线的用户输入或助手回复”。
- [ ] `getCanonicalMainLeaf(...)` 降级为异常诊断工具，不参与正常恢复。
- [ ] 内部字段优先使用 `currentContextTailUuid`；兼容对外字段 `canonicalLeafUuid` 可暂时保留。

验收：

- [ ] 并行工具结果 sibling 不会触发 `multiple_main_leaves`。
- [ ] 当前上下文尾部不会是 `tool_result`。
- [ ] 不恢复“最长链优先”兜底。
- [ ] 真实失败样本可以完成物化。

## 阶段 3：当前上下文组装过渡收口

目标：在不一次性重写 `buildConversationChain(...)` 的情况下，先保证当前模型上下文正确。

任务：

- [ ] 用阶段 2 得到的 `currentContextTail` 作为上下文组装入口。
- [ ] 保留现有 compact / snip / preservedSegment 处理能力。
- [ ] 保留现有并行工具结果恢复能力，但确保它不反向决定 tail。
- [ ] 增加诊断：如果 parent walk 过程中发现 dangling parent，只作为恢复链路诊断，不触发最长链选择。

验收：

- [ ] compact 后恢复的 `currentContextMessages` 仍是压缩后的上下文。
- [ ] 并行工具调用和结果都能进入当前模型上下文。
- [ ] 工具结果乱序回来时，当前上下文不丢结果、不串绑。
- [ ] sidechain 不混入主线当前上下文。

## 阶段 4：历史展示继续走 display projection

目标：确保当前上下文修复不影响 UI 可见历史恢复。

任务：

- [ ] 确认 `displayReplayEvents` / `ThreadDisplaySnapshot` 仍从完整可见历史投影生成。
- [ ] compact boundary 只作为 UI 提示或分隔项，不裁掉压缩前可见历史。
- [ ] 工具展示仍走 `toolDisplayLifecycle`，按 `tool_use_id` / `toolCallId` 绑定。
- [ ] Renderer 不新增 raw transcript fallback。

验收：

- [ ] compact 前历史内容恢复后仍可见，或按当前产品设计折叠展示。
- [ ] 历史 snapshot 和实时 patch 的工具卡绑定语义一致。
- [ ] 缺 projection / 孤立工具结果只显示诊断，不伪装成正常工具卡。

## 阶段 5：补齐 smoke 和真实样本回归

目标：把这次反复出现的问题固化成自动回归。

任务：

- [ ] 扩展 `scripts/smoke-conversation-materialization.mjs`。
- [ ] 新增并行工具结果 sibling 用例：
  - assistant 同轮产生 tool_use A / B
  - tool_result B 先回来
  - tool_result A 后回来
  - 后续继续普通 assistant / user
- [ ] 新增 compact + 并行工具组合用例。
- [ ] 新增 sidechain sibling 不参与主线 tail 用例。
- [ ] 加入真实失败 transcript 样本的最小化 fixture，或脚本读取指定本机样本做非提交回归。

验收：

- [ ] `npm.cmd run typecheck`
- [ ] `npm.cmd run build`
- [ ] `npm.cmd run smoke:conversation-materialization`
- [ ] 必要时补 `npm.cmd run smoke:app-server`
- [ ] 真实失败样本不再报 `multiple_main_leaves` 或被包装成 `Session transcript not found`

## 阶段 6：错误语义和诊断收口

目标：恢复失败时给出真实诊断，不再把物化错误伪装成 transcript 不存在。

任务：

- [ ] 审查 App Server / Core resume 的错误映射。
- [ ] 区分：
  - transcript 文件不存在
  - transcript JSONL malformed
  - 物化语义异常
  - 工具结果孤立
  - compact preservedSegment 异常
- [ ] UI 错误卡显示真实诊断摘要。
- [ ] 日志中保留具体 diagnostic code 和 session path。

验收：

- [ ] `multiple_main_leaves` 不再显示成 `Session transcript not found`。
- [ ] 文件不存在仍正确显示 transcript not found。
- [ ] 用户能从错误卡判断是文件问题还是语义物化问题。

## 阶段 7：向 ordered reducer 继续迁移

目标：把过渡期仍依赖 parent walk 的上下文组装，逐步迁到 ordered event reducer。

任务：

- [ ] 设计 `MaterializedConversationEvent` / `MaterializedConversationModel`。
- [ ] 当前模型上下文从 ordered events reducer 产出。
- [ ] `parentUuid` 只作为原始来源、diagnostic 和旧 transcript 辅助信息。
- [ ] `buildConversationChain(...)` 从主路径退到 legacy helper。
- [ ] `canonicalLeafUuid` 对外兼容字段逐步改为 `currentContextTailUuid` 或诊断字段。

验收：

- [ ] 当前上下文恢复不依赖 terminal leaf。
- [ ] 并行工具结果、compact、sidechain、snip 都通过同一 reducer 语义处理。
- [ ] 旧 parent chain helper 删除或只保留在兼容/诊断路径。

## 阶段 8：文档和规则收口

目标：让后续开发不再回到旧 leaf 语义。

任务：

- [ ] 更新 `session-semantics-codex-migration.md` 的实施状态。
- [ ] 更新 `session-context-materialization-repair.md`，标记旧 leaf 主路径已下线。
- [ ] 更新 `parallel-tool-result-source-binding-todo.md`，说明此前 Goal 9/10 的漏验和补验结论。
- [ ] 必要时补项目 `AGENTS.md`：会话恢复不得新增最长链兜底；dist smoke 必须先 build。
- [ ] 更新 CHANGELOG。

验收：

- [ ] 文档里不再把 `leaf` 当正常产品语义。
- [ ] 后续 todo / goal 能直接引用本计划。
- [ ] 新增恢复能力前能从本文找到不变式和验收要求。

## 当前指针

当前尚未进入源码修改。阶段 0 已完成；下一步如继续实现，应从阶段 1 开始：

```text
阶段 1：物化层事件分类器
```

第一轮源码实现只进入 `conversationMaterialization.ts` 主路径，不碰原始 transcript 写入层。

## 风险和护栏

1. 不要直接删除 `buildConversationChain(...)`，它现在仍包含并行工具结果恢复和部分旧 transcript 兼容能力。
2. 不要把 UI 可见历史套用当前模型上下文裁剪规则。
3. 不要为了旧异常数据重新加入最长链优先。
4. 不要在 Renderer 补 raw fallback。
5. 每次修改后，如果 smoke 走 `dist` / `cli.js`，必须先 `npm.cmd run build`。
