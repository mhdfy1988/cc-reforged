# Goal: STD-HISTORY-11-5 冒烟与真实样本覆盖

## 目标

把本次反复出现的会话恢复问题固化为自动回归和真实样本验证，避免后续又靠手工截图发现同类问题。

## 为什么要做

并行工具、乱序工具结果、compact、sidechain 和恢复错误映射都不是孤立 bug。没有 fixture 覆盖，代码很容易在“看似修好一个点”后又从另一个入口回到旧逻辑。

## 范围

1. 扩展 `scripts/smoke-conversation-materialization.mjs`。
2. 新增并行工具 sibling 用例。
3. 新增 tool_result 乱序返回用例。
4. 新增 compact + 并行工具组合用例。
5. 新增 sidechain sibling 不参与 current tail 用例。
6. 新增真实失败 transcript 的最小化 fixture，或本机只读样本验证入口。

## 明确不做

- 不提交用户隐私 transcript 原文。
- 不把本机真实样本变成必须存在的 CI 依赖。
- 不用旧 `dist` 入口验证源码修改。
- 不以 UI 截图替代物化 smoke。

## 验收标准

- [x] `npm.cmd run typecheck` 通过。
- [x] `npm.cmd run build` 通过。
- [x] `npm.cmd run smoke:conversation-materialization` 通过。
- [x] 必要时 `npm.cmd run smoke:app-server` 通过。
- [x] 真实失败样本不再报 `multiple_main_leaves` 或被包装成 `Session transcript not found`。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:conversation-materialization
npm.cmd run smoke:app-server
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-11-6 错误语义和诊断收口](./2026-05-25-std-history-11-6-error-diagnostics-closeout.md)。

## 执行结果

状态：已完成。

完成内容：

- `scripts/smoke-conversation-materialization.mjs` 增加分类事件 smoke，覆盖 `tool_result` only user message、compact boundary、sidechain。
- 增加并行工具 sibling smoke：同轮 tool_use A/B，tool_result B 先回，tool_result A 后回，最终 current context 不丢 A/B。
- 增加 compact + 并行工具组合 smoke：压缩后 current context 只保留压缩后消息，display replay 仍保留压缩前工具内容。
- 原 `multiple_main_leaves` 失败用例改为“多个旧 leaf 候选不阻断 tail 解析”的最小 fixture，用来代表这次真实失败形态。
- App Server smoke 继续覆盖历史 snapshot、compact notice、并行工具展示拆分和实时 patch 生命周期。

验证：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:conversation-materialization`：通过。
- `npm.cmd run smoke:app-server`：通过。
- `git diff --check`：通过。
