# Goal: STD-HISTORY-10-9 并行工具冒烟覆盖

## 目标

把并行工具、乱序结果、compact 后恢复和异常诊断变成长期可回归的测试。

## 为什么先做这个

这类问题靠手工看 UI 很容易漏掉，尤其是 result 乱序、orphan result、实时/历史一致性、dist 入口是否跑旧产物。必须把关键场景固定成 smoke。

## 第一版范围

1. 一个 assistant message 内两个 `tool_use` 的历史恢复 fixture。
2. `tool_result B` 先于 `tool_result A` 到达的实时回放 fixture。
3. 缺少 `tool_use_id` 的孤立工具结果诊断 fixture。
4. 指向不存在 `tool_use` 的孤立工具结果诊断 fixture。
5. compact 后恢复：Core context 变短、display history 不丢。
6. 多 main leaf 只诊断、不走最长链。
7. 实时增量补丁与历史快照最终 timeline 一致性断言。
8. dist 入口冒烟，确认没有跑旧构建产物。

## 明确不做

- 不只做类型检查就视为通过。
- 不用旧异常数据作为正常行为验收。
- 不跳过 dist 入口验证。

## 验收标准

- [x] 所有新增 fixture 均有稳定断言。
- [x] 历史 snapshot 和实时 patch 对同一场景最终 timeline 一致。
- [x] dist 入口冒烟能证明当前产物已同步。

## 实施记录

- `smoke:app-server` 的历史 snapshot fixture 增加两个孤立工具结果：缺少 `tool_use_id`、指向不存在 `tool_use`，并断言都生成 error projection。
- `smoke:app-server` 的实时 patch fixture 增加最终态对比：同一组并行工具在实时 patch 结束后的工具项摘要，必须等于历史 snapshot 的工具项摘要。
- 验证链明确为 `build` 后再跑 `smoke:app-server`，因为该 smoke 从 `dist` 和 `cli.js` 入口执行。

验证通过：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:app-server
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:conversation-materialization
git diff --check
```

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:app-server
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:conversation-materialization
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-10-10 真实桌面端手工回归](./2026-05-24-std-history-10-10-desktop-manual-regression.md)。
