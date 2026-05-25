# Goal: STD-HISTORY-09-3 compact / snip / preservedSegment 语义统一

## 目标

把 transcript 里的 compact、snip 和 preservedSegment 恢复语义集中到共享物化层，保证小文件、大文件、Core resume、App Server replay 得到同一个当前上下文。

## 为什么先做这个

当前问题的核心之一是 compact 后的当前模型上下文已经变小，但某些恢复路径没有正确重放 compact boundary 语义。特别是没有 `preservedSegment` 的普通 compact，小文件完整读取路径可能继续把 boundary 前旧消息带回 Core currentContext。

本 Goal 只约束 **Core 当前模型上下文**，不约束 UI 可见历史。UI 历史不应该因为 compact boundary 被截断。

同时，仓库里已有 `snip` 删除和 relink 逻辑，不能因为修 compact 把 snip 删除过的中间消息又带回来。

## 第一版范围

1. 修复普通 compact：
   - 没有 `preservedSegment` 时也按最后一个 compact boundary 裁剪当前模型上下文里的旧消息。
   - 小文件 `readFile(...)` 路径和大文件 `readTranscriptForLoad(...)` 路径语义一致。
2. 保留 live `preservedSegment`：
   - preserved segment 能按现有规则 relink。
   - stale segment 不成为 phantom leaf。
3. 处理 malformed preserved segment：
   - 只产生 diagnostic 或明确失败。
   - 不静默加载完整旧上下文。
4. 保留 `snip` 语义：
   - `applySnipRemovals(...)` 继续删除被 snip 移除的消息。
   - survivor 的 `parentUuid` relink 不回归。

## 明确不做

- 不改变 compact boundary 的原始 transcript 写入格式。
- 不重写原始 Claude Code compact 设计。
- 不把 stale / malformed segment 当作可继续的正常路径。
- 不为了旧异常数据恢复完整旧上下文。

## 验收标准

- [x] 普通 compact 小 transcript 恢复后的 currentContext 不包含 boundary 前旧消息。
- [x] 大文件读取路径和小文件读取路径语义一致。
- [x] live `preservedSegment` 被保留并 relink。
- [x] stale / malformed `preservedSegment` 不加载完整旧上下文。
- [x] snip 删除过的中间消息恢复后仍不出现。
- [x] snip survivor 的 parentUuid 已正确 relink。

## 实施结果

`src/utils/conversationMaterialization.ts` 已集中处理 transcript 状态语义：

- 普通 compact：没有 `preservedSegment` 时，按最后一个 compact boundary 从 currentContext 裁掉边界前旧消息。
- live `preservedSegment`：保留 tail 到 head 的 preserved 链，执行 head -> anchor、anchor children -> tail 的 relink，并清零 preserved assistant 的旧 usage。
- stale `preservedSegment`：如果最后一个带 segment 的 boundary 不是最新 boundary，按最新 boundary 裁掉 currentContext 旧上下文并输出 `compact_preserved_segment_stale` 诊断。
- malformed `preservedSegment`：如果 tail -> head 无法走通，按最新 boundary 裁掉 currentContext 旧上下文并输出 `compact_preserved_segment_malformed` 诊断。
- `snip`：继续复用现有 `loadTranscriptFile(...)` 内的 snip 删除和 survivor parent relink 语义，物化后再计算 canonical leaf。

新增 `scripts/smoke-conversation-materialization.mjs` 和 `npm.cmd run smoke:conversation-materialization`，覆盖：

- 普通 compact 小 transcript。
- 普通 compact 大 transcript。
- live `preservedSegment`。
- stale `preservedSegment`。
- malformed `preservedSegment`。
- `snip` 删除和 relink。
- sidechain 不参与主线 leaf。

## 验证结果

- `npm.cmd run typecheck` 通过。
- `npm.cmd run build` 通过。
- `npm.cmd run smoke:conversation-materialization` 通过。
- `git diff --check` 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-09-4 Core resume 只消费物化结果](./2026-05-24-std-history-09-4-core-resume-materialized-context.md)。
