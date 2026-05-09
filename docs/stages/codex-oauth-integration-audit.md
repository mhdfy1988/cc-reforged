# Codex OAuth 接入溯源审计

审计日期：2026-04-25

## 1. 审计结论

这份文档用于回答一个核心问题：当前 `claude-code-reforged` 的 Codex OAuth 接入到底哪些来自原项目，哪些来自成熟参考实现，哪些是我们自己补出来的，以及这些差异是否有证据支撑。

当前结论：

- `src/services/llm/` 不是 Claude Code 原版代码，而是 `feature/builtin-llm-runtime` 分支新增的通用 LLM Runtime。
- `CodexOAuthSession` 的登录、凭据保存、refresh、PKCE 授权 URL 生成，主要参考了本机已有成熟实现 `openclaw_compact_context` 和 `adaptive-memory-agent` 的思路。
- `CodexOAuthProvider` 没有完全照搬成熟案例。成熟案例使用 `completeSimple` 包装一轮文本生成；当前 CCR provider 为了接入 Claude 主循环、历史消息、工具调用和流式事件，走了更底层的 `complete / stream`。
- `complete / stream` 这条路不是错误方向，但前置论证不足。更稳的后续做法是补一次 `completeSimple / streamSimple` 对照 spike，确认能否在保留工具/历史能力的同时减少与成熟案例的偏差。
- 当前把默认 transport 固定为 `sse` 是基于本机真实入口验证的兼容修复，不是 Codex 官方公开文档承诺，也不是成熟案例原样默认值。
- `chatgpt.com/backend-api/codex/responses` 属于 Codex/ChatGPT 后端相关行为，不应被当作公开稳定 OpenAI API 契约；它只能由官方 Codex 源码、`pi-ai` 源码、成熟本地实现和真实验证共同约束。

## 2. 证据来源

| 来源 | 路径或链接 | 用途 | 证据强度 |
| --- | --- | --- | --- |
| OpenAI Help Center | [Codex CLI and Sign in with ChatGPT](https://help.openai.com/en/articles/11381614) | 证明 Codex CLI 支持 ChatGPT 登录，并会本地保存凭据 | 官方公开说明 |
| OpenAI Help Center | [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540) | 证明 Codex Local / CLI / IDE / app 可用 ChatGPT 计划登录 | 官方公开说明 |
| Codex 本地源码 | [app-server README](D:/agent_project/codex-main/codex-rs/app-server/README.md) | 证明 Codex app-server 有 `chatgpt` / `chatgptDeviceCode` 登录模式和 token refresh 概念 | 官方源码快照 |
| Codex 本地源码 | [backend-client](D:/agent_project/codex-main/codex-rs/backend-client/src/client.rs) | 证明 ChatGPT 后端请求使用 `Authorization` 与 `ChatGPT-Account-Id` 类头部 | 官方源码快照 |
| 成熟案例 | [openclaw-codex-oauth-provider.ts](D:/C_Project/openclaw_compact_context/packages/llm-toolkit/src/providers/openclaw-codex-oauth-provider.ts) | Codex OAuth provider 成熟写法，对照 `completeSimple`、`baseUrl`、模型、transport、reasoning | 本机已实现参考 |
| 成熟案例 | [codex-oauth-llm-service.ts](D:/C_Project/adaptive-memory-agent/src/llm/codex-oauth-llm-service.ts) | 应用层如何封装 Codex OAuth runtime、登录状态和文本生成 | 本机已实现参考 |
| 第三方依赖 | [pi-ai openai-codex-responses.js](D:/agent_project/claude-code-reforged/node_modules/@mariozechner/pi-ai/dist/providers/openai-codex-responses.js) | 证明 `transport`、`reasoningEffort`、Codex responses body、WebSocket/SSE 行为 | 依赖源码 |
| 第三方依赖 | [pi-ai openai-codex-responses.d.ts](D:/agent_project/claude-code-reforged/node_modules/@mariozechner/pi-ai/dist/providers/openai-codex-responses.d.ts) | 证明底层 `streamOpenAICodexResponses` options 使用 `reasoningEffort` | 依赖类型声明 |
| 当前 CCR | [CodexOAuthProvider.ts](D:/agent_project/claude-code-reforged/src/services/llm/providers/CodexOAuthProvider.ts) | 当前 provider 转换逻辑与真实调用点 | 当前实现 |
| 当前 CCR | [CodexOAuthSession.ts](D:/agent_project/claude-code-reforged/src/services/llm/sessions/CodexOAuthSession.ts) | 当前 OAuth session、凭据路径、refresh、浏览器登录 | 当前实现 |
| 当前 CCR | [claudeApiAdapter.ts](D:/agent_project/claude-code-reforged/src/services/llm/claudeApiAdapter.ts) | Claude 主循环消息与 LLM Runtime 请求之间的转换边界 | 当前实现 |

## 3. 哪些是原版代码，哪些是我们新增

### 原版相关代码

这些属于原 Claude Code 主链路或原项目恢复代码，不是 Codex OAuth 新接入层：

- `src/services/api/claude.ts`
- `src/query.ts`
- `src/QueryEngine.ts`
- `src/types/message.ts`
- `src/utils/messages.ts`
- 工具执行、权限审批、MCP、REPL/TUI 主循环等既有模块

当前设计原则是：这些主循环领域逻辑尽量不重写，只在模型调用边界做 provider-aware 接入。

### 我们新增或改造的代码

这些是 `feature/builtin-llm-runtime` 分支新增的通用 LLM Runtime 相关内容：

- `src/services/llm/types.ts`
- `src/services/llm/providerRegistry.ts`
- `src/services/llm/llmRuntime.ts`
- `src/services/llm/defaultRuntime.ts`
- `src/services/llm/llmConfig.ts`
- `src/services/llm/providerDefinitions.ts`
- `src/services/llm/modelCatalog.ts`
- `src/services/llm/runtimeStatus.ts`
- `src/services/llm/claudeApiAdapter.ts`
- `src/services/llm/providers/AnthropicProvider.ts`
- `src/services/llm/providers/CodexOAuthProvider.ts`
- `src/services/llm/sessions/CodexOAuthSession.ts`
- `src/services/llm/sessions/defaultCodexOAuthSession.ts`

补充说明：当前 `git status` 显示 `src/services/llm/` 仍是未跟踪的新目录，这进一步证明它不是原版恢复代码，而是本分支新增层。

## 4. 成熟案例到底怎么做

### openclaw_compact_context

参考文件：[openclaw-codex-oauth-provider.ts](D:/C_Project/openclaw_compact_context/packages/llm-toolkit/src/providers/openclaw-codex-oauth-provider.ts)

关键行为：

- 引入 `completeSimple as piCompleteSimple`。
- 默认 `baseUrl` 是 `https://chatgpt.com/backend-api`。
- 默认模型是 `gpt-5.4`。
- 默认 transport 是 `auto`。
- `generateText(input)` 接收简单文本 prompt。
- 调用 `completeSimple(model, context, options)`。
- options 里传的是 `reasoning: reasoningEffort`。

成熟案例的重点不是“完整 agent 主循环”，而是“文本 provider 能通过 Codex OAuth 生成回复”。它没有覆盖 CCR 当前需要承接的完整 Claude 回合形态，例如：

- assistant 历史消息回放
- tool_call 输出
- tool_result 回放
- usage 归一化到 Claude 主循环
- `StreamEvent` 事件协议适配

### adaptive-memory-agent

参考文件：[codex-oauth-llm-service.ts](D:/C_Project/adaptive-memory-agent/src/llm/codex-oauth-llm-service.ts)

关键行为：

- 应用层通过 `createLlmToolkitRuntime(...)` 构建 runtime。
- 通过 `OpenClawCodexOAuthSession` 管理登录态。
- `generateReply()` 调用 `registry.generateWithOrder(...)`。
- 输入仍是应用层文本 prompt，而不是 Claude Code 的工具调用主循环。

这个案例证明 Codex OAuth 可以在本机跑通，也证明配置、session、runtime 分层是可行的。但它不等价于 CCR 的直接实现模板，因为 CCR 需要把 Claude Code 原有消息协议转接到通用 LLM runtime。

## 5. pi-ai 依赖行为对照

参考文件：

- [stream.js](D:/agent_project/claude-code-reforged/node_modules/@mariozechner/pi-ai/dist/stream.js)
- [openai-codex-responses.js](D:/agent_project/claude-code-reforged/node_modules/@mariozechner/pi-ai/dist/providers/openai-codex-responses.js)
- [openai-codex-responses.d.ts](D:/agent_project/claude-code-reforged/node_modules/@mariozechner/pi-ai/dist/providers/openai-codex-responses.d.ts)
- [types.d.ts](D:/agent_project/claude-code-reforged/node_modules/@mariozechner/pi-ai/dist/types.d.ts)

关键事实：

- `complete(model, context, options)` 本质是 `stream(...).result()`。
- `completeSimple(model, context, options)` 本质是 `streamSimple(...).result()`。
- `streamSimpleOpenAICodexResponses(...)` 会把 `SimpleStreamOptions.reasoning` 转成底层 `reasoningEffort`。
- `streamOpenAICodexResponses(...)` 的底层 options 字段是 `reasoningEffort`，不是 `reasoning`。
- `streamOpenAICodexResponses(...)` 中 `transport = options?.transport || "sse"`。
- 当 transport 不是 `sse` 时，会先尝试 WebSocket；如果 WebSocket 已经启动后失败，错误不会再自动回退到 SSE。

因此，当前 CCR 如果直接用 `complete / stream`，就必须自己传 `reasoningEffort`。之前直接传 `reasoning` 是错误的，因为那是 `completeSimple / streamSimple` 的 options 口径。

## 6. 为什么当前 CCR 和成熟案例不同

差异一：调用层级不同。

成熟案例：

```text
generateText(prompt)
  -> completeSimple(model, simpleContext, simpleOptions)
```

当前 CCR：

```text
queryModelWithStreaming(...)
  -> claudeApiAdapter
  -> LlmRuntime.stream(...)
  -> CodexOAuthProvider.stream(...)
  -> pi-ai stream(model, fullContext, providerOptions)
```

差异二：输入协议不同。

成熟案例输入是单轮文本 prompt。当前 CCR 输入是 Claude Code 主循环里的 `UserMessage / AssistantMessage / tool_use / tool_result / BetaToolUnion`，需要先转换为项目自己的 `LlmMessage / LlmToolDefinition`，再转换成 `pi-ai` 的 `Context / Tool`。

差异三：输出协议不同。

成熟案例只需要返回文本。当前 CCR 需要把 Codex 输出映射回 Claude Code 的流式事件、最终 assistant message、tool_use、usage、request id 等。

差异四：options 口径不同。

成熟案例使用 `completeSimple`，所以 `reasoning` 是正确入口。当前 CCR 使用 `complete / stream`，所以必须传 `reasoningEffort`。

差异五：transport 默认值不同。

成熟案例默认 `auto`。当前 CCR 临时固定 `sse`，原因是本机真实 `ccr -p` 验证中 `auto` 会进入 WebSocket 并返回 `WebSocket closed 1011`。这个修复解决了当前产品入口，但还没有证明成熟案例在同样环境下不会遇到同样问题。

## 7. 当前已验证事实

本轮已验证：

- `auth status --json` 能识别 `codex-oauth / gpt-5.4` 登录态。
- `CodexOAuthProvider` 在 `sse` transport 下可以真实请求 `gpt-5.4` 并返回内容。
- `ccr -p "用中文一句话回复：CCR Codex OAuth 已连接"` 已返回 `CCR Codex OAuth 已连接。`
- `npm.cmd run typecheck -- --pretty false` 通过。
- `npm.cmd run build -- --pretty false` 通过。
- `npm.cmd run smoke:codex-oauth-provider` 通过。
- `npm.cmd run smoke:llm-config` 通过。
- `npm.cmd run smoke:llm-claude-adapter` 通过。

本轮没有验证：

- 交互式客户端完整多轮会话。
- 工具调用真实闭环。
- tool_result 回放后的下一轮模型响应。
- token 到期后的真实 refresh。
- `auto` transport 在成熟案例里的表现。
- `streamSimple / completeSimple` 是否能替代当前 `stream / complete`，同时保留工具和历史消息能力。
- Codex 后端在不同账号、不同计划、不同额度状态下的错误格式。

## 8. 当前风险判断

### 高风险

`chatgpt.com/backend-api/codex/responses` 不是公开稳定 OpenAI API 文档承诺。它来自 Codex/ChatGPT 后端行为和第三方依赖封装，后续可能变化。

### 中风险

当前使用 `complete / stream` 而不是成熟案例的 `completeSimple / streamSimple`，增加了入参口径漂移风险。虽然当前已修正 `reasoningEffort`，但仍建议补一次对照 spike。

### 中风险

`sse` 默认值是本机真实入口修复，不是成熟案例原始默认。它解决了 `WebSocket closed 1011`，但也意味着暂时放弃了 WebSocket/session 复用潜在收益。

### 中风险

工具 schema 从 Anthropic `BetaToolUnion.input_schema` 转到 `pi-ai` / OpenAI Responses function schema，目前只做了最小透传，还没有做严格 schema 规范化和不兼容字段清洗。

### 低风险

OAuth session 代码与成熟案例高度一致，且本地登录态已经跑通。主要剩余风险是 refresh 失败处理、凭据格式变动和敏感信息泄露防护。

## 9. 后续必须补的验证矩阵

| 验证项 | 目的 | 当前状态 | 建议命令或动作 |
| --- | --- | --- | --- |
| `ccr -p` 单轮文本 | 证明 CLI 真实入口可用 | 已通过 | `node --no-warnings --experimental-loader ./bun-bundle-loader.mjs ./cli.js -p "..."` |
| provider 真实直连 | 证明 OAuth + model + SSE 可用 | 已通过 | 直接构造 `CodexOAuthProvider.generate(...)` |
| 交互式客户端 | 证明 TUI/REPL 主入口可用 | 未验证 | 启动 `ccr`，输入简单问题 |
| 工具调用 | 证明 `tool_call` 可生成并被主循环执行 | 未验证 | 让模型读取一个小文件或运行只读命令 |
| tool_result 回放 | 证明工具结果能继续作为上下文输入 | 未验证 | 工具调用后追问“刚才文件里有什么” |
| token refresh | 证明过期凭据能刷新 | 未验证 | 使用 mock session 或临时过期凭据验证，不打印 token |
| `auto` transport 对照 | 判断是否能回到成熟案例默认 | 未验证 | 对当前 provider 与 OpenClaw provider 分别跑 `auto` |
| `streamSimple` spike | 判断是否能减少偏差 | 未验证 | 新增临时分支或脚本对比 `stream` 与 `streamSimple` |
| schema 清洗 | 避免 Anthropic schema 直接污染 Responses tools | 未完成 | 收集实际工具 schema，做 JSON Schema 兼容检查 |

## 10. 下一步建议

建议先做两个短任务，不继续盲目堆功能。

### 任务一：`streamSimple / completeSimple` 对照 spike

目标：

- 用当前 `toPiAiMessages(...)` 和 `toPiAiTools(...)` 生成同样的 `PiAiContext`。
- 分别走 `stream` 与 `streamSimple`。
- 比较文本、工具调用、usage、错误行为和 transport 行为。

结论标准：

- 如果 `streamSimple` 能覆盖当前需要，优先改回更贴近成熟案例的 `streamSimple / completeSimple`。
- 如果 `streamSimple` 不够，保留 `stream / complete`，但必须在代码注释和文档里写明原因。

### 任务二：真实工具调用闭环验证

目标：

- 不先重构。
- 用现有 `sse + reasoningEffort` 修复后的代码，验证真实 `tool_call -> tool_result -> next assistant`。
- 如果失败，先抓 payload 和 schema 差异，不猜网络、不猜代理。

## 11. 安全约束

- 不读取、不打印、不提交 `C:\Users\luoji\.ccr\data\codex-oauth.json` 的内容。
- 文档只允许记录凭据文件路径和脱敏状态，不允许记录 access token、refresh token、id token、authorization code。
- 所有真实请求验证输出只保留模型名、provider、stop reason、脱敏错误和文本结果。

## 12. 复盘

这次问题的根因不是单个 bug，而是接入流程不严谨：

- 已有成熟案例没有先完整对照。
- 第三方依赖源码没有先逐字段核对。
- 官方公开资料和官方源码的边界没有先写清楚。
- 真实失败后曾错误地先猜代理方向。

已补规则：

- [AGENTS.md](D:/agent_project/claude-code-reforged/AGENTS.md) 已增加本仓库 Provider / OAuth / SDK 接入护栏。
- 项目规则现在明确承接全局“查询优先、试错其次”，并强化到 LLM provider / OAuth / SDK 场景。

后续执行要求：

- 遇到 provider、OAuth、SDK、外部协议、成熟库行为，不允许直接写。
- 必须先对照官方资料、成熟本地实现和依赖源码。
- 如果本机已有跑通过的实现，默认先复用；要偏离必须说明原因并补验证。
