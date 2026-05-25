# Goal: STD-HISTORY-09-7 缓存和持久化顺序闭环

## 目标

确认 compact 成功、内存上下文、磁盘 transcript、缓存和 App Server snapshot 使用同一事实源，避免 UI 显示压缩成功但切换回来又恢复到压缩前。

## 为什么先做这个

压缩不是普通 UI 状态，而是当前上下文状态变更。只有内存变小不够，只有磁盘写入不够，只有成功卡片也不够。恢复时必须能从持久事实源重新得到同一个压缩后的上下文。

如果缓存仍引用 compact 前 message set，或成功事件早于持久化落稳，就会复发“实时看着压缩成功，切换回来上下文没变”。

## 第一版范围

1. 核对 compact 成功事件顺序：
   - `context_compacted`。
   - compact 成功卡片。
   - compact boundary 写入。
   - 压缩后 messages 写入。
2. 核对缓存一致性：
   - `getSessionMessages.cache`。
   - 线程内存消息。
   - history list lazy load。
   - App Server snapshot。
3. 核对刷新 / 切换 / 重启：
   - `context/status` 仍是压缩后数量。
   - `displaySnapshot` 不回到 compact 前。

## 明确不做

- 不改变 compact UI 设计。
- 不要求恢复时重现压缩成功卡片。
- 不做真实 Desktop 手工回归。
- 不引入 OpenClaw 式 session rotation。

## 验收标准

- [x] compact 成功事件只在持久事实源落稳后发出。
- [x] 成功卡片不早于实际上下文状态变更。
- [x] 缓存不会继续引用 compact 前旧 message set。
- [x] 切换会话再切回，Core context 不回到压缩前。
- [x] App Server snapshot 不回到压缩前。

## 实施结果

Core compact / persist 顺序已收紧：

- `persistThreadMessages(...)` 改为返回 `boolean`，调用方可以知道 transcript 是否真正写稳。
- 手动 compact：先更新内存为压缩后消息，再持久化；只有持久化成功后才发 `context_compacted`。如果持久化失败，恢复 compact 前内存消息并抛出 `compact_failed`，不会发成功事件。
- 流式 compact boundary：先记录 boundary；只有持久化成功后才裁剪 Core 内存上下文并发 `context_compacted`。如果持久化失败，不裁剪、不发成功事件。
- `loadTranscriptFile(...)` 和共享 materializer 已保证 compact 后恢复会从 currentContext 裁掉 boundary 前旧消息；UI 可见历史不应用这条裁剪。
- `loadConversationForResume(...)`、`thread/resume`、`thread/messages/list` 都从物化后的 Core 当前消息出发，避免 cache / snapshot 回到 compact 前。

## 验证结果

- `npm.cmd run typecheck` 通过。
- `npm.cmd run build` 通过。
- `npm.cmd run smoke:app-server-context` 通过。
- `npm.cmd run smoke:core-session-parent-chain` 通过。
- `npm.cmd run smoke:conversation-materialization` 通过。
- `npm.cmd run smoke:app-server` 通过。
- `git diff --check` 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:app-server-context-state
npm.cmd run smoke:desktop-session-state
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-09-8 自动验证覆盖关键路径](./2026-05-24-std-history-09-8-smoke-coverage.md)。
