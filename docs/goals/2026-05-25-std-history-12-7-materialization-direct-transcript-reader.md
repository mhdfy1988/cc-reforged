# Goal: STD-HISTORY-12-7 第 3 层直接读取 transcript

## 目标

`conversationMaterialization.ts` 自己从原始 transcript JSONL 生成 ordered event model。

本 goal 解决的是“第 3 层不应该借第 2 层完整 `loadTranscriptFile(...)` 结果来获得 CCR 物化输入”的问题。

## 为什么要做

Desktop 历史恢复外部已经走第 3 层，但第 3 层内部仍依赖 `loadTranscriptFile(...)` 和 `buildConversationChain(...)` 的读链路。后续应让第 3 层直接从原始 transcript 事实源生成 ordered events，再分别投影模型上下文和 UI 历史。

## 范围

1. 自己读取 transcript JSONL。
2. 自己保留 `rawIndex`。
3. 自己处理坏行诊断。
4. 自己分类 user / assistant / tool_use / tool_result / compact_boundary / sidechain / system_event。
5. 自己输出 `currentContextMessages`、`displayReplayEvents`、`diagnostics`。

## 明确不做

- 不改写 transcript JSONL。
- 不新增污染原始 JSONL 的 CCR 字段。
- 不立即删除 `buildConversationChain(...)` helper。
- 不改变 Renderer 展示协议。

## 验收标准

- [x] 第 3 层不依赖 `loadTranscriptFile(...)` 的 ordered/rawIndex 返回值。
- [x] Desktop 历史恢复仍走第 3 层。
- [x] Core 恢复上下文和 App Server display snapshot 同源。
- [x] 坏行诊断、compact 诊断、tool_result 分类仍可用。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:app-server
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-12-8 buildConversationChain helper 边界](./2026-05-25-std-history-12-8-buildconversationchain-helper-boundary.md)。

## 执行结果

状态：已完成。

### 修改内容

本 goal 不重写 transcript JSONL，也不删除第 2 层原生修复 helper。实际收口点是把第 3 层的物化输入边界钉死：

1. `conversationMaterialization.ts` 继续通过 `loadTranscriptMaterializationView(...)` 直接读取原始 JSONL。
2. `parseTranscriptJsonlWithRawIndex(...)` 负责保留物理 `rawIndex` 和坏行诊断。
3. `classifyTranscriptEvents(...)` 负责按物理顺序分类 `user_input`、`assistant_response`、`tool_use`、`tool_result`、`compact_boundary`、`sidechain`、`system_event`。
4. `materializeConversationFromLoadedTranscript(...)` 不再从 `loaded.orderedMessages` / `loaded.malformedJsonlLines` 读取旧兼容字段；这些字段不再是第 2 层契约。
5. `scripts/smoke-conversation-materialization.mjs` 的 `loadedTranscript(...)` fixture 不再伪造 `orderedMessages` / `malformedJsonlLines`，避免测试继续依赖旧口子。

### 边界说明

`loadTranscriptFile(...)` 仍短期提供原生修复后的 `messages` map 和 metadata，例如 preservedSegment relink、tool_result 补回、content replacement、session metadata。
但 ordered/rawIndex、坏行诊断、display replay、分类事件这些 CCR 物化语义只属于第 3 层。

这意味着：

- 第 2 层可以继续作为原生读侧修复层。
- 第 3 层拥有自己的 ordered transcript view。
- 后续 Goal 8 再明确 `buildConversationChain(...)` 只作为短期 helper，不再扩展恢复主路径。

### 验证记录

已通过：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:app-server
```
