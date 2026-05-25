# Goal: STD-HISTORY-09-9 文档和后续回归收口

## 目标

在当前上下文物化修复完成后，同步 todo、architecture、source evidence 和验证记录，明确哪些已完成、哪些仍是后续清理，并把真实 Desktop UI 回归作为独立后续步骤保留。

## 为什么最后做这个

会话恢复链路已经牵涉多个文档。如果实现完成后不收口，后续会再次出现：

- 文档说展示协议已完成，但上下文物化其实没完成。
- todo 里旧兼容路径和新物化路径混在一起。
- 后续开发不知道哪些 fallback 已禁止。
- 真机 UI 回归和自动 smoke 被混成同一件事。

## 第一版范围

1. 更新阶段 todo：
   - 阶段 9 已完成项。
   - 未完成项。
   - 后续清理项。
2. 更新 architecture 文档：
   - 当前物化入口。
   - Core / App Server 消费关系。
   - diagnostics / fallback 边界。
3. 更新源码证据索引：
   - 关键源码路径。
   - 核心行为。
   - 验证结论。
4. 记录验证命令和结果。
5. 保留真实 Desktop UI 回归为后续独立步骤。

## 明确不做

- 不在未验证时宣称全部完成。
- 不把真实 Desktop 手工回归伪装成自动验证。
- 不清理仍需要的过渡状态字段。
- 不删除原始 Claude Code 基线逻辑。

## 验收标准

- [x] todo 当前指针同步到真实状态。
- [x] architecture 文档不再保留与实现冲突的最长链 fallback 口径。
- [x] source evidence 索引包含本轮关键源码结论。
- [x] 验证命令和结果已记录。
- [x] 真实 Desktop UI 回归作为后续独立步骤说明清楚。

## 实施结果

文档已收口：

- `docs/stages/realtime-history-display-contract-todo.md`
  - 阶段 9 当前上下文物化修复完成。
  - 当前指针转为“阶段 9 后复审；整条路线尚未最终收口”。
   - 阶段 9 后复审补充完成 App Server 可见历史 display projection 与 Core 当前模型上下文拆分。
   - 新增阶段 9 外后续收口项：真实 Desktop UI 手工回归、发布说明收口。
  - 后续记录追加 Goal 7 / 8 / 9 完成情况。
- `docs/architecture/session-context-materialization-repair.md`
  - 补充 2026-05-24 实施收口状态、关键源码落点、验证命令和仍保留的后续项。
- `docs/architecture/realtime-history-display-contract.md`
  - 把“当前上下文物化仍未完成”的旧口径更新为“阶段 9 已完成第一版”，并补充 UI 可见历史不能按 compact boundary 裁剪的边界。
- `docs/architecture/session-resume-transcript-semantics.md`
  - 补充阶段 9 落地状态，明确多个主线 leaf 是异常诊断。
- `docs/references/codex-openclaw-live-history-source-evidence.md`
  - 增加 CCR 阶段 9 实施证据索引，记录共享物化入口、Core/App Server 接入、compact 持久化顺序和 smoke。

真实 Desktop UI 手工回归未在本轮执行，原因是本阶段目标为自动验证和架构收口；用户当前仍在使用 CCR 主入口，避免用验证动作影响当前页面或服务。发布说明也未执行，作为阶段 9 外后续独立收口项。App Server 自动 smoke 已覆盖 compact 后 Core 当前上下文与 UI 历史展示分离：`thread/messages/list` 保持压缩后上下文，`thread/resume` / `ThreadDisplaySnapshot` 仍展示 compact 前后可见历史。

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
npm.cmd run smoke:desktop-display-events
git diff --check
```

## 完成后下一步

执行真实 Desktop UI 回归：历史恢复、实时流式、工具卡、权限卡、上下文压缩、刷新恢复、窗口刷新 / 重启恢复。回归稳定后补发布说明。
