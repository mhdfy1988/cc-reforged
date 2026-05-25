# Goal: STD-HISTORY-10-2 当前模型上下文与可见历史双投影

## 目标

让同一个 transcript 解释层输出两个明确投影：

- `currentContextMessages`：Core 继续对话使用的当前模型上下文。
- `displayReplayEvents`：App Server 恢复 UI 可见历史使用的展示回放事件。

compact / snip / sidechain 语义可以影响当前模型上下文，但不能把 UI 可见历史裁掉。

## 为什么先做这个

之前的问题反复出现，本质是 Core resume 和 App Server replay 读出了不同语义的数据，或者把压缩后的模型上下文误当成完整 UI 历史。

这个 goal 先把两个投影写清楚，后续工具归并器才能同时服务历史快照和实时增量补丁。

## 第一版范围

1. `conversationMaterialization.ts` 显式输出当前模型上下文。
2. `conversationMaterialization.ts` 显式输出可见历史回放事件。
3. 保留兼容字段时必须标注语义。
4. compact boundary 只缩短当前模型上下文。
5. 多 main leaf 输出诊断，不静默选最长。

## 明确不做

- 不把两个投影合并成一个 `messages` 数组。
- 不用 UI 展示条数推导 Core context。
- 不改原始 transcript 语义。

## 验收标准

- [ ] compact 后 Core context 变短。
- [ ] compact 后 UI 历史仍可展示压缩前可见内容。
- [ ] `thread/resume` 不再把 Core 当前上下文当完整 UI 历史。
- [ ] 多 main leaf 只输出诊断，不走最长链兜底。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:conversation-materialization
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-10-3 工具来源 ID 绑定归并器](./2026-05-24-std-history-10-3-tool-source-binding-reducer.md)。

## 执行结果

状态：已完成。

完成内容：

- `MaterializedConversation` 新增 `currentContextMessages`，作为 Core 继续对话使用的当前模型上下文。
- `MaterializedConversation` 新增 `displayReplayEvents`，作为 App Server 恢复 UI 可见历史使用的展示回放事件。
- 兼容字段 `messages` 已标注为 deprecated，语义等同 `currentContextMessages`。
- `handleThreadResume(...)` 不再独立读取一套 display replay，而是消费 `materializeConversationFromTranscript(...)` 的双投影结果。
- `smoke-conversation-materialization` 增加断言：compact 后当前模型上下文变短，但可见历史回放仍包含 compact 前内容。

验证：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:conversation-materialization`：通过。
- `git diff --check`：通过。
