# Goal: STD-HISTORY-10-3 工具来源 ID 绑定归并器

## 目标

实现工具调用和工具结果的来源 ID 绑定语义：

```text
tool_use.id == tool_result.tool_use_id
```

工具卡位置由 `tool_use` 首次出现决定；`tool_result` 只回填对应工具卡，不参与会话 leaf 竞争。

## 为什么先做这个

并行工具场景下，同一个 assistant message 可以包含多个 `tool_use`，多个 `tool_result` 的返回顺序也可能不同。只按消息顺序、返回顺序或 parentUuid 链路合并都会错绑。

因此必须把工具生命周期切到来源 ID。

## 第一版范围

1. 归一化工具调用 ID。
2. 归一化工具结果来源 ID。
3. 新增工具生命周期归并器。
4. 支持同一 assistant message 内多个工具调用。
5. 支持同一 user message 内多个工具结果。
6. 支持结果乱序返回。
7. 缺来源或来源不存在时生成孤立工具结果诊断项。

## 明确不做

- 不把多个工具合并成一条协议展示项。
- 不让结果返回顺序决定工具卡位置。
- 不把 `tool_result` 当 leaf。

## 验收标准

- [ ] `tool_result B` 先回来、`tool_result A` 后回来时，B / A 分别回填正确工具项。
- [ ] 工具展示顺序仍按 `tool_use A`、`tool_use B` 首次出现顺序。
- [ ] 同一工具调用不会生成两张卡。
- [ ] orphan result 只生成诊断项。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:app-server
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-10-4 历史快照内容块级归并](./2026-05-24-std-history-10-4-history-block-level-snapshot.md)。

## 执行结果

状态：已完成。

完成内容：

- 新增 `src/app-server/toolDisplayLifecycle.ts`。
- 实现 `normalizeToolUseIdFromBlock(...)` 和 `normalizeToolResultSourceIdFromBlock(...)`。
- 实现 `ToolDisplayLifecycleReducer`，以 `toolUseId` 为主键维护工具调用、工具结果和诊断项。
- 支持同一 assistant message 多个 `tool_use`、同一 user message 多个 `tool_result`、结果乱序返回、重复 tool_use 更新原项、缺来源结果生成诊断项。
- `scripts/smoke-app-server.mjs` 增加 `tool/display/lifecycle_source_binding` 覆盖。

验证：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:app-server`：通过。
- `git diff --check`：通过。
