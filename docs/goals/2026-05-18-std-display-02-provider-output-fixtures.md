# Goal: STD-DISPLAY-02 Provider 输出 fixture 与历史恢复 smoke

## 目标

建立 provider 输出 fixture 和 smoke 验证链路，让 Desktop/UI 只消费 CCR 归一化后的内容块（CcrContentBlock）和展示事件（DisplayEvent），不直接依赖 OpenAI、Anthropic、Gemini、DeepSeek、OpenAI Compatible 的原始响应结构。

## 第一版范围

本次优先做：

- 盘点 provider 原始输出到 CCR 展示事件的真实入口。
- 设计 fixture 目录和样例 schema。
- 为 OpenAI、Anthropic、Gemini、DeepSeek、OpenAI Compatible 补最小输出样例。
- 补 smoke，覆盖文本、工具、附件、错误快照、历史恢复。

本次不做：

- 不接新 provider。
- 不改真实 provider 请求协议。
- 不重做 Desktop UI 样式。
- 不实现生成型图片 / 音频 / 文件输出生命周期；该项放到 STD-OUTPUT-03。

## 入口盘点

第一版确认的真实链路：

1. Provider adapter 或协议 fixture 先把外部原始输出收敛成 `LlmContentPart` / `CcrContentBlock` 口径。
2. Desktop 的 `createDisplayEventFromCompletedItem(...)` 只接收 CCR 内容块 / display input block，生成 `DisplayEvent`。
3. 历史恢复通过 `context.params.source = "history"` 复用同一条 DisplayEvent 链路。
4. 错误输出通过 `createCcrErrorSnapshot(...)` 进入 `errorSnapshot`，再作为错误卡片消费。

第一版 fixture 落点：

- `src/services/llm/fixtures/provider-output-fixtures.json`
- `scripts/smoke-provider-output-fixtures.mjs`
- `package.json` 脚本：`smoke:provider-output-fixtures`

fixture schema 最小字段：

- `provider` / `apiMode` / `scenario`：说明 provider 和覆盖场景。
- `rawProviderOutput`：保留 provider 原始结构样例，只作为 fixture 输入证据。
- `displayInput`：CCR 归一化后进入 Desktop 展示链路的输入。
- `expected`：断言内容块类型、展示事件类型、工具/附件/错误字段，以及 provider 原始 marker 不出现在展示事件中。

## 验收标准

- [x] 每个目标 provider 至少有一组 fixture。
- [x] fixture 能表达 provider 原始输出和期望 CCR 展示结果。
- [x] smoke 验证 provider 原始结构必须先归一化，再进入 Desktop 展示事件或内容块。
- [x] 覆盖文本、工具、附件、错误快照、历史恢复中的关键场景。
- [x] 新增 provider 时能按同一目录和 schema 补样例。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:provider-output-fixtures
git diff --check
```

## 执行结果

状态：已完成第一版。

已完成：

- 新增 `src/services/llm/fixtures/provider-output-fixtures.json`。
- 新增 `scripts/smoke-provider-output-fixtures.mjs`。
- `package.json` 新增 `smoke:provider-output-fixtures`。
- `scripts/ci-smoke.mjs` 纳入 provider 输出 fixture smoke。
- fixture 覆盖：
  - OpenAI Responses 文本输出。
  - Anthropic Messages 工具调用。
  - Gemini GenerateContent `functionCall`。
  - DeepSeek OpenAI Chat `reasoning_content` + `tool_calls`。
  - OpenAI Compatible 历史附件恢复。
  - OpenAI Compatible 工具结果历史恢复。
  - OpenAI Compatible provider 限流错误快照。

已完成验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:desktop-display-events`
- `npm.cmd run smoke:provider-output-fixtures`
- `git diff --check`
