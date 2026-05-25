# Goal: STD-HISTORY-10-4 历史快照内容块级归并

## 目标

把历史恢复展示从 message 级映射改成内容块级归并，让一个 transcript message 可以生成多个展示项。

一个工具调用对应一条工具展示项，这是协议层不变式。

## 为什么先做这个

旧的 message 级展示投影会把一个含多个 `tool_use` 的 assistant message 压成一条展示项，导致后续结果无法逐个回填，也会丢第二个及之后的工具。

## 第一版范围

1. 审查 `threadDisplay.ts` 历史快照构建路径。
2. 文本内容生成 user / assistant message 展示项。
3. 每个 `tool_use` 生成或更新一个工具展示项。
4. 每个 `tool_result` 按来源 ID 回填工具展示项。
5. compact boundary 生成轻量系统提示卡。
6. 工具项 ID 使用 `tool:${toolUseId}`。
7. 孤立工具结果 ID 使用 `orphan-tool-result:${messageUuid}:${contentIndex}`。

## 明确不做

- 不在历史快照层视觉归组工具卡。
- 不让展示投影层承担多工具拆分职责。
- 不把 compact boundary 当作裁剪 UI 历史的依据。

## 验收标准

- [ ] 一个 assistant message 内多个 `tool_use` 能生成多个工具展示项。
- [ ] `ThreadDisplayItem.identity` 能表达 `toolUseId`、`messageUuid`、`rawIndex`、`contentIndex`。
- [ ] 历史 snapshot 与实时完成后的最终展示项数量一致。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:app-server
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-10-5 展示投影单展示项单主语义](./2026-05-24-std-history-10-5-display-projection-single-item.md)。

## 执行结果

状态：已完成。

完成内容：

- `buildThreadDisplaySnapshot(...)` 不再直接 `messages.map(...)` 一条消息一条展示项。
- 含 `tool_use` / `tool_result` 的历史消息改为内容块级处理。
- 每个 `tool_use` 生成独立 `tool:${toolUseId}` 展示项。
- 每个 `tool_result` 通过来源 ID 回填对应工具展示项。
- `ThreadDisplayItem.identity` 补充 `rawIndex`、`materializedIndex`、`contentIndex`。
- `scripts/smoke-app-server.mjs` 增加 `thread/display/snapshot_parallel_tool_split` 覆盖。

验证：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:app-server`：通过。
- `git diff --check`：通过。
