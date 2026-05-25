# Goal: STD-HISTORY-10-7 Renderer 状态归并收口

## 目标

Renderer 只消费 App Server 展示协议，不再自行解释 transcript、raw tool event 或工具来源。

## 为什么先做这个

如果 Renderer 继续保留 raw fallback 或本地工具合并逻辑，即使 App Server 修对了，刷新、切会话、实时 patch 和历史 snapshot 仍可能分裂。

## 第一版范围

1. `sessionState.ts` 只按 `ThreadDisplayPatch` / `ThreadDisplaySnapshot` 归并 timeline。
2. `ChatTimeline` 不根据 raw content 自己拆 tool blocks。
3. 工具卡、权限卡、文件卡、TodoWrite 浮层只消费展示投影。
4. snapshot / 工作区 / 线程切换清理旧 pending-orphan / active tool 状态。
5. optimistic user input 仅作为本地临时态。

## 明确不做

- 不让 Renderer 兜底修 App Server 协议缺陷。
- 不新增 raw content 正常展示路径。
- 不把视觉工具组作为协议事实源。

## 验收标准

- [x] Renderer 缺展示投影时只展示协议错误卡。
- [x] 切换会话不会残留上一个会话的 running tool / pending permission。
- [x] 刷新页面后 timeline 由 snapshot 完整恢复。

## 实施记录

- `sessionState.ts` 对 `ThreadDisplaySnapshot` / `ThreadDisplayPatch` 产生的上下文增加协议闸门：只按 `itemId` 合并，不再按 raw `toolUseId` 在 Renderer 内补做工具生命周期归并。
- `ChatTimeline` 与 Renderer 状态辅助函数只读展示投影中的 identity / snapshot 字段，不再从 `toolSnapshot.raw` 里反推工具来源。
- `smoke:desktop-session-state` 补充协议路径断言：不同 `itemId` 的 tool result 即使带相同 `toolUseId`，Renderer 也不会私自合并回旧工具卡；`reset-session` 会清空旧 running tool / pending permission。

验证通过：

```powershell
npm.cmd run typecheck
npm.cmd run smoke:desktop-session-state
npm.cmd run smoke:desktop-display-events
```

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:desktop-display-events
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-10-8 旧兼容路径清理](./2026-05-24-std-history-10-8-legacy-compat-cleanup.md)。
