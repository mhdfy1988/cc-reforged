# Goal: STD-HISTORY-11-8 文档规则和发布说明收口

## 目标

把会话语义迁移的最终边界、实现状态、验证结论和开发规则收口到项目文档里，避免后续又回到旧 leaf 语义或旧 `dist` 验证坑。

## 为什么要做

这条线已经多次出现“文档说完成，但实际还有旧路径残留”的问题。收口 goal 必须明确哪些已完成、哪些仍是后续迁移建议、哪些规则已经成为项目约束。

## 范围

1. 更新 `session-semantics-codex-migration.md` 的实施状态。
2. 更新 `session-context-materialization-repair.md`，标记旧 leaf 主路径状态。
3. 更新 `parallel-tool-result-source-binding-todo.md`，说明并行工具漏验与补验结论。
4. 必要时补项目 `AGENTS.md`。
5. 更新 CHANGELOG 或发布说明。
6. 回写标准 todo 的完成状态和后续记录。

## 明确不做

- 不把未实现内容写成已完成。
- 不把后续建议混进当前已完成项。
- 不只更新口头总结，不落文档。
- 不跳过 todo pre-final gate。

## 验收标准

- [x] 文档里不再把 `leaf` 当正常产品语义。
- [x] 后续 todo / goal 能直接引用本 todo。
- [x] 新增恢复能力前能从本文找到不变式和验收要求。
- [x] 已完成、未完成、后续建议边界清楚。
- [x] `git diff --check` 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
git diff --check
```

## 完成后下一步

本专项完成；如继续实现，应从新的标准 todo 当前指针读取，不再临时猜测阶段。

## 执行结果

状态：已完成。

完成内容：

- 更新 [session-semantics-codex-migration.md](../architecture/session-semantics-codex-migration.md)，补充 2026-05-25 实施状态和 Ordered Reducer 目标模型。
- 更新 [session-context-materialization-repair.md](../architecture/session-context-materialization-repair.md)，记录 STD-HISTORY-11 收口状态。
- 更新 [parallel-tool-result-source-binding-todo.md](../stages/parallel-tool-result-source-binding-todo.md)，补充 2026-05-25 复核补验结论。
- 更新项目 [AGENTS.md](../../AGENTS.md)，明确 `canonicalLeafUuid` 只是兼容字段，恢复主路径必须使用 ordered transcript / classified events / current context tail 语义。
- 更新 [CHANGELOG.md](../../CHANGELOG.md)，记录 ordered 语义适配层和恢复错误诊断修复。
- 回写 [session-semantics-codex-migration-todo.md](../stages/session-semantics-codex-migration-todo.md)，标记 Goal 1-8 全部完成。

验证：

- `npm.cmd run typecheck`：通过。
- `git diff --check`：通过。
