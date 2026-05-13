# DeepSeek 供应商接入记录

## 接入目标

`deepseek` 是 CCR 第一个官方 API Key 类供应商，用来验证公共 OpenAI Chat Completions 适配器可以支撑真实第三方模型。

DeepSeek 不伪装成 OpenAI，也不走 Codex OAuth；它是独立供应商类型，Profile 只保存具体账号、endpoint、模型和可用性状态。

## 供应商定义

| 字段 | 值 |
| --- | --- |
| 供应商 ID | `deepseek` |
| 显示名 | `DeepSeek` |
| 协议 | `openai-chat` |
| 认证 | `api_key` |
| 默认 Base URL | `https://api.deepseek.com` |
| 默认模型 | `deepseek-v4-flash` |

## 模型目录

| 模型 ID | 显示名 | 上下文 | 最大输出 |
| --- | --- | --- | --- |
| `deepseek-v4-flash` | DeepSeek V4 Flash | 1000K | 384K |
| `deepseek-v4-pro` | DeepSeek V4 Pro | 1000K | 384K |

模型目录里标记：

- `protocol: openai-chat`
- `thinkingDefault: enabled`
- `supportsTools: true`
- `supportsReasoning: true`

## 配置结构

普通配置写入 `llm.config.local.json`：

```json
{
  "schemaVersion": 2,
  "current": {
    "profileId": "deepseek-1",
    "model": "deepseek-v4-flash"
  },
  "profiles": {
    "deepseek-1": {
      "name": "DeepSeek API Key",
      "providerType": "deepseek",
      "apiMode": "openai-chat",
      "endpoint": {
        "baseUrl": "https://api.deepseek.com"
      },
      "auth": {
        "strategy": "api_key"
      },
      "defaultModel": "deepseek-v4-flash",
      "models": {
        "source": "builtin",
        "default": "deepseek-v4-flash",
        "include": ["deepseek-v4-pro"]
      }
    }
  }
}
```

敏感凭据写入 `llm.credentials.local.json`：

```json
{
  "schemaVersion": 2,
  "profileCredentials": {
    "deepseek-1": {
      "type": "api_key",
      "providerType": "deepseek",
      "apiKey": "sk-..."
    }
  }
}
```

关键不变式：

- API Key 按 `profileId` 存储。
- 同一个 DeepSeek 供应商下可以有多个 Profile。
- 哪怕两个 Profile 使用相同 key 字符串，也分别保存。
- `baseUrl` 可以按 Profile 覆盖，用于官方 endpoint 或专用网关。

## 请求链路

```text
Core LlmRuntime
-> DeepSeekProvider
-> providerCredentials.getLlmProviderApiKey(profileId)
-> OpenAiChatCompletionsAdapter
-> https://api.deepseek.com/chat/completions
```

`DeepSeekProvider` 只保留供应商差异：

- 默认 base URL。
- API Key 环境变量。
- 默认模型。
- `deepseek-v4-*` 模型默认开启 `thinking`。
- 默认 `reasoning_effort` 为 `high`。

messages、tools、stream、usage、tool call 和 stop reason 都由公共 `OpenAiChatCompletionsAdapter` 处理。

## 环境变量

API Key：

- `CCR_DEEPSEEK_API_KEY`
- `DEEPSEEK_API_KEY`

Base URL：

- `CCR_DEEPSEEK_BASE_URL`
- `DEEPSEEK_BASE_URL`

环境变量优先级高于 Profile 凭据，主要用于临时验证和 CI smoke；正式 Desktop 配置应写入 Profile 凭据。

## 代码落点

- 供应商定义：`src/services/llm/providerDefinitions.ts`
- 默认配置：`src/services/llm/llmConfig.ts`
- 模型目录：`src/services/llm/modelCatalog.ts`
- 供应商壳：`src/services/llm/providers/DeepSeekProvider.ts`
- 公共协议适配器：`src/services/llm/protocols/openaiChatCompletionsAdapter.ts`
- 凭据存储：`src/services/llm/providerCredentials.ts`
- 可用性状态：`src/services/llm/runtimeStatus.ts`

## 验证

```powershell
npm.cmd run build -- --pretty false
npm.cmd run smoke:deepseek-provider
npm.cmd run smoke:openai-chat-protocol
```

验证内容：

- Profile `deepseek-2` 能读取自己的 API Key。
- 请求落到 `https://api.deepseek.com/chat/completions`。
- `Authorization` 使用当前 Profile 对应 key。
- `thinking` 和 `reasoning_effort` 正确注入。
- tools 能映射为 OpenAI Chat `function` 工具。
- 响应中的 `reasoning_content`、text、tool_calls 和 usage 能归一化。

## 后续

- 如果 DeepSeek 官方协议字段变化，只调整 `DeepSeekProvider` 的供应商差异或公共 OpenAI Chat 适配器。
- 如果后续引入 DeepSeek 多模态模型，需要先补模型目录能力声明和多模态请求映射。
