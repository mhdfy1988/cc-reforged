# Goal: STD-HISTORY-12-0 原始层改动清单

## 目标

把当前仓库和 `D:\agent_project\cc-haha-main` 的会话相关差异分成三类：保留、迁出、待评估。

本 goal 解决的是“哪些改动是共享正确性，哪些只是 CCR 物化语义误入原始层”的边界问题。

## 为什么先做这个

如果不先列清单，后续很容易把必要的 provider/API/SDK 修复误撤，或者继续把 Desktop/App Server 展示语义留在 `sessionStorage.ts` 这类原始共享层里。

## 范围

1. 对比 `src/utils/sessionStorage.ts`。
2. 对比 `src/utils/conversationRecovery.ts`。
3. 对比 `src/utils/messages.ts`。
4. 对比 `src/query.ts`。
5. 对比 `src/QueryEngine.ts`。
6. 对比 `src/services/compact/compact.ts`。
7. 输出保留、迁出、待评估三类清单。

## 明确不做

- 不修改代码。
- 不回滚任何改动。
- 不根据印象判断去留，必须基于原始版对照和当前调用链。
- 不把 App Server / Desktop 新增层误判成原始层污染。

## 验收标准

- [x] 每一项原始层改动都有去留判断。
- [x] 每一项保留理由都绑定共享正确性证据。
- [x] 每一项迁出项都说明目标落点。
- [x] 每一项待评估项都有验证命令或用户决策点。

## 建议验证命令

```powershell
git diff --no-index --stat D:\agent_project\cc-haha-main\src\utils\sessionStorage.ts D:\agent_project\claude-code-reforged\src\utils\sessionStorage.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\utils\conversationRecovery.ts D:\agent_project\claude-code-reforged\src\utils\conversationRecovery.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\utils\messages.ts D:\agent_project\claude-code-reforged\src\utils\messages.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\query.ts D:\agent_project\claude-code-reforged\src\query.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\QueryEngine.ts D:\agent_project\claude-code-reforged\src\QueryEngine.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\services\compact\compact.ts D:\agent_project\claude-code-reforged\src\services\compact\compact.ts
```

## 完成后下一步

进入 [STD-HISTORY-12-1 收回 sessionStorage ordered/rawIndex](./2026-05-25-std-history-12-1-sessionstorage-ordered-rawindex-extraction.md)。

## 执行结果

状态：已完成。

### 对照范围

已用 `git diff --no-index --stat` 对照当前仓库和 `D:\agent_project\cc-haha-main`：

| 文件 | 差异规模 | 初步结论 |
| --- | ---: | --- |
| `src/utils/sessionStorage.ts` | 583 insertions / 144 deletions | 同时包含共享正确性修复和第 3 层物化语义，需要拆分。 |
| `src/utils/conversationRecovery.ts` | 119 insertions / 42 deletions | 已接入物化层，是 CCR 恢复 facade 候选，边界在 Goal 4 定稿。 |
| `src/utils/messages.ts` | 193 insertions / 57 deletions | 主要是 API payload、tool pairing、snip 和 hook 类型安全，整体偏共享正确性。 |
| `src/query.ts` | 166 insertions / 42 deletions | 主要是 tool_result 补回、snip 结果归一、continuation 类型和运行时保护，整体偏共享正确性。 |
| `src/QueryEngine.ts` | 385 insertions / 55 deletions | 主要是 SDK 事件运行时校验、compact metadata 校验、snip replay 保护，整体偏共享正确性。 |
| `src/services/compact/compact.ts` | 67 insertions / 22 deletions | 主要是 compact boundary metadata、preservedSegment 和 UUID 安全，应该保留。 |

### 保留：共享正确性修复

这些改动不属于 Desktop/App Server 展示诉求，不应为了“原始层只读”误撤。

1. `sourceToolAssistantUUID` / tool_result 来源 UUID 校验
   - 位置：`src/utils/sessionStorage.ts`、`src/query.ts`、`src/utils/messages.ts`。
   - 原因：并行工具和 tool_result 补回依赖来源绑定，输入来自 transcript/API/运行时消息，必须先校验 UUID。
   - 后续：Goal 5 继续列明证据，Goal 6 做逐项 smoke。

2. Agent sidechain 写入和 transcript entry 运行时校验
   - 位置：`src/utils/sessionStorage.ts`。
   - 原因：这是写入/恢复 agent sidechain 的原生存储正确性，不是 UI 展示语义。
   - 后续：保留，但不允许继续在这里添加 UI replay、ordered/rawIndex、current tail 职责。

3. compact boundary / preservedSegment metadata 安全读写
   - 位置：`src/services/compact/compact.ts`、`src/QueryEngine.ts`、`src/utils/sessionStorage.ts`。
   - 原因：compact 生成和 SDK 输出都要带合法 metadata；这个 metadata 会影响模型上下文恢复，不是纯 UI。
   - 后续：保留 metadata 生成和安全读取；compact 后“当前上下文裁剪”迁到第 3 层。

4. SDK / provider payload 运行时校验
   - 位置：`src/QueryEngine.ts`、`src/utils/messages.ts`。
   - 包含：usage、stop_reason、api_retry、tool_use_summary、system compact boundary、server_tool_use、system content、tool timing metadata strip。
   - 原因：外部模型/SDK/持久化消息都属于运行时不可信数据，不能只靠 TypeScript interface。
   - 后续：Goal 6 继续确认每项是否仍有调用方和 smoke 覆盖。

5. ESM `createRequire` 与 feature-gated snip 保护
   - 位置：`src/utils/messages.ts`、`src/query.ts`、`src/QueryEngine.ts`、`src/services/compact/compact.ts`。
   - 原因：这些文件运行在 ESM 构建产物里，feature-gated CommonJS-style require 需要适配；snip 模块缺字段时应降级。
   - 后续：保留，验证由 typecheck/build 覆盖。

6. query loop 状态类型和错误降级
   - 位置：`src/query.ts`。
   - 包含：typed terminal/continuation、snip compact result 归一、skill prefetch unavailable 降级为 warning、CHICAGO_MCP cleanup gate。
   - 原因：属于主循环状态和工具执行稳定性，不是历史展示投影。

### 迁出：第 3 层物化语义

这些改动已经在功能上有用，但位置不对；目标是迁到 `src/utils/conversationMaterialization.ts` 或其私有 helper。

1. ordered transcript view / rawIndex
   - 当前位置：`src/utils/sessionStorage.ts` 的 `OrderedTranscriptMessage`、`TranscriptMalformedJsonlLine`、`ParsedJsonlLine`、`parseJSONLWithRawIndex(...)`、`countJsonlLinesBeforeOffset(...)`、`createOrderedTranscriptMessages(...)`、`loadTranscriptFile(...)` 返回值里的 `orderedMessages` / `malformedJsonlLines`。
   - 问题：这是 CCR 物化层需要的事件顺序视图，不应该污染底层 transcript reader。
   - 目标落点：Goal 1 / Goal 7，把 JSONL 顺序读取和坏行诊断迁到 `conversationMaterialization.ts`。

2. compact 后当前模型上下文裁剪
   - 当前位置：`src/utils/sessionStorage.ts` 的 `loadTranscriptFile(...)` compact scan / `rawIndexBase` / 普通 compact boundary prune 相关路径，以及 `applyPreservedSegmentRelinks(...)` 里超出 preservedSegment relink 的裁剪语义。
   - 问题：compact 是“当前模型上下文变小”，不是 UI 历史裁掉，也不是底层 reader 永久裁掉旧消息。
   - 目标落点：Goal 2，把 compact boundary 应用放到 `conversationMaterialization.ts` 的当前上下文投影里；UI 展示继续从 ordered events 投影完整历史。

3. `loadFullLog(...)` / 历史列表 leaf 策略
   - 当前位置：`src/utils/sessionStorage.ts` 的 main leaf 判断、`keepAllLeaves`、多 leaf 日志项、`sessionId:leafUuid` 去重。
   - 问题：leaf / canonical tail 是 CCR 恢复诊断和物化结果，不应由底层 log reader 作为产品语义兜底。
   - 目标落点：Goal 3，把 current tail 只放在第 3 层；多 main leaf 输出 diagnostic，不作为普通恢复 fallback。

4. materialization 对 `loadTranscriptFile(...)` 扩展字段的依赖
   - 当前位置：`src/utils/conversationMaterialization.ts` 仍从 `loadTranscriptFile(...)` 消费 `orderedMessages` / `malformedJsonlLines`。
   - 问题：这会让第 3 层名义上统一，实际仍依赖第 2 层新增产品字段。
   - 目标落点：Goal 7，第 3 层直接读原始 JSONL 并生成 `classifiedTranscriptEvents`、`currentContextMessages`、`displayReplayEvents`、`diagnostics`。

### 待评估：需要后续 goal 定稿

1. `conversationRecovery.ts` 是否作为 CCR 统一恢复 facade
   - 当前状态：`loadMessagesFromJsonlPath(...)` 和 `loadConversationForResume(...)` 已接入 `materializeConversationFromTranscript(...)`。
   - 待评估点：如果它是 CCR fork 的统一恢复 facade，可以保留；如果还要服务原始 CLI/TUI 兼容路径，需要拆出 Core/App Server 专用入口。
   - 后续：Goal 4 列调用方并定稿。

2. `messages.ts` / `query.ts` / `QueryEngine.ts` / `compact.ts` 中的 snip、tool_use_summary、tool timing、context_efficiency 细项
   - 当前判断：整体偏共享正确性，但仍需逐项确认没有夹带 UI 展示投影。
   - 后续：Goal 6 按调用方和 smoke 审查。

3. `buildConversationChain(...)` 并行工具 sibling 补回
   - 当前判断：短期保留为第 3 层 helper，避免一次迁移破坏并行工具恢复。
   - 待评估点：helper 不能继续决定 current tail，也不能继续扩展 ordered/rawIndex/UI replay 职责。
   - 后续：Goal 8 明确退场条件。

### 验证记录

已执行：

```powershell
git diff --no-index --stat D:\agent_project\cc-haha-main\src\utils\sessionStorage.ts D:\agent_project\claude-code-reforged\src\utils\sessionStorage.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\utils\conversationRecovery.ts D:\agent_project\claude-code-reforged\src\utils\conversationRecovery.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\utils\messages.ts D:\agent_project\claude-code-reforged\src\utils\messages.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\query.ts D:\agent_project\claude-code-reforged\src\query.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\QueryEngine.ts D:\agent_project\claude-code-reforged\src\QueryEngine.ts
git diff --no-index --stat D:\agent_project\cc-haha-main\src\services\compact\compact.ts D:\agent_project\claude-code-reforged\src\services\compact\compact.ts
```

下一步进入 [STD-HISTORY-12-1 收回 sessionStorage ordered/rawIndex](./2026-05-25-std-history-12-1-sessionstorage-ordered-rawindex-extraction.md)。
