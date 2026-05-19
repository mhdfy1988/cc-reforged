# Kimi / Moonshot 供应商接入记录

## 接入目标

Kimi 也不能只做成一个 provider。官方文档把 Kimi 开放平台和 Kimi Code 平台分开：

- Kimi 开放平台：通用 API，面向产品集成、团队协作和多模态应用开发。
- Kimi Code：会员权益下的编程场景服务，面向 CLI、IDE 和第三方 Coding Agent。

因此第一版拆成两个内置供应商类型：

| Provider ID | 显示名 | 场景 | 默认 Base URL |
| --- | --- | --- | --- |
| `kimi-api` | Kimi API / Moonshot | 通用开放平台 API、按量调用、产品集成 | `https://api.moonshot.cn/v1` |
| `kimi-code` | Kimi Code | Kimi Code 会员权益、Coding Agent、第三方开发工具 | `https://api.kimi.com/coding` |

Kimi API 走 OpenAI Chat compatible；Kimi Code 第一版走 Anthropic Messages compatible，不能再按 OpenAI Chat compatible 调 `kimi-for-coding`。二者不能在同一个 `kimi` provider 下靠 base URL 猜场景。Kimi Code 还有统一模型标识、专用额度和客户端身份约束，长期需要单独表达。

当前状态：已完成第一版。代码里已经有内置 `kimi-api` / `kimi-code` provider 定义、默认配置、模型目录、provider 壳、fixture 和 smoke；真实联网 probe 需要单独准备 API Key 后执行，不进入默认 smoke。

## 官方资料

- Kimi Chat Completions：<https://platform.kimi.ai/docs/api/chat>
- Kimi Code Provider / Model 文档：<https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/providers-and-models.html>
- Kimi Code 第三方 Coding Agent 文档：<https://www.kimi.com/code/docs/third-party-tools/other-coding-agents.html>
- Kimi Code 错误说明：<https://www.kimi.com/code/docs/kimi-code/error-reference.html>

## 平台差异与使用边界

| 对比项 | Kimi Code 平台 | Kimi 开放平台 |
| --- | --- | --- |
| OpenAI 兼容 Base URL | `https://api.kimi.com/coding/v1` | `https://api.moonshot.cn/v1` |
| Anthropic 兼容 Base URL | `https://api.kimi.com/coding` | 暂不作为本阶段入口 |
| CCR 当前接入协议 | `anthropic-messages` | `openai-chat` |
| 计费方式 | 会员订阅，按月 / 年付费，有频控限制 | 按量付费，充值即用 |
| 最佳场景 | 终端 / IDE Agent 编程、多文件工程任务 | 产品集成、企业级调用、多模态应用开发 |

接入原则：

- `kimi-code` 只作为编程场景 provider，用于终端 / IDE Agent / 第三方 Coding Agent。
- 产品集成、团队协作、用量管理和企业级调用应走 `kimi-api` 开放平台。
- `kimi-code` 的专用额度、频控和会员权益不能和开放平台余额混用。
- `kimi-code` 第一版走 Anthropic 兼容地址；历史 Profile 里填了 `https://api.kimi.com/coding/v1`、`/v1/messages` 或 `/v1/chat/completions` 时，provider 壳会归一化到 `https://api.kimi.com/coding`。

## 供应商定义

| 字段 | `kimi-api` | `kimi-code` |
| --- | --- | --- |
| 协议 | `openai-chat` | `anthropic-messages` |
| 认证 | `api_key` | `api_key`，官方客户端可走 OAuth 但第一版不接 |
| 默认 Base URL | `https://api.moonshot.cn/v1` | `https://api.kimi.com/coding` |
| 实际聊天路径 | `/chat/completions` | `/v1/messages` |
| 请求 `model` 字段 | 接入时按官方当前推荐和本机可用 key 决定，例如 `kimi-k2.6` | 统一模型标识 `kimi-for-coding`，不代表具体底层模型 |
| 计费 / 权益 | Kimi 开放平台余额 / 按量计费 | Kimi Code 会员订阅额度 |
| 场景边界 | 通用对话、长上下文、多模态、产品集成 | Coding Agent、CLI/IDE、第三方开发工具 |

说明：真实 probe 曾在 OpenAI 兼容路径上收到 `403 Forbidden`，错误体提示 `kimi-for-coding` 只对 Coding Agent 场景开放。按官方 Kimi Code 第三方工具文档，CCR 作为 Coding Agent 应走 Anthropic 兼容的 `/v1/messages` 路径，不再把 `kimi-code` 当作 OpenAI Chat 兼容 provider。

## 第一版能力边界

| 能力 | `kimi-api` | `kimi-code` |
| --- | --- | --- |
| 文本生成 | 应接入 | 应接入 |
| 流式输出 | 应接入 | 应接入 |
| 工具调用 | 应接入并用公共 OpenAI-style tool profile 验证 | 应接入并用 Anthropic-style tool profile 验证 |
| thinking / reasoning | 按 Kimi API 模型能力声明 | 按 `kimi-code` provider 能力声明，不能从 `kimi-for-coding` 推断底层模型能力 |
| 多模态输入 | `kimi-k2.6` 支持图片 / 视频内容块；CCR 已在模型目录声明文本+图片+视频，并在 OpenAI Chat compatible adapter 映射 `image_url` / `video_url` | 第一版按文本输入处理；不把 `kimi-for-coding` 统一标识推断成通用多模态模型 |
| 图片 / 音频 / 文件生成 | 不作为第一版目标 | 不作为第一版目标 |
| Structured Output | Kimi API 有 JSON mode / JSON schema 入口，后续跟 `structured` 专项收口 | 不作为第一版目标 |

## 配置结构

Kimi API Profile：

```json
{
  "schemaVersion": 2,
  "current": {
    "profileId": "kimi-api-1",
    "model": "<kimi-api-model>"
  },
  "profiles": {
    "kimi-api-1": {
      "name": "Kimi API",
      "providerType": "kimi-api",
      "apiMode": "openai-chat",
      "endpoint": {
        "baseUrl": "https://api.moonshot.cn/v1"
      },
      "auth": {
        "strategy": "api_key"
      },
      "defaultModel": "<kimi-api-model>",
      "models": {
        "source": "builtin",
        "default": "<kimi-api-model>"
      }
    }
  }
}
```

Kimi Code Profile：

说明：下面配置里的 `model` / `defaultModel` 是 CCR 配置字段名，对 `kimi-code` 来说它保存的是 API 要求的统一模型标识 `kimi-for-coding`，不是具体底层模型名称。

```json
{
  "schemaVersion": 2,
  "current": {
    "profileId": "kimi-code-1",
    "model": "kimi-for-coding"
  },
  "profiles": {
    "kimi-code-1": {
      "name": "Kimi Code",
      "providerType": "kimi-code",
      "apiMode": "anthropic-messages",
      "endpoint": {
        "baseUrl": "https://api.kimi.com/coding"
      },
      "auth": {
        "strategy": "api_key"
      },
      "defaultModel": "kimi-for-coding",
      "models": {
        "source": "builtin",
        "default": "kimi-for-coding"
      }
    }
  }
}
```

敏感凭据仍写入 `llm.credentials.local.json`，并按 `profileId` 隔离：

```json
{
  "schemaVersion": 2,
  "profileCredentials": {
    "kimi-api-1": {
      "type": "api_key",
      "providerType": "kimi-api",
      "apiKey": "sk-..."
    },
    "kimi-code-1": {
      "type": "api_key",
      "providerType": "kimi-code",
      "apiKey": "sk-..."
    }
  }
}
```

## 请求链路

```text
Core LlmRuntime
-> KimiApiProvider
-> providerCredentials.getLlmProviderApiKey(profileId)
-> OpenAiChatCompletionsAdapter
-> https://api.moonshot.cn/v1/chat/completions

Core LlmRuntime
-> KimiCodeProvider
-> providerCredentials.getLlmProviderApiKey(profileId)
-> AnthropicMessagesAdapter
-> https://api.kimi.com/coding/v1/messages
```

Provider 壳第一版只保留供应商差异：

- 默认 base URL。
- API Key 环境变量。
- 请求 `model` 字段和模型能力目录。
- Kimi API 的长上下文、多模态、JSON mode / JSON schema 能力。
- Kimi Code 的统一模型标识、会员订阅额度、频控和编程场景提示。

`kimi-api` 的 messages、stream、tools、usage、tool call 和 stop reason 默认交给公共 `OpenAiChatCompletionsAdapter`。

`kimi-code` 的 messages、stream、tools、usage、tool use 和 stop reason 默认交给公共 `AnthropicMessagesAdapter`，由 provider 壳只负责 Kimi Code 的 base URL、模型标识和凭据读取。

## 环境变量建议

Kimi API：

- `CCR_KIMI_API_KEY`
- `KIMI_API_KEY`
- `MOONSHOT_API_KEY`
- `CCR_KIMI_API_BASE_URL`
- `KIMI_API_BASE_URL`
- `MOONSHOT_BASE_URL`

Kimi Code：

- `CCR_KIMI_CODE_API_KEY`
- `KIMI_CODE_API_KEY`
- `CCR_KIMI_CODE_BASE_URL`
- `KIMI_CODE_BASE_URL`

正式 Desktop 配置仍以 Profile 凭据为准；环境变量只用于本地验证和 CI smoke。

## 验收要求

第一版不能只证明 HTTP 能通。至少要覆盖：

1. `kimi-api` / `kimi-code` 是两个独立 provider type。
2. 两类 Profile 能分别读取独立凭据。
3. `kimi-api` 请求落到 `https://api.moonshot.cn/v1/chat/completions`。
4. `kimi-code` 请求落到 `https://api.kimi.com/coding/v1/messages`。
5. `kimi-code` 请求 `model` 字段固定为统一模型标识 `kimi-for-coding`。
6. Desktop / 配置文档能区分 `kimi-code` 会员订阅权益和 `kimi-api` 开放平台按量付费。
7. 文本响应能归一化成 `CcrContentBlock text`。
8. stream delta 能进入统一 `LlmGenerateEvent`。
9. `kimi-api` tools 按 OpenAI-style 映射，`kimi-code` tools 按 Anthropic-style 映射，并能回放 tool result 历史。
10. provider 输出 fixture 至少覆盖文本、工具调用、工具结果、错误。
11. Desktop 不消费 Kimi raw response，只消费 CCR 标准展示事件。

## 代码落点

- 供应商定义：`src/services/llm/providerDefinitions.ts`
- 默认配置：`src/services/llm/llmConfig.ts`
- 模型目录：`src/services/llm/modelCatalog.ts`
- 供应商壳：`src/services/llm/providers/KimiProvider.ts`
- 共享 OpenAI Chat provider 壳：`src/services/llm/providers/OpenAiChatCompatibleProvider.ts`
- 公共协议适配器：`src/services/llm/protocols/openaiChatCompletionsAdapter.ts`
- 公共 Anthropic Messages 适配器：`src/services/llm/protocols/anthropicMessagesAdapter.ts`
- 凭据存储：`src/services/llm/providerCredentials.ts`
- provider fixture：`src/services/llm/fixtures/provider-output-fixtures.json`

## 已知边界

- 不把 Kimi 伪装成 OpenAI；`kimi-api` / `kimi-code` 都应是独立 `providerType`。
- 不靠 base URL 猜开放平台还是 Kimi Code，必须由 `providerType` 显式决定。
- 如果用户使用国际站或历史配置里的 `https://api.moonshot.ai/v1`，应作为 Profile base URL override 处理，不改变 `kimi-api` 供应商语义。
- 产品集成、团队协作和用量管理不能走 `kimi-code`；应引导用户创建 `kimi-api` Profile。
- 不靠模型名猜多模态、工具或 structured output 能力；能力必须落到 `modelCatalog.ts` 或 Profile override。
- Kimi Code 需要保持工具真实身份标识；不要靠伪造 User-Agent 绕过官方使用边界。
- 如果 Kimi 的工具、thinking、长上下文字段和公共 OpenAI Chat / Anthropic Messages 默认行为不同，应在对应 provider 壳或独立 options 中显式表达，不污染公共适配器默认行为。

## 第一版实现记录

- `kimi-api` 默认模型目录为 `kimi-k2.6`，默认 base URL 为 `https://api.moonshot.cn/v1`。
- `kimi-k2.6` 能力目录已声明 `text + image + video` 输入，文本输出，支持工具。
- `kimi-api` 的图片 / 视频输入复用 OpenAI Chat compatible 内容数组，分别映射为 `image_url` / `video_url`。
- `kimi-api` 的 `kimi-k2.6` 真实 probe 返回 `temperature` 只允许 `1`；provider 壳已把该模型的请求温度固定为 `1`，不影响其他 OpenAI Chat compatible provider。
- `kimi-code` 默认请求 `model` 字段为 `kimi-for-coding`，并在 provider 配置和模型目录里标记 `modelIdentifierKind: "unified"`。
- `kimi-code` 默认 base URL 为 `https://api.kimi.com/coding`，请求由 `AnthropicMessagesAdapter` 落到 `/v1/messages`；历史 OpenAI 兼容 base URL 会在 provider 壳里归一化。
- `kimi-code` 仍按文本输入处理，不能从 `kimi-for-coding` 这个统一标识推断底层多模态能力。
- API Key 环境变量：
  - Kimi API：`CCR_KIMI_API_KEY`、`KIMI_API_KEY`、`MOONSHOT_API_KEY`。
  - Kimi Code：`CCR_KIMI_CODE_API_KEY`、`KIMI_CODE_API_KEY`。
- Base URL 环境变量：
  - Kimi API：`CCR_KIMI_API_BASE_URL`、`KIMI_API_BASE_URL`、`MOONSHOT_BASE_URL`。
  - Kimi Code：`CCR_KIMI_CODE_BASE_URL`、`KIMI_CODE_BASE_URL`。
- 已补 fixture：`provider-kimi-api-text`、`provider-kimi-code-tool-call`。
- 已补 smoke：`smoke:kimi-api-provider`、`smoke:kimi-code-provider`、`smoke:kimi-glm-providers`；其中 `kimi-code` 覆盖 Anthropic Messages 路径、stream 和工具归一化。
- 已验证：`npm.cmd run smoke:kimi-glm-providers`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-runtime`。
