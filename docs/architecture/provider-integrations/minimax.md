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
- MiniMax 国际版图片生成：<https://platform.minimax.io/docs/api-reference/image-generation-t2i>
- MiniMax 国内版图片生成：<https://platform.minimaxi.com/docs/api-reference/image-generation-t2i>

## 当前方案

当前文本聊天把 MiniMax 接入 Anthropic Messages 兼容协议；图片生成走 MiniMax 原生 `image_generation` 接口。

文本聊天选择 Anthropic-compatible 的原因：

- MiniMax 官方给 AI 编程工具的推荐配置就是 Anthropic-compatible。
- Anthropic Messages 原生支持 `tool_use` / `tool_result`，和 CCR 当前工具链更贴近。
- 本地实测 MiniMax OpenAI Chat 端点对系统消息和工具字段更挑剔，容易返回 `invalid chat setting (2013)`。
- OpenAI Chat 公共适配器已经被 DeepSeek 等供应商复用，MiniMax 的特殊规则不应继续污染这条公共链路。

MiniMax OpenAI 兼容端点暂不作为 Desktop 可选分支；如果以后要恢复，也必须作为独立 provider/protocol 分支，不复用当前 MiniMax provider。

图片生成不走 Anthropic-compatible，也不复用 OpenAI Images API 壳。它在 `MiniMaxProvider.generateImage(...)` 中走原生地址：

- 国际版：`https://api.minimax.io/v1/image_generation`
- 国内版：`https://api.minimaxi.com/v1/image_generation`

## 供应商定义

| 供应商 ID | 名称 | 协议 | 认证 | 默认 Base URL |
| --- | --- | --- | --- | --- |
| `minimax` | MiniMax 国际版 | `anthropic-messages` | API Key | `https://api.minimax.io/anthropic` |
| `minimax-cn` | MiniMax 国内版 | `anthropic-messages` | API Key | `https://api.minimaxi.com/anthropic` |

Anthropic SDK 会在 Base URL 后请求 `/v1/messages`，所以实际请求地址分别是：

- `https://api.minimax.io/anthropic/v1/messages`
- `https://api.minimaxi.com/anthropic/v1/messages`

## 模型目录

文本模型第一版内置两个常用模型：

| 模型 ID | 显示名 |
| --- | --- |
| `MiniMax-M2.7` | MiniMax M2.7 |
| `MiniMax-M2.7-highspeed` | MiniMax M2.7 Highspeed |

图片生成模型：

| 模型 ID | 显示名 | 输出能力 |
| --- | --- | --- |
| `image-01` | MiniMax Image 01 | 图片输出 |
| `image-01-live` | MiniMax Image 01 Live | 图片输出 |

能力声明：

- `supportsTools=true`
- `supportsReasoning=true`
- `supportsUsage=true`
- `inputModalities=['text']`

`MiniMax-M2.7` / `MiniMax-M2.7-highspeed` 当前按文本模型处理，不声明图片 / 视频输入。`image-01` / `image-01-live` 的能力声明为文本输入、图片输出。默认图片模型通过 provider metadata 声明为 `image-01`。

MiniMax 的多模态方向要分开看：

- 文本聊天：当前走 Anthropic Messages compatible，第一版只启用文本输入、工具和 thinking。
- 图片生成：已走原生 `image_generation`，输出会落到 CCR 生成物模型。
- 图生图 / 图片编辑：不是当前 `LlmImageGenerationRequest` 的稳定字段，后续需要单独扩展 reference image / mask / edit 参数。
- 视频 / 音频生成：不进入当前正式版主线，后续再按生成物生命周期单开阶段。

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

图片生成链路：

```text
Core LlmRuntime.generateImage(...)
-> MiniMaxProvider.generateImage(...)
-> MiniMaxImageGenerationAdapter
-> https://api.minimax.io/v1/image_generation
-> normalizeGeneratedImageOutputs(...)
-> CcrImageContentBlock + CcrGeneratedArtifactSnapshot
```

普通会话流里的图片生成链路：

```text
turn/start options.imageGeneration
-> normalizeTurnStartInputForCurrentModel(...)
-> CoreSessionService
-> runCoreImageGenerationTurn(...)
-> LlmRuntime.generateImage(...)
-> MiniMaxProvider.generateImage(...)
-> item_completed assistant_message(contentBlocks: image + generatedArtifact)
-> Desktop DisplayEvent(AttachmentSnapshot.source = ModelOutput)
```

这条链路和 OpenAI 共享同一套 `CcrImageContentBlock` / `generatedArtifact` / `savedPath` 展示模型。Desktop 不区分 MiniMax raw `image_base64` 或 OpenAI raw `b64_json`，只消费 CCR 归一化后的内容块。

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
- 图片生成适配器：`src/services/llm/protocols/minimaxImageGenerationAdapter.ts`
- 通用图片输出归一化：`src/services/llm/protocols/generatedImageOutputAdapter.ts`
- 会话流图片 runner：`src/core/coreImageGenerationTurnRunner.ts`
- App Server 图片生成输入归一化：`src/app-server/turnInput.ts`
- Runtime 注册：`src/services/llm/defaultRuntime.ts`
- 可用性状态：`src/services/llm/runtimeStatus.ts`
- 验证脚本：`scripts/smoke-minimax-provider.mjs`

## 验证

```powershell
npm.cmd run build -- --pretty false
npm.cmd run smoke:minimax-provider
npm.cmd run smoke:generated-output-provider
npm.cmd run smoke:provider-output-fixtures
npm.cmd run smoke:session-generated-image-flow
npm.cmd run smoke:model-capabilities
```

验证内容：

- 国际版请求落到 `https://api.minimax.io/anthropic/v1/messages`。
- 国内版请求落到 `https://api.minimaxi.com/anthropic/v1/messages`。
- API Key 按 `profileId` 从 `profileCredentials` 读取。
- 系统消息合并到 Anthropic Messages 的顶层 `system`。
- tools 映射为 Anthropic `tools`，并使用 `tool_choice: { "type": "auto" }`。
- 响应中的 `text`、`thinking`、`tool_use` 和 usage 能归一化成 CCR 的 `LlmGenerateResponse`。
- MiniMax 图片生成请求落到 `/v1/image_generation`。
- `response_format=base64` 时图片落盘为 `generated_outputs/<sessionId>/<outputId>.png`。
- `response_format=url` 时输出临时 URL 图片块，不把 URL 图片误当成本地落盘文件。
- 展示事件和恢复 payload 不直接泄露 MiniMax raw `image_base64`。
- 普通会话流中的图片生成会输出标准 `contentBlocks` / `generatedArtifact`，Desktop 展示 `ModelOutput/generated`。

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
