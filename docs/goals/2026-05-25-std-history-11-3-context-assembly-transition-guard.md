# Goal: STD-HISTORY-11-3 当前上下文组装过渡护栏

## 目标

在不一次性重写 Claude Code 读侧修复逻辑的情况下，让 current context 组装入口使用新的 `currentContextTail`，同时保留 compact / snip / preservedSegment / 并行工具补回能力。

## 为什么要做

`buildConversationChain(...)` 里混有两类职责：

1. 旧的 leaf 选择和 parent walk 主路径。
2. 原生读侧修复能力，例如并行工具 sibling / tool_result 补回。

前者必须迁出正常路径，后者不能随手删掉。

## 范围

1. 用 Goal 2 的 `currentContextTail` 作为上下文组装入口。
2. 保留 compact / snip / preservedSegment 处理能力。
3. 保留并行工具 sibling / tool_result 补回能力。
4. dangling parent、多个 terminal leaf、异常 sibling 只进入诊断。
5. current context 输出继续通过模型 API pairing 保护。

## 明确不做

- 不把 leaf 选择重新放回正常路径。
- 不删除原生读侧修复逻辑。
- 不为了 UI 展示重排模型 API payload。
- 不修改 Claude Code transcript 写入协议。

## 验收标准

- [x] compact 后恢复的 `currentContextMessages` 是压缩后的上下文。
- [x] 并行工具调用和工具结果能进入当前模型上下文。
- [x] 工具结果乱序回来时，不丢结果、不串绑。
- [x] sidechain 不混入当前主线模型上下文。
- [x] 模型 API pairing smoke 继续通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run smoke:conversation-materialization
git diff --check
```

## 完成后下一步

进入 [STD-HISTORY-11-4 展示投影不变式保护](./2026-05-25-std-history-11-4-display-projection-invariant.md)。

## 执行结果

状态：已完成。

完成内容：

- current context 组装入口已经从 `canonicalLeaf` 切到 `currentContextTail`。
- `buildConversationChain(...)` 仍保留在上下文组装路径，用来承接 compact / snip / preservedSegment / 并行工具 sibling 补回等读侧能力。
- 旧 parent leaf 只输出 `legacy_multiple_main_leaves_diagnostic`，不反向决定 tail。
- 新增并行工具 sibling 回归：同轮 tool_use A/B，tool_result B 先回、tool_result A 后回，最终 current context 同时保留 A/B 的工具调用和工具结果。
- 既有 compact、preservedSegment、snip、sidechain smoke 继续通过。

验证：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:conversation-materialization`：通过。
- `git diff --check`：通过。
