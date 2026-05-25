# Goal: STD-HISTORY-10-6 实时增量补丁接入工具生命周期

## 目标

让实时 `thread/display/patch` 和历史 `ThreadDisplaySnapshot` 使用同一套工具生命周期语义。

实时工具开始 append 工具展示项，工具结果回来 update / complete 同一展示项。

## 为什么先做这个

此前问题的根源之一是实时展示和历史恢复走两条路。只修历史 snapshot，不修实时 patch，会继续出现刷新前后不一致。

## 第一版范围

1. patch append / update / complete 使用同一 `toolUseId` 和 itemId。
2. 实时工具开始时 append 工具展示项。
3. 实时工具结果回来时 update / complete 同一工具展示项。
4. result 先于 call 到达时进入 pending-orphan 诊断状态。
5. permission / cancelled / turn failed / compacted 都通过展示增量补丁进入同一归并器。
6. 确认旧展示通知没有绕过主路径。

## 明确不做

- 不新增第二套实时工具合并逻辑。
- 不让 Renderer 根据 raw event 自己找工具来源。
- 不恢复旧 `item/*` 展示通知主路径。

## 验收标准

- [x] 页面刷新前后工具卡数量、顺序、状态一致。
- [x] 实时和历史都不会出现同一个工具调用两张卡。
- [x] 旧实时通知不会绕过展示增量补丁直接进入 Renderer。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:desktop-display-events
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-10-7 Renderer 状态归并收口](./2026-05-24-std-history-10-7-renderer-state-merge-cleanup.md)。

## 执行结果

状态：已完成。

完成内容：

- `coreEventToThreadDisplayPatch(...)` 的 `item_started` / `item_completed` 工具内容接入 `ToolDisplayLifecycleReducer`。
- 实时 `tool_use` 生成稳定 `tool:${toolUseId}` 展示项；`tool_result` 按来源 ID `complete_item` 同一展示项。
- `tool_result` 先于 `tool_use` 或来源不存在时生成诊断错误卡，不再伪装成普通工具结果。
- 实时工具投影保留完成时间和耗时 metadata，避免桌面显示事件丢失 timing 字段。
- `scripts/smoke-app-server.mjs` 增加 `thread/display/patch_parallel_tool_lifecycle`，覆盖实时并行工具、乱序结果和孤立结果诊断。

验证：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:app-server`：通过。
- `npm.cmd run smoke:desktop-display-events`：通过。
- `git diff --check`：通过。
