# Goal: STD-TOOL-02 Provider 工具协议第一版收口

## 目标

把 CCR 的工具协议能力从“按问题补丁”推进到“有第一版稳定声明”。

本阶段要补出 `ProviderToolProfile` 或等价结构，明确每个 provider / apiMode 对工具调用的关键能力：

- 工具 schema 使用什么格式。
- 工具结果如何回填。
- 是否必须保留工具调用 id。
- 是否支持 strict schema。
- 是否支持并行工具调用。
- 是否支持 deferred tool search。

完成后，DeepSeek / OpenAI-compatible 这类严格工具序列的 provider 不再靠零散字符串修补；后续接新 provider 时，也不需要把每个工具重新适配一遍。

## 为什么现在做

P23 多模态和插队修复里已经遇到同一类根因：

- DeepSeek 严格要求 `assistant.tool_calls` 后必须有对应 `tool` result。
- `TodoWrite` 如果没有常驻 schema，模型会猜成 `name / description` 这类错误参数。
- 工具执行中断、参数校验失败、读取失败都需要生成标准工具结果，否则历史恢复或下一轮请求会继续出问题。

这些问题本质上不是某一个工具坏了，而是 provider 工具协议能力没有统一入口。

## 迭代 1：目标拆解

第一轮先把稳定层目标拆成可落地范围。

要做：

1. 复核现有工具协议文档和 `STD-TOOL-01` 已完成内容。
2. 找到当前 provider adapter、model/provider 定义、工具 registry、TodoWrite schema 和 OpenAI-compatible 请求修复链路。
3. 设计第一版 `ProviderToolProfile` 类型和内置 profile 入口。
4. 明确 profile 只描述 provider 能力，不复制每个工具 schema。
5. 确认 `TodoWrite` 仍由工具 registry 定义一次，provider 只负责协议映射。
6. 补最小 smoke，验证 DeepSeek/OpenAI-compatible 的关键能力声明和错误路径没有回退。

## 迭代 2：边界收紧

第二轮在实现前把范围压小，避免把后续稳定层都混进来。

本阶段只做：

- `ProviderToolProfile` 或等价能力声明。
- DeepSeek / OpenAI-compatible 的工具协议 profile。
- 已有 OpenAI Chat / OpenAI-compatible 工具序列修复链路接入 profile 能力。
- `TodoWrite` 参数错误、工具执行失败、中断恢复相关 smoke 保持可验证。
- 标准文档和 todo 状态同步。

本阶段不做：

- 不抽 `CcrContentBlock`，留给 `STD-DISPLAY-01`。
- 不做完整 `ErrorSnapshot` UI，留给 `P24-1 / P24-2`。
- 不新增真实 provider。
- 不把所有 provider adapter 一次性重写。
- 不自动把非法 `name / description` 兼容成 TodoWrite 合法字段。
- 不打包，不发布。

## 实现约束

- Provider 工具能力必须有统一查询入口，避免各处硬编码 provider 名称。
- 核心工具 schema 仍由工具注册表维护；profile 只声明 provider 协议能力。
- OpenAI-compatible 不能默认等同完整 OpenAI 能力；DeepSeek 需要独立 profile。
- 校验失败、中断和执行失败仍要形成标准工具结果，不能留下悬空 tool call。
- UI 展示不能直接依赖 provider 原始结构。

## 验收标准

- 代码里存在可复用的 provider 工具能力声明与解析入口。
- DeepSeek / OpenAI-compatible 明确声明：
  - 工具 schema 为 JSON Schema function 风格。
  - 工具结果需要 `tool_call_id`。
  - `TodoWrite` 不走 deferred。
  - strict schema 支持是 provider 能力，不由所有中转默认继承。
- TodoWrite 非法参数仍进入标准错误结果，不被兼容成正常 Todo。
- 工具中断或缺失结果仍能被补成标准 synthetic tool result。
- smoke 覆盖 provider profile 解析和现有 DeepSeek/OpenAI-compatible 修复路径。

## 验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:provider-tool-profile
npm.cmd run smoke:openai-chat-protocol
npm.cmd run smoke:deepseek-provider
npm.cmd run smoke:desktop-display-events
npm.cmd run desktop:build
git diff --check
```

如果本阶段新增专用 smoke，需要把对应命令补进 `package.json` 并加入本 goal 的执行结果。

## 完成后下一步

本 goal 完成后，再进入稳定层第二项：

- `STD-DISPLAY-01 CcrContentBlock 共享类型`

如果 `STD-TOOL-02` 中发现错误展示模型缺口，只登记到 `P24-1 / P24-2`，不在本阶段直接扩散实现。

## 执行结果

状态：已完成实现与自动验证。

已完成：

- 新增 `LlmProviderToolProfile`，作为 provider 工具协议能力声明。
- 新增 `toolProtocolProfile` 解析入口，覆盖 DeepSeek、Codex OAuth、Anthropic、MiniMax、未知 OpenAI-chat compatible 和 custom 默认行为。
- OpenAI Chat adapter 已接入 profile，用于判断工具支持与 OpenAI-style `tool_call_id` 结果修复。
- 新增 `smoke:provider-tool-profile`，覆盖 DeepSeek profile、第三方 OpenAI-chat 中转默认 profile、Anthropic profile、custom 默认禁用 profile，以及缺失工具结果修复。
- `CHANGELOG.md`、Provider 工具协议文档、阶段 todo 已同步。

已完成验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:provider-tool-profile`
- `npm.cmd run smoke:openai-chat-protocol`
- `npm.cmd run smoke:deepseek-provider`
- `npm.cmd run smoke:desktop-display-events`
- `npm.cmd run desktop:build`
- `git diff --check`

未做：

- 未抽 `CcrContentBlock`，留给 `STD-DISPLAY-01`。
- 未做完整 `ErrorSnapshot` UI，留给 `P24-1 / P24-2`。
- 未打包、未发布。
