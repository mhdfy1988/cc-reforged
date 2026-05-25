# Goal: STD-HISTORY-12-2 收回 compact 当前上下文裁剪

## 目标

compact 后当前模型上下文变小由第 3 层负责，不通过底层 reader 的普通 compact prune 实现。

本 goal 解决的是“compact 是当前上下文语义，不是 UI 历史删除语义，也不应该塞进原生 reader 普通路径”的问题。

## 为什么要做

`applyPreservedSegmentRelinks(...)` 可以保留 Claude Code 原生 preservedSegment relink 语义，但普通 compact 后如何生成 CCR 当前模型上下文，应由 `conversationMaterialization.ts` 决定。否则 UI 历史、Core 恢复和原始 CLI/TUI 语义会混在一起。

## 范围

1. 恢复或瘦身 `applyPreservedSegmentRelinks(...)` 中普通 compact prune 的改动。
2. 保留原生 preservedSegment relink。
3. 在 `conversationMaterialization.ts` 中应用当前上下文 compact boundary。
4. 保证 UI 历史不受 compact 裁剪影响。

## 明确不做

- 不删除 compact boundary。
- 不改变 compact 写入格式。
- 不裁掉 UI 可见历史。
- 不恢复 longest-chain 兜底。

## 验收标准

- [x] compact 后 `currentContextMessages` 是压缩后的上下文。
- [x] compact 前 UI 历史仍可展示。
- [x] `sessionStorage.ts` 不再承载 CCR 当前上下文裁剪语义。
- [x] preservedSegment live/stale/malformed 场景仍有明确行为和诊断。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:app-server
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-12-3 收回 loadFullLog leaf 策略](./2026-05-25-std-history-12-3-loadfulllog-leaf-policy-extraction.md)。

## 执行结果

状态：已完成。

### 修改内容

1. `src/utils/sessionStorage.ts`
   - `applyPreservedSegmentRelinks(...)` 只保留 live `preservedSegment` 原生 relink：
     - `headUuid -> anchorUuid`
     - `anchorUuid` 其他 children -> `tailUuid`
     - preserved assistant usage 清零
   - 移除了底层 reader 中的普通 compact boundary prune。
   - stale `preservedSegment` 不再在底层 prune，只跳过 relink。
   - malformed `preservedSegment` 不再在底层 prune，只记录 `tengu_relink_walk_broken` 并跳过 relink。

2. `src/utils/conversationMaterialization.ts`
   - 继续由 `applyCompactMaterialization(...)` 负责当前模型上下文 compact 投影。
   - 普通 compact：按最后一个 boundary 裁当前上下文。
   - live `preservedSegment`：relink preserved segment 后仅保留 boundary 后上下文和 preserved segment。
   - stale / malformed `preservedSegment`：输出 diagnostics，并阻止旧上下文回流到 `currentContextMessages`。
   - `displayReplayEvents` 继续来自原始 JSONL 顺序视图，不受当前上下文裁剪影响。

### 边界说明

- compact 当前上下文裁剪现在只属于第 3 层物化语义。
- `sessionStorage.ts` 仍可以做原生存储修复，例如 live preservedSegment relink 和 snip relink。
- UI 历史不是当前模型上下文；UI 展示不因为 compact boundary 被裁掉。

### 验证记录

已执行：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:app-server
git diff --check
```

结果：全部通过。

覆盖点：

- ordinary compact 后 `currentContextMessages` 不含 compact 前旧消息，但 `displayReplayEvents` 仍含旧消息。
- large ordinary compact 同样保持 UI 历史可见。
- live / stale / malformed `preservedSegment` 均有恢复行为和 diagnostics。
- App Server snapshot 中 Core current context 与 UI history 的 compact 语义保持分离。
