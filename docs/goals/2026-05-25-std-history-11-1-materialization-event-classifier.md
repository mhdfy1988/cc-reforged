# Goal: STD-HISTORY-11-1 物化层事件分类器

## 目标

在 `conversationMaterialization.ts` 内部，从 ordered transcript 视图生成分类事件，让恢复、上下文组装、展示投影和诊断先消费同一套事件分类结果。

本 goal 解决的是“同一个 transcript message 到底是什么语义”的问题。

## 为什么先做这个

当前恢复逻辑仍容易把 `tool_result` user message、compact boundary、sidechain、系统辅助事件和普通用户输入混在一起。只要没有分类层，后续 tail 解析、工具绑定、compact 诊断都会继续靠局部判断打补丁。

## 范围

1. 新增 transcript event 分类类型。
2. 分类至少覆盖：
   - 用户输入
   - 助手回复
   - 工具调用
   - 工具结果
   - 压缩边界
   - sidechain
   - 系统辅助事件
   - 异常诊断事件
3. 明确只有普通用户输入和助手回复能推进当前会话尾部。
4. 工具调用和工具结果按来源 ID 绑定，不参与尾部竞争。
5. 分类结果进入物化诊断。

## 明确不做

- 不改写原始 transcript。
- 不修改 Claude Code 原生写入层。
- 不替换 current context tail。
- 不改 Renderer 展示。

## 验收标准

- [x] 纯 `tool_result` user message 被分类为工具结果，不再被当成普通用户输入。
- [x] sidechain message 不推进当前会话尾部。
- [x] compact boundary 不推进当前会话尾部。
- [x] 分类诊断包含 `rawIndex`、`uuid`、`parentUuid`、`sourceToolAssistantUUID` 和事件类别。
- [x] 分类逻辑不恢复最长链兜底。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:conversation-materialization
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-11-2 当前上下文尾部解析](./2026-05-25-std-history-11-2-current-context-tail-resolution.md)。

## 执行结果

状态：已完成。

完成内容：

- `MaterializedConversation` 新增 `classifiedTranscriptEvents`。
- 新增 `MaterializedTranscriptEventKind` / `MaterializedTranscriptEvent`，覆盖用户输入、助手回复、工具调用、工具结果、压缩边界、sidechain、系统辅助事件和诊断事件。
- 新增 `transcript_events_classified` 诊断摘要，包含分类计数和前 20 条样本，样本保留 `rawIndex`、`uuid`、`parentUuid`、`sourceToolAssistantUUID`、事件类别、`contentIndex`、`toolUseId` 和 `advancesMainTail`。
- `tool_result` only 的 user message 只生成 `tool_result` 分类事件，不生成 `user_input`。
- compact boundary、sidechain、工具调用和工具结果都标记为不推进当前主线尾部。
- 原始 transcript 只读，没有改写 JSONL 或 Claude Code 原生层。
- `smoke-conversation-materialization` 增加分类事件用例，覆盖工具结果、工具调用、compact boundary 和 sidechain。

验证：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:conversation-materialization`：通过。
- `git diff --check`：通过。
