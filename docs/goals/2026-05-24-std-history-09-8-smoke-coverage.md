# Goal: STD-HISTORY-09-8 自动验证覆盖关键路径

## 目标

补齐当前上下文物化的自动验证，覆盖 compact、preservedSegment、snip、sidechain、多 main leaf、Core/App Server 一致性和切换恢复。

## 为什么先做这个

会话恢复是高风险链路，只靠 typecheck 不够。之前的问题就是实时和恢复路径分开，肉眼看一轮正常不代表刷新、切换、重启后仍一致。

本 goal 要让关键状态语义有 smoke 保护，后续再改展示或恢复时不容易退回旧逻辑。

## 第一版范围

验证至少覆盖：

1. 普通 compact 小 transcript：
   - Core currentContext 恢复后不包含 boundary 前旧消息；UI 历史不应用这个断言。
2. 大文件路径：
   - `readTranscriptForLoad(...)` 和小文件路径语义一致。
3. live `preservedSegment`：
   - 被保留并 relink。
4. stale / malformed `preservedSegment`：
   - 只产生 diagnostic 或明确失败。
   - 不加载完整旧上下文。
5. snip：
   - 删除过的中间消息不出现。
   - survivor parentUuid 已 relink。
6. sidechain：
   - terminal 不抢主线 leaf。
   - sidechain 子任务挂在主线 leaf 下时，不把主线 leaf 误判为不存在。
   - terminal system 子节点挂在主线 conversation message 下时，回溯最近主线 user/assistant 作为 leaf。
7. 多 main leaf：
   - 只输出 diagnostic，不进入最长链 fallback。
8. Core / App Server 一致：
   - `context/status` 与 `displaySnapshot.counts.coreContextMessages` 一致。
9. 端到端切换：
   - 压缩后切到别的会话再切回，Core context 和 App Server snapshot 都不回到压缩前。

## 明确不做

- 不用真实 Desktop 手工操作替代 smoke。
- 不为了测试构造旧异常兼容逻辑。
- 不恢复普通提示里的数量展示。
- 不让 Renderer 直接解释 transcript。

## 验收标准

- [x] 新增或扩展 smoke 覆盖上述关键路径。
- [x] smoke 能在 Windows PowerShell 下通过 `npm.cmd` 入口运行。
- [x] 失败时能指出是 compact、snip、sidechain、diagnostic 还是 Core/App Server count 不一致。
- [x] `git diff --check` 通过。

## 覆盖映射

- `scripts/smoke-conversation-materialization.mjs`
  - 普通 compact 小 transcript。
  - 普通 compact 大 transcript。
  - live `preservedSegment` relink。
  - stale / malformed `preservedSegment` diagnostic。
  - snip 删除和 survivor relink。
  - sidechain terminal 不抢主线 leaf。
  - sidechain child 不隐藏主线 leaf。
  - terminal system child 能回溯最近主线 user/assistant leaf。
  - 多 main leaf 只输出 diagnostic，不进入普通恢复 messages。
- `scripts/smoke-core-session-parent-chain.mjs`
  - 磁盘仍保留 compact 前旧消息时，Core resume 只加载 compact 后当前上下文。
  - 新 turn 的 user 接到物化后的 canonical leaf。
  - 后续 assistant 接到新 user，持久化 parentUuid 仍闭合。
- `scripts/smoke-app-server-context-state.mjs`
   - compact boundary 裁剪 Core 线程内存上下文。
  - `context_compacted` 事件和 `context/status` 反映压缩后状态。
  - transcript 写入和恢复读回保持同一线程事实源。
- `scripts/smoke-app-server.mjs`
  - `thread/resume` 和 `thread/messages/list` 通过 `ThreadDisplaySnapshot` 展示。
  - snapshot counts、`coreContextMessages`、materialized resume 路径和旧展示通知清理。
- `scripts/smoke-desktop-session-state.mjs`
  - Desktop reducer 消费 snapshot / patch，不重新解释 transcript。
- `scripts/smoke-desktop-display-events.mjs`
  - 工具卡、文件卡、附件、错误卡等显示 projection 继续回归。

## 验证结果

- `npm.cmd run typecheck` 通过。
- `npm.cmd run typecheck:desktop` 通过。
- `npm.cmd run build` 通过。
- `npm.cmd run smoke:conversation-materialization` 通过。
- `npm.cmd run smoke:core-session-parent-chain` 通过。
- `npm.cmd run smoke:app-server-context` 通过。
- `npm.cmd run smoke:app-server` 通过。
- `npm.cmd run smoke:desktop-session-state` 通过。
- `npm.cmd run smoke:desktop-display-events` 通过。
- `git diff --check` 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:core-session-parent-chain
npm.cmd run smoke:app-server
npm.cmd run smoke:app-server-context-state
npm.cmd run smoke:desktop-session-state
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-09-9 文档和后续回归收口](./2026-05-24-std-history-09-9-doc-closeout.md)。
