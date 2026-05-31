# ThreadDisplay 协议边界收口 TODO

关联 goal：`docs/goals/2026-05-28-std-history-19-0-thread-display-protocol-contract.md`

## 当前任务列表

- [x] 梳理协议边界：`displaySnapshot` / `ThreadDisplayPatch` 是 Desktop 主展示权威。
- [x] 梳理兼容边界：`messages` 只作为 current-context / legacy compat 载荷保留。
- [x] 补充 `ThreadDisplayCounts` 诊断语义，不允许把 counts 当 UI 历史权威。
- [x] 补充 Desktop snapshot merge 的防退化边界注释。
- [x] 补充 smoke，防止 Desktop 回退到 `result.messages` replay。
- [x] 更新 CHANGELOG。
- [x] 运行验证命令。

## 约束

1. 不删除 `thread/messages/list`。
2. 不删除 `messages` 兼容字段。
3. 不删除 `buildConversationChain(...)` 原生读侧 helper。
4. 不添加 silent legacy fallback。
5. 不把 Desktop merge 层扩展成第二套 materializer。
6. 不用诊断 counts 反向驱动 UI 历史。

## 验证

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:desktop
npm.cmd run build
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server
git diff --check
```
