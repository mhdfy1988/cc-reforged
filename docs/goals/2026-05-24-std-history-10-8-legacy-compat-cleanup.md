# Goal: STD-HISTORY-10-8 旧兼容路径清理

## 目标

清理会再次绕回旧错误语义的兼容入口，避免新协议之外还有隐藏展示主路径。

## 为什么先做这个

历史问题里多次出现“源码修了但 UI 还走旧路径”或“smoke 跑旧 dist”。这个 goal 专门收口旧 `threadMessages`、旧 replay、raw fallback、旧实时通知和构建产物同步问题。

## 第一版范围

1. Desktop main 不再缓存旧 `threadMessages` 作为展示状态。
2. `thread/messages/list` 若保留 `messages`，必须标注为兼容接口或当前上下文接口。
3. 清理旧 `messages` replay fallback。
4. 清理 raw content fallback。
5. 清理旧展示通知路径。
6. 确认源码和 `dist` 构建产物同步。

## 明确不做

- 不删除仍被非展示路径合法使用的兼容字段。
- 不用 silent fallback 掩盖协议缺失。
- 不把旧异常 transcript 当作必须正常修复的输入。

## 验收标准

- [x] 搜索不到 Renderer 主路径消费旧 `threadMessages`。
- [x] 快照或增量补丁缺失展示投影时不会被 raw fallback 渲染成正常卡片。
- [x] `npm.cmd run build` 后 `dist` 与源码行为一致。

## 实施记录

- `ThreadResumeResult` / `ThreadMessagesListResult` 增加 `messagesSemantics`，明确 `thread/messages/list.messages` 只是当前上下文兼容载荷，Desktop 可见历史继续以 `displaySnapshot` 为准。
- `sessionState.ts` 删除无来源 ID 时按 `turnId:itemId:contentIndex` 匹配工具生命周期的旧 fallback；缺来源结果只能进入孤立结果/诊断语义，不再靠位置猜。
- 复核 Desktop Renderer / Main：`routeDesktopEvent(...)` 只接 `thread/display/patch`、`turn/*`；`apps/desktop/src/main/index.ts` 唯一 `listThreadMessages(...)` 调用只用于刷新 `threadDisplaySnapshot`。

验证通过：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:app-server
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
git diff --check
```

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-10-9 并行工具冒烟覆盖](./2026-05-24-std-history-10-9-parallel-tool-smoke-coverage.md)。
