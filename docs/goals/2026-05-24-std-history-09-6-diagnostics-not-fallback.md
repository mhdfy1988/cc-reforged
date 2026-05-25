# Goal: STD-HISTORY-09-6 异常只诊断，不伪装成功

## 目标

把多个 main leaf、读取失败、物化失败、malformed preserved segment 等异常变成可观测 diagnostic 或明确失败，不再通过“谁最长选谁”或静默 fallback 伪装成普通恢复成功。

## 为什么先做这个

最长链 fallback 的问题不是算法不够好，而是它把异常 transcript 伪装成正常产品行为。这样会掩盖真正的数据问题，还会让 Core、App Server、Renderer 分别得到不同结果。

用户已经明确：不用兼容以前异常数据，只要确保以后不乱。

## 第一版范围

1. 多 main leaf：
   - 物化后如果仍有多个非 sidechain main leaf，输出 diagnostic 或失败。
   - 不选最长链作为普通恢复结果。
2. malformed / stale preserved segment：
   - 输出 diagnostic 或明确失败。
   - 不加载完整旧上下文。
3. transcript 读取失败：
   - 记录 diagnostic。
   - 只有缺少 transcriptPath 且 Core 当前消息就是事实源时，才允许 Core 当前消息生成 snapshot。
4. App Server fallback 边界：
   - fallback 不能让用户误以为历史 transcript 已正常恢复。

## 明确不做

- 不修复旧异常 transcript。
- 不新增自动数据迁移。
- 不做“最长链 + warning”的折中恢复。
- 不把诊断数量显示在普通恢复提示里。

## 验收标准

- [x] 多 main leaf 不进入普通恢复成功路径。
- [x] malformed preserved segment 不加载完整旧上下文。
- [x] 读取失败有 diagnostic 或明确失败。
- [x] App Server fallback 只在 Core 当前消息是事实源时允许。
- [x] 普通恢复提示不显示误导性数量。

## 实施结果

异常路径已收紧：

- `MaterializedConversation.status` 在多个主线 leaf 或无主线 leaf 时返回 `error`，`messages` 为空，并输出 `multiple_main_leaves` / `no_main_leaf` diagnostic。
- malformed `preservedSegment` 会输出 `compact_preserved_segment_malformed`，并裁掉最新 compact boundary 前的 currentContext 旧上下文，不再把完整旧历史带回模型上下文。UI 可见历史不应用这条裁剪。
- App Server 读取失败或物化失败时，diagnostic level 为 `error`，文案明确为“仅展示 Core 当前消息”，details 标记 `fallbackSource: core_current_thread`。
- 缺少 `transcriptPath` 时，App Server 允许直接从 Core 当前消息构建 snapshot，因为这时 Core 当前消息就是事实源。
- 普通恢复提示仍不显示“恢复了多少条”，数量只保留在 snapshot counts / diagnostics 里。

`scripts/smoke-conversation-materialization.mjs` 新增多主线 leaf 样例：两个主线 leaf 会得到 `status: error`、空 messages 和 `multiple_main_leaves` diagnostic。

## 验证结果

- `npm.cmd run typecheck` 通过。
- `npm.cmd run build` 通过。
- `npm.cmd run smoke:conversation-materialization` 通过。
- `npm.cmd run smoke:app-server` 通过。
- `npm.cmd run smoke:desktop-session-state` 通过。
- `git diff --check` 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:app-server
npm.cmd run smoke:desktop-session-state
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-09-7 缓存和持久化顺序闭环](./2026-05-24-std-history-09-7-cache-and-persistence-order.md)。
