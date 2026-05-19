# 2026-05-19 STD-PROVIDER-01 Kimi / GLM Provider 接入

## 背景

当前 CCR 已经具备多 provider 接入主干：

- `codex-oauth`：已接入 Codex OAuth / ChatGPT backend。
- `deepseek`：已按 OpenAI Chat compatible 接入。
- `minimax` / `minimax-cn`：文本走 Anthropic Messages compatible，图片生成走 MiniMax 原生接口。
- `openai`：已接入官方 OpenAI 文本和图片生成链路。

用户当前可真实验证的 provider 包括：Codex OAuth、DeepSeek、MiniMax、Kimi、GLM。暂时没有 Anthropic API Key，因此 Anthropic 官方 provider 标准化不作为下一条真实联网主线，只保留 fixture / mock 级推进。

本阶段要把 Kimi / GLM 按真实产品边界拆成独立供应商接入，而不是把它们伪装成 OpenAI，也不是靠 base URL 猜产品环境。`kimi-api` / `glm-api` / `glm-coding` 复用公共 `openai-chat` 协议链路；`kimi-code` 作为 Coding Agent 场景入口，按官方第三方工具口径走 `anthropic-messages`。

拆分后的第一版 provider：

| Provider ID | 场景 | 默认 Base URL |
| --- | --- | --- |
| `kimi-api` | Kimi 开放平台通用 API | `https://api.moonshot.cn/v1` |
| `kimi-code` | Kimi Code 编程场景 | `https://api.kimi.com/coding` |
| `glm-api` | GLM 通用开放平台 API | `https://open.bigmodel.cn/api/paas/v4` |
| `glm-coding` | GLM Coding Plan | `https://open.bigmodel.cn/api/coding/paas/v4` |

长期路线图：[CCR LLM Provider 与多模态协议长期路线图](../architecture/llm-provider-protocol-long-term-roadmap.md)。

本阶段只是长期路线图 L1 的第一步，不代表 CCR 的多模型 / 多模态目标只剩 Kimi 和 GLM。后续还包括 Gateway profile、Anthropic、Gemini、Structured Output、图生图、音频生成、文件生成和 provider conformance matrix。

## 第一版目标

1. Kimi API provider 第一版：
   - 新增 `kimi-api` provider definition。
   - 新增默认配置、环境变量、Profile 凭据读取。
   - 新增模型目录和能力声明。
   - 新增 `KimiApiProvider`，复用 `OpenAiChatCompletionsAdapter`。
2. Kimi Code provider 第一版：
   - 新增 `kimi-code` provider definition。
   - 请求 `model` 字段固定为统一模型标识 `kimi-for-coding`，不把它当成具体底层模型。
   - 明确会员订阅、频控和编程场景边界；产品集成应走 `kimi-api`。
   - 新增 `KimiCodeProvider`，复用 `AnthropicMessagesAdapter`。
3. GLM API provider 第一版：
   - 新增 `glm-api` provider definition。
   - 新增默认配置、环境变量、Profile 凭据读取。
   - 新增模型目录和能力声明。
   - 新增 `GlmApiProvider`，复用 `OpenAiChatCompletionsAdapter`。
4. GLM Coding provider 第一版：
   - 新增 `glm-coding` provider definition。
   - 默认端点必须是 Coding API 专用地址。
   - 新增 `GlmCodingProvider`，复用 `OpenAiChatCompletionsAdapter`。
5. OpenAI Chat compatible 公共链路不被污染：
   - Kimi / GLM 的差异通过 provider options 或 provider 壳表达。
   - 不让 Kimi / GLM 改变 DeepSeek、OpenAI-compatible 默认行为。
6. 验证与回归：
   - provider fixture 覆盖文本、stream、tools、tool result、错误快照。
   - smoke 覆盖 provider 请求构造、响应归一化和 history repair。
   - 回归 Codex OAuth / DeepSeek / MiniMax 现有 smoke。

## 非目标

- 不做 Anthropic 官方 provider 真实联网验证。
- 不做 Gemini `GenerateContent` adapter。
- 不做 Gateway / OpenRouter / Vercel AI Gateway 完整 profile 管理。
- 不把 Structured Output 产品化。
- 不把 Kimi / GLM 的图片生成、图生图、音频或文件生成纳入第一版。
- 不让 Desktop 直接消费 Kimi / GLM 任一 provider 的原始响应。

## 执行顺序

1. 准备阶段：
   - 复核官方文档和当前可用 key。
   - 确认第一版请求 `model` 字段和能力声明口径；Kimi Code 的 `kimi-for-coding` 只作为统一模型标识。
   - 明确 Kimi API / Kimi Code / GLM API / GLM Coding 是否有 thinking、tool、vision 等 provider 特有字段。
2. Kimi 接入：
   - 补 `providerDefinitions.ts`、`llmConfig.ts`、`modelCatalog.ts`。
   - 新增 `KimiApiProvider.ts` / `KimiCodeProvider.ts`。
   - 补 fixture 和 smoke。
   - 更新 [Kimi / Moonshot 供应商接入记录](../architecture/provider-integrations/kimi.md)。
3. GLM 接入：
   - 补 `providerDefinitions.ts`、`llmConfig.ts`、`modelCatalog.ts`。
   - 新增 `GlmApiProvider.ts` / `GlmCodingProvider.ts`。
   - 补 fixture 和 smoke。
   - 更新 [GLM / Z.AI 供应商接入记录](../architecture/provider-integrations/glm.md)。
4. 回归：
   - 回归 OpenAI Chat compatible 公共 adapter。
   - 回归 Codex OAuth、DeepSeek、MiniMax。
   - 更新 [CCR 协议统一化接入状态总账](../architecture/protocol-implementation-status.md)。

## 验收

- `model/list` 能看到 `kimi-api` / `kimi-code` / `glm-api` / `glm-coding` provider 和对应模型目录。
- `llm.config.local.json` 能表达四类 Profile，凭据仍写入 `llm.credentials.local.json`。
- `kimi-code` 和 `kimi-api` 在文档 / 配置语义里明确区分：前者是会员订阅的编程场景入口，后者是按量付费的开放平台入口。
- 四类 provider 文本响应能归一化为 CCR 标准 `text` 内容块。
- 四类 provider stream 能进入统一 `LlmGenerateEvent`。
- `kimi-api` / `glm-api` / `glm-coding` tools 按 OpenAI-style 映射，`kimi-code` tools 按 Anthropic-style 映射，并能回放 tool result 历史。
- 四类 provider 错误能进入 `ErrorSnapshot`，至少区分 auth、rate limit、quota、network、protocol、unknown。
- Desktop 只消费 CCR 标准 `contentBlocks` / `DisplayEvent`，不消费 provider raw response。

## 验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:kimi-glm-providers
npm.cmd run smoke:provider-output-fixtures
npm.cmd run smoke:llm-runtime
npm.cmd run smoke:desktop-display-events
git diff --check
```

如新增单独 smoke，命名建议：

```powershell
npm.cmd run smoke:kimi-provider
npm.cmd run smoke:glm-provider
```

如果拆成更细脚本，命名建议：

```powershell
npm.cmd run smoke:kimi-api-provider
npm.cmd run smoke:kimi-code-provider
npm.cmd run smoke:glm-api-provider
npm.cmd run smoke:glm-coding-provider
```

真实联网 probe 不进入默认 smoke。若本机具备 key，可单独执行 provider probe，并在本文追加脱敏验证记录。

## 当前状态

- 已完成第一版。
- Kimi / GLM 长期 provider 接入文档已建立，并已拆分通用 API 与 Coding Plan / Code provider 边界。
- 已新增 `kimi-api` / `kimi-code` / `glm-api` / `glm-coding` provider definition、默认配置、模型目录、provider 壳、fixture 和 smoke。
- `kimi-api` / `glm-api` / `glm-coding` 复用公共 `OpenAiChatCompletionsAdapter`，`kimi-code` 复用公共 `AnthropicMessagesAdapter`；四个 provider 都保留独立 providerType、base URL、模型标识和凭据环境变量。
- `kimi-code` 的 `kimi-for-coding` 只作为统一模型标识处理，不用于推断底层模型能力。
- 真实配置中曾验证到 `kimi-code` 走 OpenAI Chat 兼容路径会返回 403；已修正为 Anthropic Messages `/v1/messages` 路径。
- 已验证：`npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run smoke:kimi-glm-providers`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-runtime`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:openai-chat-protocol`、`npm.cmd run smoke:deepseek-provider`、`npm.cmd run smoke:minimax-provider`、`npm.cmd run smoke:model-capabilities`、`npm.cmd run smoke:desktop-display-events`、`git diff --check`。
- 真实联网 probe 未纳入默认 smoke；需要用户准备 Kimi / GLM 对应 API Key 后单独执行。
