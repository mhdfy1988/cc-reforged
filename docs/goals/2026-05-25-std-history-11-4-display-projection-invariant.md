# Goal: STD-HISTORY-11-4 展示投影不变式保护

## 目标

确认 current context 修复不会影响 UI 可见历史。历史恢复和实时展示继续从 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 生成，不从 current context 反推 UI 历史。

## 为什么要做

上下文压缩会改变模型继续对话用的 current context，但不代表 UI 历史要被删除。此前反复混淆“当前模型上下文”和“UI 可见历史”，导致恢复后 compact 前内容消失、压缩卡片和 summary 展示不合理。

## 范围

1. 确认 `displayReplayEvents` / `ThreadDisplaySnapshot` 从完整可见历史投影生成。
2. compact boundary 只显示轻量提示或分隔项。
3. compact summary 可以作为模型上下文内容，但 UI 展示不应把它误当普通用户消息。
4. 工具展示继续走 `toolDisplayLifecycle` 和来源 ID 绑定。
5. Renderer 不新增 raw transcript fallback。

## 明确不做

- 不把 current context 当完整 UI 历史。
- 不在 Renderer 解析 `parentUuid`。
- 不为了显示 compact summary 而裁掉 boundary 前 UI 历史。
- 不改 Claude Code 原始 compact 语义。

## 验收标准

- [x] compact 前历史内容恢复后仍可见，或按产品设计折叠展示。
- [x] 历史 snapshot 和实时 patch 的工具卡绑定语义一致。
- [x] 缺 projection / 孤立工具结果只显示诊断，不伪装成正常工具卡。
- [x] UI 展示不会反向改变 current context。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:app-server
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-11-5 冒烟与真实样本覆盖](./2026-05-25-std-history-11-5-smoke-real-fixtures.md)。

## 执行结果

状态：已完成。

完成内容：

- 本阶段未改 Renderer 展示主路径，也未新增 raw transcript fallback。
- 已确认 `materializeConversationFromTranscript(...)` 仍单独从 transcript 原文读取 `displayReplayEvents`，compact 只影响 current context，不裁剪 UI 可见历史。
- 既有 conversation materialization smoke 继续断言 compact 前旧消息仍存在于 `displayReplayEvents`。
- App Server smoke 覆盖 `thread/display/snapshot_thread_messages`、`thread/display/snapshot_materialized_resume`、`thread/display/hides_compact_internal_messages`、`thread/display/compact_notice`、`tool/display/lifecycle_source_binding`、`thread/display/snapshot_parallel_tool_split` 和 `thread/display/patch_parallel_tool_lifecycle`。
- Desktop display events smoke 继续通过，说明 Renderer 展示协议入口未被 current context 改造影响。

验证：

- `npm.cmd run smoke:app-server`：通过。
- `npm.cmd run smoke:desktop-display-events`：通过。
