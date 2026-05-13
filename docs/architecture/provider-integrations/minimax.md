# MiniMax 供应商接入记录

## 接入目标

把 MiniMax 按地区拆成两个内置供应商类型：

- `minimax`：MiniMax 国际版，面向海外用户。
- `minimax-cn`：MiniMax 国内版，面向中国大陆用户。

两者都只是供应商分类。真正可切换和保存凭据的是 Profile，也就是一条具体连接配置。

## 官方资料

- MiniMax Anthropic 兼容接口：<https://platform.minimax.io/docs/api-reference/text-anthropic-api>
- MiniMax Anthropic 文本聊天接口：<https://platform.minimax.io/docs/api-reference/text-chat-anthropic>
- MiniMax AI Coding Tools 接入说明：<https://platform.minimax.io/document/guides_coding_m1>
- MiniMax OpenAI 兼容接口：<https://platform.minimax.io/docs/api-reference/text-openai-api>

## 当前方案

当前只把 MiniMax 接入 Anthropic Messages 兼容协议。

原因：

- MiniMax 官方给 AI 编程工具的推荐配置就是 Anthropic-compatible。
- Anthropic Messages 原生支持 `tool_use` / `tool_result`，和 CCR 当前工具链更贴近。
- 本地实测 MiniMax OpenAI Chat 端点对系统消息和工具字段更挑剔，容易返回 `invalid chat setting (2013)`。
- OpenAI Chat 公共适配器已经被 DeepSeek 等供应商复用，MiniMax 的特殊规则不应继续污染这条公共链路。

MiniMax OpenAI 兼容端点暂不作为 Desktop 可选分支；如果以后要恢复，也必须作为独立 provider/protocol 分支，不复用当前 MiniMax provider。

## 供应商定义

| 供应商 ID | 名称 | 协议 | 认证 | 默认 Base URL |
| --- | --- | --- | --- | --- |
| `minimax` | MiniMax 国际版 | `anthropic-messages` | API Key | `https://api.minimax.io/anthropic` |
| `minimax-cn` | MiniMax 国内版 | `anthropic-messages` | API Key | `https://api.minimaxi.com/anthropic` |

Anthropic SDK 会在 Base URL 后请求 `/v1/messages`，所以实际请求地址分别是：

- `https://api.minimax.io/anthropic/v1/messages`
- `https://api.minimaxi.com/anthropic/v1/messages`

## 模型目录

第一版内置两个常用模型：

| 模型 ID | 显示名 |
| --- | --- |
| `MiniMax-M2.7` | MiniMax M2.7 |
| `MiniMax-M2.7-highspeed` | MiniMax M2.7 Highspeed |

能力声明：

- `supportsTools=true`
- `supportsReasoning=true`
- `supportsUsage=true`
- `inputModalities=['text']`

图片能力暂不接入。当前目标是代码工具链可用，而不是补 MiniMax 的多模态分支。

## 配置结构

普通配置写入 `llm.config.local.json`：

```json
{
  "schemaVersion": 2,
  "current": {
    "profileId": "minimax-cn-1",
    "model": "MiniMax-M2.7"
  },
  "profiles": {
    "minimax-cn-1": {
      "name": "MiniMax 国内版",
      "providerType": "minimax-cn",
      "apiMode": "anthropic-messages",
      "endpoint": {
        "baseUrl": "https://api.minimaxi.com/anthropic"
      },
      "auth": {
        "strategy": "api_key"
      },
      "defaultModel": "MiniMax-M2.7",
      "models": {
        "source": "builtin",
        "default": "MiniMax-M2.7",
        "include": ["MiniMax-M2.7-highspeed"]
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
    "minimax-cn-1": {
      "type": "api_key",
      "providerType": "minimax-cn",
      "apiKey": "sk-..."
    }
  }
}
```

关键不变式：

- 一个 Profile 对应一个凭据槽。
- Profile ID 创建后保持稳定，改名只改 `name`。
- 不把 API Key 写进 `llm.config.local.json`。
- 不把国际版和国内版混成一个 provider 后再靠 base URL 猜地区。

## 请求链路

```text
Core LlmRuntime
-> MiniMaxProvider
-> providerCredentials.getLlmProviderApiKey(profileId)
-> AnthropicMessagesAdapter
-> https://api.minimax.io/anthropic/v1/messages
```

`MiniMaxProvider` 只保留供应商差异：

- 地区对应的默认 Base URL。
- API Key 环境变量。
- 默认模型。
- Profile / 凭据读取。

messages、system、tools、tool result、usage 和 stop reason 都由 `AnthropicMessagesAdapter` 处理。

## 环境变量

国际版：

- `CCR_MINIMAX_API_KEY`
- `MINIMAX_API_KEY`
- `CCR_MINIMAX_BASE_URL`
- `MINIMAX_BASE_URL`

国内版：

- `CCR_MINIMAX_CN_API_KEY`
- `MINIMAX_CN_API_KEY`
- `CCR_MINIMAXI_API_KEY`
- `MINIMAXI_API_KEY`
- `CCR_MINIMAX_CN_BASE_URL`
- `MINIMAX_CN_BASE_URL`
- `CCR_MINIMAXI_BASE_URL`
- `MINIMAXI_BASE_URL`

环境变量只作为本地覆盖或临时验证入口，正式 Desktop 配置仍然优先使用 Profile 和凭据文件。

## 代码落点

- 供应商定义：`src/services/llm/providerDefinitions.ts`
- 默认配置：`src/services/llm/llmConfig.ts`
- 模型目录：`src/services/llm/modelCatalog.ts`
- 供应商壳：`src/services/llm/providers/MiniMaxProvider.ts`
- Anthropic 兼容适配器：`src/services/llm/protocols/anthropicMessagesAdapter.ts`
- Runtime 注册：`src/services/llm/defaultRuntime.ts`
- 可用性状态：`src/services/llm/runtimeStatus.ts`
- 验证脚本：`scripts/smoke-minimax-provider.mjs`

## 验证

```powershell
npm.cmd run build -- --pretty false
npm.cmd run smoke:minimax-provider
```

验证内容：

- 国际版请求落到 `https://api.minimax.io/anthropic/v1/messages`。
- 国内版请求落到 `https://api.minimaxi.com/anthropic/v1/messages`。
- API Key 按 `profileId` 从 `profileCredentials` 读取。
- 系统消息合并到 Anthropic Messages 的顶层 `system`。
- tools 映射为 Anthropic `tools`，并使用 `tool_choice: { "type": "auto" }`。
- 响应中的 `text`、`thinking`、`tool_use` 和 usage 能归一化成 CCR 的 `LlmGenerateResponse`。

## OpenAI Chat 分支结论

MiniMax OpenAI Chat 分支已经从当前 MiniMax provider 摘除。

保留结论：

- OpenAI Chat 公共适配器继续服务 DeepSeek 等真正兼容的供应商。
- MiniMax 不再通过 `OpenAiChatCompletionsAdapter` 发送请求。
- 如果未来要支持 MiniMax OpenAI 兼容接口，应新增独立 profile 类型或独立 provider，不能把 MiniMax 特例塞回公共 OpenAI Chat 默认行为。

## 后续

- 继续用真实 MiniMax Anthropic 端点观察工具调用闭环。
- 根据真实返回补齐 thinking / redacted thinking 的边界测试。
- 如果官方模型目录变化，只更新模型目录和文档，不改变 Profile / 凭据结构。
