# ChatGPT Codex Plan Provider 接入设计

> 状态：历史方案，已被 `builtin-llm-runtime-design.md` 取代。
>
> 这份文档保留外部 Anthropic 兼容网关的过渡思路，仅作为背景参考；当前主线不再采用“前台 Claude 模型名、后台 Codex 模型映射”的长期方案。正式实施方案见 `docs/stages/builtin-llm-runtime-design.md`。

## 目标

当前项目没有 Claude / Anthropic 账号，但用户已经购买 ChatGPT 的 Codex plan，后续希望优先使用 ChatGPT 登录态对应的 Codex 额度，而不是走 OpenAI API key 计费。

本设计目标是：

- 尽量不改 `claude-code-reforged` 主链路。
- 优先接入 `codex-oauth`，复用 ChatGPT 登录态和 Codex plan。
- 为后续多种 LLM 接入预留统一 provider 层。
- 不把 OpenAI API key 作为主路线；API key 只是未来 `openai-api` provider 的一个备用后端。

## 现有可参考实现

参考项目：

- `D:\C_Project\adaptive-memory-agent`
- `D:\C_Project\adaptive-memory-agent\src\llm\codex-oauth-llm-service.ts`
- `D:\C_Project\adaptive-memory-agent\src\config\project-config.ts`
- `D:\C_Project\openclaw_compact_context\packages\llm-toolkit\src\sessions\openclaw-codex-oauth-session.ts`
- `D:\C_Project\openclaw_compact_context\packages\llm-toolkit\src\providers\openclaw-codex-oauth-provider.ts`

该实现已经证明一条可行路径：

```text
应用运行时
  -> LlmTextService
  -> llm-toolkit runtime
  -> codex-oauth provider
  -> OpenClawCodexOAuthSession
  -> ChatGPT/Codex OAuth
  -> https://chatgpt.com/backend-api
```

关键能力包括：

- 使用 OAuth PKCE 流程发起 ChatGPT/Codex 授权。
- 本地启动 `http://localhost:1455/auth/callback` 接收授权回调。
- 将 access / refresh / expires / accountId 保存到项目内凭据文件。
- 到期前自动 refresh。
- 支持环境变量覆盖，例如 `OPENCLAW_CODEX_OAUTH_ACCESS_TOKEN`。
- 通过 `@mariozechner/pi-ai` 的 `openai-codex-responses` 能力完成文本生成。
- 支持模型、推理强度、最大输出 token 等配置。

## 推荐总体架构

第一阶段不直接改 `claude-code-reforged` 的主模型调用代码，而是在外部加一个本地网关：

```text
claude-code-reforged
  -> ANTHROPIC_BASE_URL=http://127.0.0.1:8787
  -> cc-reforged-llm-gateway
      -> Anthropic Messages Adapter
      -> Provider Router
          -> codex-oauth provider
          -> openai-api provider
          -> anthropic provider
          -> openai-compatible provider
          -> local/ollama provider
```

这样 `claude-code-reforged` 仍走 Anthropic SDK 和原来的 tool loop，网关负责把 Anthropic Messages 协议翻译成内部统一 LLM provider 协议。

## Provider 分层

### 1. 外部协议层

对 `claude-code-reforged` 暴露 Anthropic 兼容接口。

第一版至少支持：

- `POST /v1/messages`
- `POST /v1/messages?beta=true`
- 基础错误结构
- 基础 usage 字段

后续再补：

- streaming SSE
- tool_use / tool_result
- image / file 输入
- prompt cache 近似映射
- beta 字段兼容

### 2. Anthropic 适配层

职责是把 Claude Code 发来的请求转换成内部通用请求。

输入：

```text
model
system
messages
tools
tool_choice
max_tokens
temperature
stream
betas
```

输出：

```text
ProviderGenerateRequest
  providerId
  model
  systemPrompt
  messages
  tools
  reasoningEffort
  maxOutputTokens
  stream
```

### 3. Provider Router

职责是按配置选择模型后端。

示例配置：

```json
{
  "defaultProvider": "codex-oauth",
  "providers": {
    "codex-oauth": {
      "type": "codex-oauth",
      "baseUrl": "https://chatgpt.com/backend-api",
      "credentialFilePath": "./data/codex-oauth.json",
      "model": "gpt-5.4",
      "availableModels": ["gpt-5.4"],
      "reasoningEffort": "high"
    },
    "openai-api": {
      "type": "openai-responses",
      "baseUrl": "https://api.openai.com/v1",
      "apiKeyEnv": "OPENAI_API_KEY",
      "model": "gpt-5.5"
    },
    "local": {
      "type": "openai-compatible-responses",
      "baseUrl": "http://127.0.0.1:11434/v1",
      "auth": "none",
      "model": "local-coder"
    }
  }
}
```

### 4. Codex OAuth Provider

第一版直接复用 `adaptive-memory-agent` 已验证的思路：

```text
CodexOAuthProvider
  -> OpenClawCodexOAuthSession
      -> beginAuthorization()
      -> exchangeAuthorizationCode()
      -> saveCredential()
      -> getValidCredential()
  -> OpenClawCodexOAuthTextProvider
      -> completeSimple(...)
```

注意：这里不是读取或伪造 Claude 账号，也不是把 ChatGPT token 硬塞给 Anthropic。它是一个独立的 `codex-oauth` provider，只是由外层网关把返回结果翻译成 Anthropic Messages 形状。

## 为什么这能解决前面的顾虑

之前担心点是“Codex ChatGPT plan 不是普通 OpenAI API key，直接读 token 或调私有接口不稳”。

现在参考 `adaptive-memory-agent` 后，路线可以收敛为：

- 认证由 `OpenClawCodexOAuthSession` 负责，不在 reforged 主项目里散落 token 读取逻辑。
- 凭据保存到独立文件，例如 `data/codex-oauth.json`，必须加入 `.gitignore`。
- token refresh 集中在 session 类内部。
- provider 只拿 `getValidCredential()` 返回的 access token，不关心 refresh 细节。
- 后续如果 Codex OAuth 细节变化，只替换 provider/session，不改 Claude Code 主循环。

## 第一版 POC 范围

第一版只做最小可跑闭环：

```text
claude-code-reforged -p "Reply exactly: OK"
  -> 本地 Anthropic 兼容网关
  -> codex-oauth provider
  -> 返回 Anthropic 非流式 message
```

第一版暂不做：

- 工具调用
- streaming SSE 完整兼容
- 图片和文件
- 多轮上下文压缩细节
- prompt cache 精确语义
- 费用统计精确对齐

这不是最终产品，只是先验证 `P2 真实模型单轮调用` 可以用 ChatGPT/Codex plan 跑通。

## Streaming 策略

`claude-code-reforged` 现有代码里已经包含“streaming 404 后退回 non-streaming”的逻辑。因此 POC 可以先采用：

- streaming 请求返回 404 或明确不支持。
- non-streaming `/v1/messages` 正常返回。
- 先让 headless prompt 跑通。

后续再实现 Anthropic SSE 事件：

```text
message_start
content_block_start
content_block_delta
content_block_stop
message_delta
message_stop
```

映射到 Codex/OpenAI 侧事件：

```text
response.created
response.output_text.delta
response.completed
error
```

## Tool Use 策略

Claude Code 的工具链依赖 Anthropic 的 `tool_use` / `tool_result` 语义，这是最难的长期部分。

第一版可以不支持工具调用，只验证真实模型回复。

第二版再做：

- Anthropic tool schema -> provider function schema。
- provider function call -> Anthropic `tool_use` block。
- Claude Code 执行工具后产生 `tool_result`。
- `tool_result` 再转回 provider input。

如果 Codex ChatGPT provider 对工具事件支持不完整，可以在网关里先做“本地工具代理”，由网关自身执行工具；但这会和 Claude Code 原工具系统重叠，不建议第一版做。

## 落地步骤

### 第 1 步：抽出 Gateway 目录

建议在仓库内新增：

```text
packages/llm-gateway/
  src/
    server.ts
    config.ts
    anthropic/
      messages-adapter.ts
      response-adapter.ts
    providers/
      provider-types.ts
      codex-oauth-provider.ts
      openai-api-provider.ts
    auth/
      codex-oauth-session.ts
  data/
    .gitkeep
```

### 第 2 步：迁移 Codex OAuth Session

从 `llm-toolkit` 迁移或依赖：

- `OpenClawCodexOAuthSession`
- `OpenClawCodexOAuthTextProvider`
- `LlmTextProvider`
- `LlmProviderAvailability`

优先策略：

- 如果要快速 POC：直接复制最小实现到 `packages/llm-gateway`。
- 如果要长期复用：把 `llm-toolkit` 发布/引入成独立包，避免硬编码 `D:\C_Project\...` 绝对路径。

### 第 3 步：实现最小 `/v1/messages`

输入 Anthropic：

```json
{
  "model": "gpt-5.4",
  "max_tokens": 128,
  "messages": [
    { "role": "user", "content": "Reply exactly: OK" }
  ]
}
```

输出 Anthropic：

```json
{
  "id": "msg_local_xxx",
  "type": "message",
  "role": "assistant",
  "model": "gpt-5.4",
  "content": [
    { "type": "text", "text": "OK" }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0
  }
}
```

### 第 4 步：连接 reforged

启动网关后：

```powershell
$env:ANTHROPIC_BASE_URL = "http://127.0.0.1:8787"
$env:ANTHROPIC_API_KEY = "local-placeholder"
node .\cli.js -p "Reply exactly: OK" --model gpt-5.4 --output-format json --no-session-persistence
```

这里的 `ANTHROPIC_API_KEY` 只是为了让 Anthropic SDK 通过本地客户端认证检查，不是真实 Anthropic key。

### 第 5 步：回填 P2

当真实模型单轮调用跑通后，更新：

- `docs/stages/real-runtime-e2e-todo.md`
- P2 从 blocked 改成 completed。
- 记录认证来源：`codex-oauth provider / ChatGPT Codex plan`。
- 记录模型、推理强度、返回结构、是否 streaming fallback。

## 风险与边界

- 不把 Codex OAuth token 提交到 Git。
- 不把 `data/codex-oauth.json` 打包进 npm 包。
- 不把 ChatGPT 登录态伪装成 Anthropic 官方账号。
- 不在 `claude-code-reforged` 主循环里散落 Codex 私有细节。
- 所有 Codex OAuth 行为集中在 provider/session 内。
- 如果 Codex backend 或 `@mariozechner/pi-ai` 行为变化，只替换 provider，不改上层架构。

## 当前结论

可以做，而且比“直接改 Claude Code 内核”更稳。

推荐立即走：

```text
本地 Anthropic 兼容网关
  -> codex-oauth provider
  -> 先跑通非流式文本
  -> 再补 streaming
  -> 再补 tool use
```

这条路线同时满足：

- 使用 ChatGPT/Codex plan。
- 尽量不改 reforged 主代码。
- 未来可切换多种 LLM。
- 认证、模型、协议翻译都有清晰边界。
