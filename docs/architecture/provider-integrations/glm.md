# GLM / BigModel 供应商接入记录

## 接入目标

GLM 在 CCR 里不能只做成一个 provider。官方文档明确区分通用 API 端点和 Coding Plan 专用端点：

- 通用 API：`https://open.bigmodel.cn/api/paas/v4`
- Coding Plan：`https://open.bigmodel.cn/api/coding/paas/v4`

因此第一版拆成两个内置供应商类型：

| Provider ID | 显示名 | 场景 | 默认 Base URL |
| --- | --- | --- | --- |
| `glm-api` | GLM API | 通用开放平台 API、按量调用、产品集成 | `https://open.bigmodel.cn/api/paas/v4` |
| `glm-coding` | GLM Coding Plan | Coding Agent / 指定工具和产品环境 | `https://open.bigmodel.cn/api/coding/paas/v4` |

二者都先按 OpenAI Chat compatible 接入，但不能在同一个 `glm` provider 下靠 base URL 猜场景。原因是 Coding Plan 有专用端点、使用范围、额度策略和模型推荐，和通用 API 的计费/权益语义不同。

当前状态：已完成第一版。代码里已经有内置 `glm-api` / `glm-coding` provider 定义、默认配置、模型目录、provider 壳、fixture 和 smoke；真实联网 probe 需要单独准备 API Key 后执行，不进入默认 smoke。

## 官方资料

- 智谱开放平台 API 使用概述：<https://docs.bigmodel.cn/cn/api/introduction>
- GLM-5V-Turbo 模型说明：<https://docs.bigmodel.cn/cn/guide/models/vlm/glm-5v-turbo>
- GLM-Image 模型说明：<https://docs.bigmodel.cn/cn/guide/models/image-generation/glm-image>
- 图像生成 API：<https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%9B%BE%E5%83%8F%E7%94%9F%E6%88%90>
- GLM Coding Plan 接入工具说明：<https://docs.bigmodel.cn/cn/coding-plan/tool/others>
- Z.AI Chat Completion：<https://docs.z.ai/api-reference/llm/chat-completion>

## 供应商定义

| 字段 | `glm-api` | `glm-coding` |
| --- | --- | --- |
| 协议 | `openai-chat` | `openai-chat` |
| 认证 | `api_key` | `api_key` |
| 默认 Base URL | `https://open.bigmodel.cn/api/paas/v4` | `https://open.bigmodel.cn/api/coding/paas/v4` |
| 实际聊天路径 | `/chat/completions` | `/chat/completions` |
| 默认模型 | `glm-5.1` | `glm-5.1` |
| 计费 / 权益 | 通用 API 余额或资源包 | GLM Coding Plan 订阅权益 |
| 场景边界 | 通用对话、多模态、产品集成 | Coding Agent 和官方支持的指定工具 / 产品环境 |

## 模型目录

| Provider | 模型 ID | 模型定位 | CCR 输入能力 |
| --- | --- | --- | --- |
| `glm-api` | `glm-5.1` | GLM API 最新文本 / 推理主模型 | `text` |
| `glm-api` | `glm-5v-turbo` | GLM API 多模态理解模型 | `text + image + video`，官方 `file` 输入待 CCR 后续专项 |
| `glm-api` | `glm-image` | GLM API 图像生成模型 | `text -> image` |
| `glm-coding` | `glm-5.1` | GLM Coding Plan 文本主模型 | `text` |

## 第一版能力边界

| 能力 | `glm-api` | `glm-coding` |
| --- | --- | --- |
| 文本生成 | 应接入 | 应接入 |
| 流式输出 | 应接入 | 应接入 |
| 工具调用 | 应接入并验证 OpenAI-style tool profile | 应接入并验证 OpenAI-style tool profile |
| thinking / reasoning | 作为 GLM provider 差异显式配置 | 作为 GLM Coding provider 差异显式配置 |
| 多模态输入 | `glm-5.1` 继续按文本输入；`glm-5v-turbo` 已在目录声明文本+图片+视频，官方文件输入先标 pending | 图片/视频已走 OpenAI Chat compatible adapter；文件输入需要单独设计 |
| 图片 / 音频 / 文件生成 | `glm-image` 已登记为图片生成模型，走 `/images/generations`；音频 / 文件生成不作为第一版目标 | 不作为第一版目标 |
| Structured Output | 先保留协议入口，后续跟 `structured` 专项收口 | 先保留协议入口，后续跟 `structured` 专项收口 |

## 配置结构

通用 API Profile：

```json
{
  "schemaVersion": 2,
  "current": {
    "profileId": "glm-api-1",
    "model": "<glm-api-model>"
  },
  "profiles": {
    "glm-api-1": {
      "name": "GLM API",
      "providerType": "glm-api",
      "apiMode": "openai-chat",
      "endpoint": {
        "baseUrl": "https://open.bigmodel.cn/api/paas/v4"
      },
      "auth": {
        "strategy": "api_key"
      },
      "defaultModel": "<glm-api-model>",
      "models": {
        "source": "builtin",
        "default": "<glm-api-model>"
      }
    }
  }
}
```

Coding Plan Profile：

```json
{
  "schemaVersion": 2,
  "current": {
    "profileId": "glm-coding-1",
    "model": "<glm-coding-model>"
  },
  "profiles": {
    "glm-coding-1": {
      "name": "GLM Coding Plan",
      "providerType": "glm-coding",
      "apiMode": "openai-chat",
      "endpoint": {
        "baseUrl": "https://open.bigmodel.cn/api/coding/paas/v4"
      },
      "auth": {
        "strategy": "api_key"
      },
      "defaultModel": "<glm-coding-model>",
      "models": {
        "source": "builtin",
        "default": "<glm-coding-model>"
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
    "glm-api-1": {
      "type": "api_key",
      "providerType": "glm-api",
      "apiKey": "sk-..."
    },
    "glm-coding-1": {
      "type": "api_key",
      "providerType": "glm-coding",
      "apiKey": "sk-..."
    }
  }
}
```

## 请求链路

```text
Core LlmRuntime
-> GlmApiProvider / GlmCodingProvider
-> providerCredentials.getLlmProviderApiKey(profileId)
-> OpenAiChatCompletionsAdapter
-> https://open.bigmodel.cn/api/paas/v4/chat/completions
   或 https://open.bigmodel.cn/api/coding/paas/v4/chat/completions
```

Provider 壳第一版只保留供应商差异：

- 默认 base URL。
- API Key 环境变量。
- 默认模型和模型能力目录。
- thinking / reasoning 相关参数。
- Coding Plan 使用范围、模型列表和限流/额度错误提示。

## 环境变量建议

通用 API：

- `CCR_GLM_API_KEY`
- `GLM_API_KEY`
- `ZAI_API_KEY`
- `ZHIPUAI_API_KEY`
- `CCR_GLM_API_BASE_URL`
- `GLM_API_BASE_URL`

Coding Plan：

- `CCR_GLM_CODING_API_KEY`
- `GLM_CODING_API_KEY`
- `ZAI_CODING_API_KEY`
- `CCR_GLM_CODING_BASE_URL`
- `GLM_CODING_BASE_URL`

正式 Desktop 配置仍以 Profile 凭据为准；环境变量只用于本地验证和 CI smoke。

## 验收要求

第一版至少覆盖：

1. `glm-api` / `glm-coding` 是两个独立 provider type。
2. 两类 Profile 能分别读取独立凭据。
3. `glm-api` 请求落到 `https://open.bigmodel.cn/api/paas/v4/chat/completions`。
4. `glm-coding` 请求落到 `https://open.bigmodel.cn/api/coding/paas/v4/chat/completions`。
5. 文本响应能归一化成 `CcrContentBlock text`。
6. stream delta 能进入统一 `LlmGenerateEvent`。
7. tools 能按 OpenAI-style 映射，并能回放 tool result 历史。
8. thinking / reasoning 字段不会污染公共 OpenAI Chat 默认行为。
9. provider 输出 fixture 至少覆盖文本、工具调用、工具结果、错误。
10. Desktop 不消费 GLM raw response，只消费 CCR 标准展示事件。

## 代码落点

- 供应商定义：`src/services/llm/providerDefinitions.ts`
- 默认配置：`src/services/llm/llmConfig.ts`
- 模型目录：`src/services/llm/modelCatalog.ts`
- 供应商壳：`src/services/llm/providers/GlmProvider.ts`
- 共享 OpenAI Chat provider 壳：`src/services/llm/providers/OpenAiChatCompatibleProvider.ts`
- 公共协议适配器：`src/services/llm/protocols/openaiChatCompletionsAdapter.ts`
- 凭据存储：`src/services/llm/providerCredentials.ts`
- provider fixture：`src/services/llm/fixtures/provider-output-fixtures.json`

## 已知边界

- 不把 GLM 伪装成 OpenAI；`glm-api` / `glm-coding` 都应是独立 `providerType`。
- 不靠 base URL 猜通用 API 还是 Coding Plan，必须由 `providerType` 显式决定。
- 不靠模型名猜多模态、工具或 structured output 能力；能力必须落到 `modelCatalog.ts` 或 Profile override。
- 如果 GLM 的 thinking、多模态或工具字段与公共 OpenAI Chat 默认行为不同，应通过对应 provider 壳的显式 options 处理。
- Coding Plan 的使用范围和官方支持工具边界要在 UI / 文档里提示，避免用户以为它等同于通用 API 余额。

## 第一版实现记录

- `glm-api` 默认模型目录为 `glm-5.1`，默认 base URL 为 `https://open.bigmodel.cn/api/paas/v4`。
- `glm-api` 额外登记 `glm-5v-turbo`，用于多模态输入方向：文本+图片+视频已接入能力目录和 OpenAI Chat compatible `image_url` / `video_url` 映射。
- `glm-5v-turbo` 官方还支持文件输入，但 CCR 当前还没有统一文件 URL / 上传 / 本地文件策略，因此只在模型 metadata 中标记 `officialFileInput: true` 和 `ccrFileInput: pending...`。
- `glm-api` 额外登记 `glm-image`，用于图像生成方向：文本输入、图片输出，默认图片生成接口为 `https://open.bigmodel.cn/api/paas/v4/images/generations`。
- `glm-coding` 默认模型目录为 `glm-5.1`，默认 base URL 为 `https://open.bigmodel.cn/api/coding/paas/v4`。
- `glm-coding` 继续按文本输入处理，不能从通用 API 的 GLM-5V 模型能力反推 Coding Plan。
- 第一版正式版模型组：
  - `glm-5.1`：最新文本 / 推理主模型，作为 `glm-api` 和 `glm-coding` 的主线模型，按 text-only 处理。
  - `glm-5v-turbo`：通用 API 多模态输入模型，按 text + image + video 处理，file 输入待后续专项。
  - `glm-image`：通用 API 图片生成模型，按 text -> image 处理。
- API Key 环境变量：
  - GLM API：`CCR_GLM_API_KEY`、`GLM_API_KEY`、`ZAI_API_KEY`、`ZHIPUAI_API_KEY`。
  - GLM Coding：`CCR_GLM_CODING_API_KEY`、`GLM_CODING_API_KEY`、`ZAI_CODING_API_KEY`。
- Base URL 环境变量：
  - GLM API：`CCR_GLM_API_BASE_URL`、`GLM_API_BASE_URL`。
  - GLM Coding：`CCR_GLM_CODING_BASE_URL`、`GLM_CODING_BASE_URL`。
- 已补 fixture：`provider-glm-api-text`、`provider-glm-coding-tool-call`。
- 已补 smoke：`smoke:glm-api-provider`、`smoke:glm-coding-provider`、`smoke:kimi-glm-providers`。
- 已验证：`npm.cmd run smoke:kimi-glm-providers`、`npm.cmd run smoke:provider-output-fixtures`、`npm.cmd run smoke:llm-config`、`npm.cmd run smoke:llm-runtime`。
