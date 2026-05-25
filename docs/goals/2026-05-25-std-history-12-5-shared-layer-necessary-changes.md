# Goal: STD-HISTORY-12-5 共享层必要修改保留清单

## 目标

保留 provider/API/SDK/UUID/tool pairing/compact metadata/transcript 存储一致性等共享正确性修改。

本 goal 解决的是“不要为了瘦身原始层，把真正必要的共享修复误撤”的问题。

## 为什么要做

原始 Claude Code 层不是绝对冻结。多 provider 接入、模型 API payload、SDK 输出、compact metadata 校验这类能力必须统一，否则 Desktop、Core、CLI/TUI、App Server 会出现不同兼容行为。

## 范围

1. 保留 `sourceToolAssistantUUID` UUID 校验，或说明替代方案。
2. 保留 compact metadata 安全读取，或说明替代方案。
3. 保留 SDK compact boundary 输出校验，或说明替代方案。
4. 保留 ESM `createRequire` 兼容，或说明替代方案。
5. 保留模型 API payload 正确性相关修复，或说明替代方案。

## 明确不做

- 不把 UI 展示专用语义列为共享正确性。
- 不把 current tail、ordered/rawIndex、display replay 列为共享正确性。
- 不未经验证撤掉 provider/API 修复。

## 验收标准

- [x] 每项保留项都有代码位置和原因。
- [x] 每项保留项都不是 UI 展示专用语义。
- [x] 不影响多 provider / SDK / CLI/TUI 基础路径。
- [x] 待用户确认项被明确列出。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:cli-model
npm.cmd run smoke:app-server
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-12-6 原始共享层逐项审查](./2026-05-25-std-history-12-6-shared-layer-file-audit.md)。

## 执行结果

状态：已完成。

### 保留清单

| 保留项 | 代码位置 | 为什么必须保留 | 是否 UI 专用 |
| --- | --- | --- | --- |
| `sourceToolAssistantUUID` UUID 校验 | `src/utils/sessionStorage.ts`、`src/query.ts`、`src/utils/messages.ts` | 并行工具和 tool_result 补回需要把结果绑定到来源 tool_use；来源字段来自 transcript / runtime message，必须先校验 UUID，避免错误 parentUuid 或孤儿结果污染恢复。 | 否 |
| tool_result pairing 修复 | `src/utils/messages.ts` 的 `ensureToolResultPairing(...)`、`SYNTHETIC_TOOL_RESULT_PLACEHOLDER` | 多 provider / SDK 都要求 tool_use 与 tool_result 成对；缺失、重复、孤儿结果会导致模型 API 400 或恢复后立刻失败。 | 否 |
| compact metadata 安全读取 | `src/services/compact/compact.ts`、`src/utils/sessionStorage.ts`、`src/QueryEngine.ts` | compact boundary / preservedSegment 是恢复当前模型上下文的事实依据；metadata 来自持久化 transcript 和运行时消息，必须运行时校验。 | 否 |
| SDK compact boundary 输出校验 | `src/QueryEngine.ts` 的 compact boundary SDK projection、`toSDKCompactMetadata(...)` 调用前校验 | SDK 输出属于外部消费协议，不能把不完整 compact metadata 直接发给 SDK consumer。 | 否 |
| ESM `createRequire` 兼容 | `src/utils/messages.ts`、`src/query.ts`、`src/QueryEngine.ts`、`src/services/compact/compact.ts` | 这些文件运行在 ESM 构建产物中，feature-gated 模块仍有 require-style 加载；没有 `createRequire(import.meta.url)` 会在 dist/CLI 路径失败。 | 否 |
| 模型 API payload normalize | `src/utils/messages.ts` 的 `normalizeToolInputForAPI(...)`、`server_tool_use`、system content normalize、tool timing metadata strip | OpenAI-compatible / Anthropic / SDK provider 对 payload 结构要求不同；发送前需要统一规范化并剥离内部显示/计时元数据。 | 否 |
| QueryEngine runtime event guards | `src/QueryEngine.ts` 的 usage、stop_reason、api_retry、tool_use_summary、assistant last content 校验 | 流式事件和 SDK/runtime message 是运行时不可信数据；必须在进入状态机和 SDK 输出前收窄。 | 否 |
| query loop continuation / snip result normalize | `src/query.ts` 的 typed terminal/continuation、`normalizeSnipCompactResult(...)` | 主循环状态必须稳定，snip 结果可能来自 feature-gated 模块；这里是模型上下文和工具循环正确性，不是展示投影。 | 否 |
| compact boundary preservedSegment 写入 | `src/services/compact/compact.ts` 的 `annotateBoundaryWithPreservedSegment(...)`、boundary UUID 校验 | compact 写入阶段必须记录 live preservedSegment，恢复阶段才有足够事实做 relink 和当前上下文投影。 | 否 |

### 明确不列为共享正确性

以下能力已经或应该迁到第 3 层物化，不再作为原始共享层保留理由：

- ordered transcript view / `rawIndex`
- malformed JSONL diagnostics for display/materialization
- `displayReplayEvents`
- `currentContextTailUuid`
- `canonicalLeafUuid` 的 CCR 产品语义
- compact 后当前上下文裁剪
- 多 main leaf 普通恢复兜底

### 待用户确认项

本 goal 没有需要用户现场决策的保留项。

仍需 Goal 6 继续逐项审查的灰区：

1. `tool_use_summary` 是否完全属于 SDK/mobile/provider 协议，还是夹带部分 UI 摘要语义。
2. `toolTimingMetadata` 是否长期保存在 transcript，还是后续迁移到 display lifecycle 专用事件。
3. `context_efficiency` / snip 相关提示是否属于通用模型上下文能力，还是需要拆出更清晰的 adapter。

### 验证入口

这些保留项由以下 smoke 覆盖：

- `npm.cmd run smoke:cli-model`
- `npm.cmd run smoke:app-server`
- `npm.cmd run smoke:provider-tool-profile`
- `npm.cmd run smoke:provider-output-fixtures`
- `npm.cmd run smoke:openai-chat-protocol`
- `npm.cmd run smoke:conversation-materialization`

### 验证记录

本 goal 只产出保留清单，不修改源码。

已补跑：

```powershell
npm.cmd run smoke:provider-tool-profile
npm.cmd run smoke:provider-output-fixtures
npm.cmd run smoke:openai-chat-protocol
git diff --check
```

同时，本轮前序 goal 已通过：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:cli-model
npm.cmd run smoke:app-server
npm.cmd run smoke:conversation-materialization
```

结果：全部通过。
