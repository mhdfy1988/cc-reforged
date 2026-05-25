# Goal: STD-HISTORY-12-9 smoke 回归覆盖

## 目标

把边界收口后的关键行为固化成自动回归。

本 goal 解决的是“会话恢复问题容易在手动测试中反复出现，但缺少稳定自动覆盖”的问题。

## 为什么要做

这条线已经反复出现 compact、UI 历史裁剪、并行工具、tool_result 乱序、恢复错误误报等问题。收口后必须有 smoke 防止回退。

## 范围

1. 普通恢复 smoke。
2. compact 后恢复 smoke。
3. compact 前 UI 历史仍可见 smoke。
4. 并行 tool_use smoke。
5. tool_result 乱序 smoke。
6. 多 legacy leaf 只诊断 smoke。
7. materialization 失败不变成 `Session transcript not found` smoke。
8. App Server display snapshot smoke。
9. Desktop display events smoke。

## 明确不做

- 不用手动截图代替 smoke。
- 不跳过 build 后直接跑 dist 入口 smoke。
- 不把旧异常 transcript 兼容当作主路径验收。

## 验收标准

- [x] `npm.cmd run typecheck` 通过。
- [x] `npm.cmd run build` 通过。
- [x] `npm.cmd run smoke:conversation-materialization` 通过。
- [x] `npm.cmd run smoke:app-server` 通过。
- [x] `npm.cmd run smoke:desktop-display-events` 通过。
- [x] `git diff --check` 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:app-server
npm.cmd run smoke:desktop-display-events
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-12-10 文档规则和发布说明收口](./2026-05-25-std-history-12-10-doc-rules-release-closeout.md)。

## 执行结果

状态：已完成。

### 覆盖矩阵

| 目标覆盖 | 覆盖入口 | 说明 |
| --- | --- | --- |
| 普通恢复 smoke | `scripts/smoke-conversation-materialization.mjs` 的 `testOrdinaryRecovery(...)` | 本 goal 新增，断言普通非 compact 链的当前上下文和 display replay 都完整。 |
| compact 后恢复 smoke | `testOrdinaryCompact(...)`、`testLargeOrdinaryCompact(...)`、`testLivePreservedSegment(...)`、`testMalformedPreservedSegment(...)` | 断言 Core 当前上下文在 compact 后变小，并保留必要 preserved segment。 |
| compact 前 UI 历史仍可见 smoke | `testOrdinaryCompact(...)`、`testLargeOrdinaryCompact(...)`、`smoke:app-server` 的 history snapshot 断言 | Core context 不含 pre-compact 消息，但 UI display snapshot 仍保留 pre-compact user/assistant。 |
| 并行 tool_use smoke | `testParallelToolSiblingResultsRemainInCurrentContext(...)`、`runThreadDisplaySnapshotToolSplitSmoke(...)` | 当前上下文和 App Server snapshot 都覆盖并行 tool_use 拆分。 |
| tool_result 乱序 smoke | `testParallelToolSiblingResultsRemainInCurrentContext(...)`、`testCompactWithParallelToolSiblingResults(...)` | fixture 中 tool_result B 先于 A 回来，仍按来源 tool_use 绑定。 |
| 多 legacy leaf 只诊断 smoke | `testMultipleMainLeavesDoNotBlockTailResolution(...)` | 多 main leaf 不再走最长链兜底，当前 tail 按 ordered classifier 解析，只输出 legacy 诊断。 |
| materialization 失败不变成 `Session transcript not found` smoke | `testMaterializationFailureKeepsDiagnosticError(...)` | 断言错误包含 materialization diagnostic，不回退成泛化 transcript missing。 |
| App Server display snapshot smoke | `npm.cmd run smoke:app-server` | 覆盖 `thread/display/snapshot_*`、history materialized resume、compact notice、parallel tool split。 |
| Desktop display events smoke | `npm.cmd run smoke:desktop-display-events` | 覆盖 Renderer 消费的 display event/card 协议和 tool snapshot 基本不变式。 |

### 验证记录

已通过：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:app-server
npm.cmd run smoke:desktop-display-events
git diff --check
```

`smoke:app-server` 本轮确认的关键 checked 项包括：

- `thread/resume_history_messages`
- `thread/display/snapshot_counts`
- `thread/display/snapshot_thread_messages`
- `thread/display/snapshot_materialized_resume`
- `thread/display/hides_compact_internal_messages`
- `thread/display/compact_notice`
- `thread/display/snapshot_parallel_tool_split`
- `thread/display/patch_parallel_tool_lifecycle`
