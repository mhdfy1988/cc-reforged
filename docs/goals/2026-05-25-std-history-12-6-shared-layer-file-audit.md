# Goal: STD-HISTORY-12-6 原始共享层逐项审查

## 目标

逐项判断 `messages.ts` / `query.ts` / `QueryEngine.ts` / `compact.ts` 的改动是否属于共享正确性。

本 goal 解决的是“不要只盯 sessionStorage，而漏掉其他原始共享层里的会话语义变化”的问题。

## 为什么要做

这些文件里既有 provider/API/SDK 必要修改，也可能夹杂 snip、compact、tool summary、恢复语义相关调整。必须逐项确认，不能一概保留或一概撤回。

## 范围

1. 审查 `messages.ts` 的 API normalize / snip / tool_use_summary 相关改动。
2. 审查 `query.ts` 的 snip compact / continuation / tool_result 来源相关改动。
3. 审查 `QueryEngine.ts` 的 compact boundary / tool_use_summary / snip replay 相关改动。
4. 审查 `compact.ts` 的 metadata / preservedSegment / boundary UUID 相关改动。
5. 输出保留、迁出、待评估清单。

## 明确不做

- 不在本 goal 中执行迁移。
- 不撤 provider/API 必要修改。
- 不把所有 snip/compact 改动自动归类为污染。
- 不修改 Desktop renderer。

## 验收标准

- [x] 不把 provider/API 必要修改误撤。
- [x] 不把 UI/恢复物化语义留在共享层。
- [x] 每个待评估项都有下一步验证命令或用户决策点。
- [x] 审查结论回填到 todo 后续记录或架构文档。

## 建议验证命令

```powershell
git diff --no-index --stat D:\agent_project\cc-haha-main\src\utils\messages.ts D:\agent_project\claude-code-reforged\src\utils\messages.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\query.ts D:\agent_project\claude-code-reforged\src\query.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\QueryEngine.ts D:\agent_project\claude-code-reforged\src\QueryEngine.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\services\compact\compact.ts D:\agent_project\claude-code-reforged\src\services\compact\compact.ts
```

## 完成后下一步

进入 [STD-HISTORY-12-7 第 3 层直接读取 transcript](./2026-05-25-std-history-12-7-materialization-direct-transcript-reader.md)。

## 执行结果

状态：已完成。

### 审查输入

本轮按文件与原始目录 `D:\agent_project\cc-haha-main` 做了差异核对：

```powershell
git diff --no-index --stat D:\agent_project\cc-haha-main\src\utils\messages.ts D:\agent_project\claude-code-reforged\src\utils\messages.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\query.ts D:\agent_project\claude-code-reforged\src\query.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\QueryEngine.ts D:\agent_project\claude-code-reforged\src\QueryEngine.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\services\compact\compact.ts D:\agent_project\claude-code-reforged\src\services\compact\compact.ts
```

差异规模：

| 文件 | 差异规模 | 审查结论 |
| --- | --- | --- |
| `src/utils/messages.ts` | 193 additions / 57 deletions | 保留 API/provider/tool pairing 正确性；`snip`、`tool_use_summary`、`toolTimingMetadata` 作为后续 adapter 边界继续收口。 |
| `src/query.ts` | 166 additions / 42 deletions | 保留主循环状态、tool_result 来源绑定、snip compact、continuation 类型化和中断补回。 |
| `src/QueryEngine.ts` | 385 additions / 55 deletions | 保留 SDK/runtime 事件校验、compact boundary SDK projection、转录持久化时机和 headless snip replay。 |
| `src/services/compact/compact.ts` | 67 additions / 22 deletions | 保留 compact 写侧事实、metadata 安全合并、preservedSegment 写入和流式兜底保护。 |

### 保留清单

| 保留项 | 代码位置 | 为什么属于共享正确性 |
| --- | --- | --- |
| ESM `createRequire` | `src/utils/messages.ts`、`src/query.ts`、`src/QueryEngine.ts`、`src/services/compact/compact.ts` | feature-gated 模块在 ESM `dist` 中仍通过 require-style 懒加载；这是 CLI/Core/SDK/compact 共享运行正确性，不是 UI 展示语义。 |
| API payload normalize | `src/utils/messages.ts` 的 `normalizeMessagesForAPI(...)`、`normalizeContentFromAPI(...)`、`normalizeAttachmentForAPI(...)` | 发送给 Anthropic / OpenAI-compatible / SDK 前必须规范化 tool input、server_tool_use、system content、附件和空文本；否则会触发模型 API 400 或 payload 语义漂移。 |
| tool timing metadata 剥离 | `src/utils/messages.ts` 的 `stripToolTimingMetadataFromUserMessage(...)` 和 assistant tool_use sanitize | 计时字段可以服务实时展示，但不能进入模型 API payload；剥离动作必须保留在 API 边界。 |
| tool_result pairing 防御 | `src/utils/messages.ts` 的 `ensureToolResultPairing(...)` | 缺失、重复、孤儿 tool_result 会直接破坏模型 API 协议；这里是请求前保护，不是历史 replay。 |
| `sourceToolAssistantUUID` 校验 | `src/query.ts` 的 `yieldMissingToolResultBlocks(...)` | 中断/异常补回 tool_result 时只允许带合法 UUID 来源，避免把坏 parent/source 写回 transcript。 |
| 主循环状态类型化 | `src/query.ts` 的 `terminal(...)` / `continuation(...)` | 让 collapse、reactive compact、max output recovery、token budget continuation 的状态转移显式化，减少用字符串散落判断。 |
| snip compact 结果归一 | `src/query.ts` 的 `normalizeSnipCompactResult(...)` 和 query loop snip 段 | `snipCompactIfNeeded(...)` 可能返回旧数组或结构化结果；归一后才能把 `tokensFreed` 正确传给 autocompact。 |
| 中断和 fallback 的 tool_result 补回 | `src/query.ts` abort / streaming fallback 路径 | 保证模型发出 tool_use 后，即使流中断、fallback 或 abort，也不会留下不成对 tool_result。 |
| SDK/runtime 事件运行时校验 | `src/QueryEngine.ts` 的 compact metadata、usage、stop_reason、api_retry、tool_use_summary、assistant last content guards | SDK 输出和 runtime stream event 都是不可信运行时数据，进入 SDK 协议前必须做字段校验。 |
| compact boundary SDK projection | `src/QueryEngine.ts` 的 `SDKCompactBoundaryMessage` 输出 | SDK consumer 需要知道 compact boundary，但只能在 metadata 合法时输出。 |
| 用户输入提前持久化 | `src/QueryEngine.ts` 提交用户消息后立即 `recordTranscript(...)` | 解决进程在模型响应前被杀时无法 resume 的问题；这是 transcript 持久化正确性。 |
| compact boundary 前 flush preserved tail | `src/QueryEngine.ts` compact boundary 写入前根据 `preservedSegment.tailUuid` flush | 确保 live preservedSegment 的 tail 已经落盘；否则恢复时 relink / materialization 缺事实。 |
| progress inline 持久化 | `src/QueryEngine.ts` progress 分支 | 防止 deferred progress 与已记录 tool_result 交错后造成链路分叉或孤儿恢复。 |
| compact metadata 安全合并 | `src/services/compact/compact.ts` 的 `getCompactMetadataRecord(...)` | compact metadata 是持久化外部数据，写入追加字段前必须确认是 object record。 |
| pre-compact discovered tools | `src/services/compact/compact.ts` 的 `addPreCompactDiscoveredTools(...)` | summary 不保留 tool_reference，post-compact API schema filter 仍需要知道压缩前已加载 deferred tool。 |
| preservedSegment 写入 | `src/services/compact/compact.ts` 的 `annotateBoundaryWithPreservedSegment(...)` | 写侧必须记录 head/anchor/tail，读侧和物化层才能正确应用 compact 语义。 |
| compact boundary UUID 校验 | `src/services/compact/compact.ts` 的 `toValidatedUuid(...)` / `anchorUuid` 检查 | boundary 和 preservedSegment 不能写入坏 UUID，否则后续恢复只能靠猜。 |
| compact streaming event guard | `src/services/compact/compact.ts` 的 `isStreamEventMessage(...)` / `isAssistantMessageEvent(...)` | streaming fallback 同时可能产出 system/assistant/stream event；必须运行时收窄。 |

### 不作为迁出项

这些改动容易看起来像“展示/恢复语义”，但本轮审查后不作为第 3 层迁出项：

- `src/QueryEngine.ts` 里的 `mutableMessages.splice(...)`：这是 SDK/headless 运行期内存释放，不裁 transcript，不裁 Desktop 历史 UI。
- `src/query.ts` 和 `src/QueryEngine.ts` 里的 `snip`：这是模型上下文投影和 headless 内存治理，不是 Desktop 历史 replay；但后续应收敛到更清晰的 snip adapter。
- `src/services/compact/compact.ts` 的 `preservedSegment` 写入：这是 compact 写侧事实，不是恢复物化层自己推导出来的产品语义。
- `src/utils/messages.ts` 的 `getMessagesAfterCompactBoundary(...)`：这是模型请求前的 compact/snip 投影 helper；恢复 UI 历史不应调用它来裁历史。

### 待评估清单

| 待评估项 | 当前判断 | 下一步 |
| --- | --- | --- |
| `tool_use_summary` | 短期保留。它现在是 SDK/mobile/provider 输出协议的一部分，不是 Desktop 历史 UI 卡片；但长期应抽到 SDK output adapter，避免污染通用 message union。 | Goal 10 文档收口时记录 adapter 方向；验证 `npm.cmd run smoke:provider-output-fixtures`。 |
| `toolTimingMetadata` | 剥离逻辑必须保留；但计时元数据长期更适合 display lifecycle / tool lifecycle 事件，而不是扩大 transcript message content 的含义。 | 后续 Desktop 手工回归后单独建清理项；验证 `npm.cmd run smoke:desktop-display-events`。 |
| `context_efficiency` / snip 提示 | 短期保留在 feature-gated snip 路径；它是模型上下文提示，不是 UI 文案。长期应让 snip 模块拥有提示文案和投影入口，`messages.ts` 只调用稳定 adapter。 | Goal 10 文档收口时补 adapter 边界；验证 `npm.cmd run smoke:conversation-materialization` 和 snip 相关 fixture。 |

### 结论

四个文件没有发现新的“必须马上从共享层迁到第 3 层”的 Desktop/UI 恢复物化语义。
需要继续迁出的主线仍是前面已处理或后续 Goal 7/8 要处理的内容：原始 transcript ordered view、current context tail、display replay、legacy chain helper 边界。

本 goal 后续动作：

1. Goal 7 让第 3 层直接读取原始 transcript，进一步降低对第 2 层 reader/helper 的依赖。
2. Goal 8 明确 `buildConversationChain(...)` 只作为短期 helper，不再扩展恢复主路径语义。
3. Goal 10 将 `snip`、`tool_use_summary`、`toolTimingMetadata` 的长期 adapter 边界写入规则/文档。

### 验证记录

本 goal 只更新审计文档，不修改源码。已执行：

```powershell
git diff --no-index --stat D:\agent_project\cc-haha-main\src\utils\messages.ts D:\agent_project\claude-code-reforged\src\utils\messages.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\query.ts D:\agent_project\claude-code-reforged\src\query.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\QueryEngine.ts D:\agent_project\claude-code-reforged\src\QueryEngine.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\services\compact\compact.ts D:\agent_project\claude-code-reforged\src\services\compact\compact.ts
```

待 TODO 回写后执行：

```powershell
git diff --check
python C:\Users\luoji\.codex\skills\standard-todo-runner\scripts\read_standard_todo.py --gate D:\agent_project\claude-code-reforged\docs\stages\session-materialization-boundary-cleanup-todo.md
```
