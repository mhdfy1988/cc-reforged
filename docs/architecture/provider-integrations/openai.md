# OpenAI 供应商接入记录

## 接入目标

`openai` 是 CCR 内置 API Key 供应商，目标是同时覆盖文本会话、工具调用和模型生成图片，并把不同 OpenAI 图片生成路径归一化为同一套 CCR 生成物结构。

这里记录的是长期接入口径，不是某一轮 goal。阶段实现记录仍放在 `../../goals/`。

## 当前方案

文本会话走 OpenAI Chat Completions 兼容协议；图片生成有两条可选路径：

- 默认路径：`POST /images/generations`，默认图片模型为 `gpt-image-1`。
- Responses hosted tool 路径：`POST /responses` + `tools: [{ type: "image_generation" }]`，用于对齐 `image_generation_call.result` 这类输出。

Responses hosted tool 路径已经抽成公共协议层，不绑定 `openai` 供应商本身；以后如果 OpenAI-compatible / Gateway profile 也支持这一方式，可以复用同一个 `OpenAiResponsesHostedImageGenerationAdapter`，只替换 base URL 和认证 header。

两条图片路径最终都进入通用图片生成归一化层，输出 `CcrImageContentBlock` 和 `CcrGeneratedArtifactSnapshot`，Desktop 和历史恢复只消费 CCR 标准结构。

## 供应商定义

| 供应商 ID | 名称 | 文本协议 | 认证 | 默认 Base URL |
| --- | --- | --- | --- | --- |
| `openai` | OpenAI | `openai-chat` | API Key | `https://api.openai.com/v1` |

内置默认：

- 文本默认模型：`gpt-5.4`
- 图片默认模型：`gpt-image-1`
- 供应商 metadata：`defaultImageModel: "gpt-image-1"`

## 模型目录

| 模型 ID | 用途 | 能力 |
| --- | --- | --- |
| `gpt-5.4` | 文本会话 | 文本/图片输入，文本输出，工具调用 |
| `gpt-image-1` | 图片生成 | 文本输入，图片输出 |

说明：如果 Profile 显式配置了其他模型，当前运行时会尊重配置；内置目录只记录 CCR 第一版稳定维护的默认模型和能力口径。

## 配置结构

普通配置写入 `llm.config.local.json`：

```json
{
  "schemaVersion": 2,
  "current": {
    "profileId": "openai-1",
    "model": "gpt-5.4"
  },
  "profiles": {
    "openai-1": {
      "name": "OpenAI",
      "providerType": "openai",
      "apiMode": "openai-chat",
      "auth": {
        "strategy": "api_key"
      },
      "defaultModel": "gpt-5.4",
      "models": {
        "source": "builtin",
        "default": "gpt-5.4",
        "include": ["gpt-image-1"]
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
    "openai-1": {
      "type": "api_key",
      "providerType": "openai",
      "apiKey": "sk-..."
    }
  }
}
```

环境变量可作为本地覆盖：

- `CCR_OPENAI_API_KEY`
- `OPENAI_API_KEY`
- `CCR_OPENAI_BASE_URL`
- `OPENAI_BASE_URL`

关键不变式：

- API Key 不写入 `llm.config.local.json`。
- Profile ID 创建后保持稳定，凭据按 `profileId` 查找。
- Desktop 不直接消费 OpenAI raw response。
- 图片生成 base64 必须先落盘或清理后再进入展示/恢复链路。

## 请求链路

文本会话链路：

```text
Core LlmRuntime.stream(...)
-> OpenAiProvider.stream(...)
-> OpenAiChatCompletionsAdapter
-> POST https://api.openai.com/v1/chat/completions
-> LlmGenerateEvent / LlmGenerateResponse
```

图片生成默认链路：

```text
Core LlmRuntime.generateImage(...)
-> OpenAiProvider.generateImage(...)
-> OpenAiImageGenerationAdapter
-> POST https://api.openai.com/v1/images/generations
-> normalizeOpenAiImageGenerationResponse(...)
-> normalizeGeneratedImageOutputs(...)
-> CcrImageContentBlock + CcrGeneratedArtifactSnapshot
```

Responses 图片生成链路：

```text
Core LlmRuntime.generateImage(...)
-> OpenAiProvider.generateImage(...)
-> OpenAiResponsesImageGenerationAdapter
-> OpenAiResponsesHostedImageGenerationAdapter
-> POST https://api.openai.com/v1/responses
-> image_generation_call.result
-> normalizeOpenAiImageGenerationCall(...)
-> normalizeGeneratedImageOutputs(...)
-> CcrImageContentBlock + CcrGeneratedArtifactSnapshot
```

Responses 路由由请求 metadata 决定：

- `useResponsesImageGeneration: true`
- `imageGenerationApi: "responses"`
- `imageGenerationApi: "openai-responses"`
- `apiMode: "openai-responses"`

## 普通会话流入口

Desktop 或 App Server 可以在 `turn/start` 的 `options.imageGeneration` 中请求图片生成：

```json
{
  "threadId": "thread_...",
  "input": {
    "type": "text",
    "text": "/image 画一张桌面端会话流图片"
  },
  "options": {
    "imageGeneration": {
      "enabled": true,
      "prompt": "画一张桌面端会话流图片",
      "model": "gpt-image-1",
      "size": "1024x1024",
      "outputFormat": "png"
    }
  }
}
```

Core 侧由 `CoreSessionService` 识别 `metadata.imageGeneration`，切到 `runCoreImageGenerationTurn(...)`：

```text
turn/start
-> normalizeTurnStartInputForCurrentModel(...)
-> CoreSessionService.startTurn(...)
-> shouldRunCoreImageGenerationTurn(...)
-> runCoreImageGenerationTurn(...)
-> LlmRuntime.generateImage(...)
-> item_completed assistant_message(contentBlocks: image + generatedArtifact)
-> Desktop DisplayEvent(AttachmentSnapshot.source = ModelOutput)
```

Desktop 主进程当前还支持轻量触发前缀，例如 `/image ...`、`/imagine ...`、`生成图片：...`。这些前缀只是入口适配，真正状态仍以 `options.imageGeneration` 和 Core metadata 为准。

## 输出映射

OpenAI raw 响应不会直接进入 UI。映射规则：

| OpenAI 字段 | CCR 字段 |
| --- | --- |
| `data[].b64_json` | 落盘为 `generated_outputs/<sessionId>/<outputId>.png` |
| `data[].url` | `CcrImageContentBlock.source.kind = "url"` |
| `data[].revised_prompt` | `revisedPrompt` |
| `image_generation_call.id` / `call_id` | `outputId` / 生成调用 ID |
| `image_generation_call.result` | 落盘后清理，不回灌大 base64 |

输出不变式：

- `origin` 固定为 `model_output`。
- `lifecycle` 第一版使用 `temporary` 或落盘工具返回值。
- `safety` 第一版默认 `needs_review`。
- `savedPath` 优先供 Desktop 展示、打开、定位、复制路径。
- thread resume 只带轻量引用，清掉 `previewDataUrl`、大 inline `data` 和 `image_generation_call.result`。

## 代码落点

- 供应商定义：`src/services/llm/providerDefinitions.ts`
- 默认配置：`src/services/llm/llmConfig.ts`
- 模型目录：`src/services/llm/modelCatalog.ts`
- 供应商壳：`src/services/llm/providers/OpenAiProvider.ts`
- 文本适配器：`src/services/llm/protocols/openaiChatCompletionsAdapter.ts`
- Images API 适配器：`src/services/llm/protocols/openaiImageGenerationAdapter.ts`
- Responses hosted tool 通用适配器：`src/services/llm/protocols/openaiResponsesHostedImageGenerationAdapter.ts`
- OpenAI API Key 包装适配器：`src/services/llm/protocols/openaiResponsesImageGenerationAdapter.ts`
- 图片路由：`src/services/llm/openaiImageGenerationRouting.ts`
- 通用图片输出归一化：`src/services/llm/protocols/generatedImageOutputAdapter.ts`
- 会话流图片 runner：`src/core/coreImageGenerationTurnRunner.ts`
- App Server 输入归一化：`src/app-server/turnInput.ts`
- Desktop 入口适配：`apps/desktop/src/main/index.ts`

## 验证

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:generated-output-provider
npm.cmd run smoke:provider-output-fixtures
npm.cmd run smoke:session-generated-image-flow
npm.cmd run smoke:desktop-display-events
```

验证内容：

- Images API 和 Responses `image_generation_call` 共享同一归一化结构。
- `gpt-image-1` 默认走 Images API；显式 metadata 可切到 Responses image generation。
- 生成图片落盘到 `generated_outputs/<sessionId>/<outputId>.<ext>`。
- Desktop 展示 `ModelOutput/generated` 附件快照，并优先使用 `savedPath`。
- 普通会话事件流输出标准 `contentBlocks` / `generatedArtifact`。
- resume payload 不包含 provider raw base64。

## 后续

- 真实联网 E2E 仍应作为人工验证或单独 probe，不放入默认 smoke。
- 后续如支持图生图、图片编辑、音频或文件生成，应先扩展通用 `generatedArtifact` 生命周期和安全策略，再补 provider adapter。
