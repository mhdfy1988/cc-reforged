# CCR Provider 协议盘点与官方文档对照

核验日期：2026-05-18

## 1. 文档目标

本文先把 CCR 需要对接的外部协议全部列出来，并和官方文档逐项对照。实现可以后续再做，但协议边界必须先说清楚。

核心结论：

```text
CCR 内部只维护一套标准协议
外部 provider 原始协议只存在于 Provider Adapter 边界
新增 provider 时先更新本盘点，再更新标准协议 / profile / adapter / smoke
```

本文回答三件事：

1. 后续要对接哪些协议族。
2. 每个协议族有哪些必须处理的协议面。
3. 哪些点第一版必须做，哪些先登记为后续能力。

本文不实现代码，不选择 SDK，不新增 provider，不打包发布。

## 2. 官方资料入口

Provider 文档和模型能力变化很快。表中链接是本次盘点使用的官方入口；后续改 profile 或 adapter 前必须重新核对。

| Provider / Gateway | 官方文档入口 | 本次关注点 |
| --- | --- | --- |
| OpenAI Responses | [Responses API](https://platform.openai.com/docs/api-reference/responses?api-mode=responses)、[Responses 迁移指南](https://platform.openai.com/docs/guides/migrate-to-responses)、[Function calling](https://platform.openai.com/docs/guides/function-calling)、[Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs?api-mode=responses)、[Streaming](https://platform.openai.com/docs/api-reference/streaming)、[Images and vision](https://platform.openai.com/docs/guides/images-vision?api-mode=responses&format=url) | Responses 是 OpenAI 新主接口；覆盖 text / image input、function tool、structured output、streaming、reasoning 和 built-in tools。 |
| OpenAI Chat Completions | [Chat Completions API](https://platform.openai.com/docs/api-reference/chat)、[Structured Outputs for Chat](https://platform.openai.com/docs/guides/structured-outputs?api-mode=chat) | 仍需支持 OpenAI-compatible provider 和 gateway；重点是 `messages`、`tools`、`tool_calls`、`role: "tool"`、`response_format`。 |
| Anthropic Messages | [Messages API](https://docs.anthropic.com/en/api/messages)、[API Overview](https://docs.anthropic.com/en/api/overview)、[Tool use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use)、[Stop reasons](https://docs.anthropic.com/en/api/handling-stop-reasons)、[Files API](https://docs.anthropic.com/en/api/files-create)、[Context windows](https://docs.anthropic.com/en/docs/build-with-claude/context-windows) | `messages`、content block、`tool_use` / `tool_result`、`stop_reason`、files beta、extended thinking 与上下文回传规则。 |
| Gemini GenerateContent | [Gemini API](https://ai.google.dev/gemini-api/docs)、[Function calling](https://ai.google.dev/gemini-api/docs/function-calling)、[Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output)、[Files API](https://ai.google.dev/gemini-api/docs/files)、[Thinking](https://ai.google.dev/gemini-api/docs/thinking)、[API reference](https://ai.google.dev/api) | `contents[].parts`、`functionDeclarations`、`functionCall` / `functionResponse`、file upload、structured output、thinking、streaming。 |
| DeepSeek OpenAI-compatible | [Create Chat Completion](https://api-docs.deepseek.com/api/create-chat-completion)、[Function Calling](https://api-docs.deepseek.com/guides/function_calling)、[JSON Output](https://api-docs.deepseek.com/guides/json_mode/)、[Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode) | OpenAI Chat 兼容外壳；工具 strict 是 beta；JSON Output 只有 `json_object`；thinking 有 OpenAI / Anthropic 两套控制参数。 |
| DeepSeek Anthropic-compatible | [DeepSeek Anthropic API](https://api-docs.deepseek.com/guides/anthropic_api) | Claude Code / Anthropic 兼容入口；需要单独 profile，不能简单等同 Anthropic 官方。 |
| MiniMax | [接口概览](https://platform.minimaxi.com/docs/api-reference/api-overview)、[Anthropic API 兼容](https://platform.minimaxi.com/docs/api-reference/text-anthropic-api)、[文本对话 Anthropic 兼容](https://platform.minimaxi.com/docs/api-reference/text-chat-anthropic)、[OpenAI API 兼容](https://platform.minimaxi.com/docs/api-reference/text-openai-api)、[文本对话 OpenAI 兼容](https://platform.minimaxi.com/docs/api-reference/text-chat-openai)、[工具使用与交错思维链](https://platform.minimaxi.com/docs/guides/text-m2-function-call)、[模型列表 OpenAI 兼容](https://platform.minimaxi.com/docs/api-reference/models/openai/list-models) | MiniMax 同时提供 Anthropic / OpenAI 兼容协议；M2.7 重点是 agent、tool use、interleaved thinking。 |
| Kimi API / Moonshot | [Kimi Chat Completions](https://platform.kimi.ai/docs/api/chat) | 通用开放平台走 OpenAI Chat compatible，`kimi-k2.6` 的图片 / 视频输入必须走内容块映射和真实 probe。 |
| Kimi Code | [Provider / Model](https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/providers-and-models.html)、[第三方 Coding Agent](https://www.kimi.com/code/docs/third-party-tools/other-coding-agents.html)、[错误说明](https://www.kimi.com/code/docs/kimi-code/error-reference.html) | Coding 平台是会员权益和统一模型标识；CCR 走 Anthropic Messages `/v1/messages`，不再用 OpenAI Chat 兼容路径调用 `kimi-for-coding`。 |
| OpenRouter | [Structured Outputs](https://openrouter.ai/docs/features/structured-outputs)、[Multimodal Capabilities](https://openrouter.ai/docs/guides/overview/multimodal/overview) | Gateway 不是单一模型协议；能力取决于路由模型、provider 和模型页参数，必须 profile / probe。 |
| Vercel AI Gateway | [AI Gateway](https://vercel.com/docs/ai-gateway/)、[OpenAI-compatible API](https://vercel.com/docs/ai-gateway/openai-compat)、[Chat Completions](https://vercel.com/docs/ai-gateway/openai-compat/chat-completions)、[Capabilities](https://vercel.com/docs/ai-gateway/capabilities)、[Models & Providers](https://vercel.com/docs/ai-gateway/models-and-providers/) | 统一 gateway；支持 OpenAI Chat compatible、attachments、tools、structured outputs、reasoning、usage 和模型目录。 |

## 3. 需要对接的协议族

协议族不是 provider 名称，而是请求 / 响应 / 历史回放的外壳格式。

| 协议族 | 当前代表 | CCR `apiMode` 建议 | 第一版态度 |
| --- | --- | --- | --- |
| OpenAI Responses | OpenAI 官方、部分 gateway | `openai-responses` | 必须登记，Codex OAuth / GPT 系列主线优先保持稳定。 |
| OpenAI Chat Completions | DeepSeek、Kimi API、GLM API / Coding、OpenAI-compatible、Vercel、OpenRouter、MiniMax OpenAI 兼容 | `openai-chat` | 必须支持；第三方兼容不能默认继承 OpenAI 全能力。 |
| Anthropic Messages | Anthropic 官方、MiniMax Anthropic 兼容、DeepSeek Anthropic 兼容、Kimi Code | `anthropic-messages` | 必须支持；工具结果和 thinking 历史规则要单独处理。 |
| Gemini GenerateContent | Gemini 官方 | `gemini-generate-content` | 需要设计 profile 和 adapter；不应塞进 OpenAI Chat。 |
| Gateway OpenAI-compatible | Vercel AI Gateway、OpenRouter、NewAPI、其它中转 | `openai-chat` + `gatewayProfile` | 必须支持 profile 覆盖和 probe；能力以 gateway 返回和用户配置为准。 |
| Provider 原生文件 API | OpenAI Files、Anthropic Files、Gemini Files、MiniMax Files | `provider-files` | 第一版只登记生命周期；发送图片/小文本仍优先用本地附件引用。 |
| Provider 原生工具 / Built-in tools | OpenAI web/file search、Anthropic server tools、Gemini Google Search / Code Execution | `provider-built-in-tools` | 暂不做核心功能；要防止和 CCR 自有工具混淆。 |
| 生成型多模态输出 API | OpenAI image/audio、Vercel image/video、MiniMax image/video/audio/music、OpenRouter image/audio/video | `generation-output` | 后续 `STD-OUTPUT-03` 单独设计；不能混入普通 assistant 文本。 |
| Realtime / Live API | OpenAI Realtime、Gemini Live、语音 websocket | `realtime` | 暂不进入当前主线；需要独立会话状态机。 |
| Embeddings / Batch / Fine-tuning | 各家专项接口 | `non-chat-task` | 当前 Desktop Agent 主线不接；只登记为非目标。 |

第一版必须覆盖前三类和 gateway profile；Gemini 需要先完成标准设计，再接真实 adapter。

## 4. 协议面总清单

下面这张表是后续接 provider 前必须逐项核对的清单。

| 协议面 | CCR 标准归属 | OpenAI Responses | OpenAI Chat / DeepSeek | Anthropic / MiniMax | Gemini | Gateway | 第一版处理方式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Endpoint 与版本 | Provider Profile | `/v1/responses` | `/v1/chat/completions` | `/v1/messages`，常带 version / beta header | `models/*:generateContent` | Gateway base URL + model path | profile 记录 `apiMode/baseURL/versionHeaders`。 |
| 认证与请求头 | Provider Profile | Bearer | Bearer | `x-api-key` / `anthropic-version` / beta | `x-goog-api-key` 或 OAuth | Bearer / OIDC | 不进入历史；错误映射到 `auth`。 |
| 模型目录 | Model Capabilities | 官方模型能力 + docs | `/models` 只给模型对象，能力不足 | 官方 docs / model list | model overview / API | models page / endpoint | 内置目录 + profile 覆盖 + probe。 |
| 消息角色 | `LlmMessage` | input item / role | `system/user/assistant/tool` | `user/assistant` + top-level system | `contents.role = user/model`，工具结果放在 `functionResponse` part | 取决于兼容层 | adapter 统一成 `system/user/assistant/tool`。 |
| 系统指令 | message metadata | `instructions` 或 input system | `system` message | top-level `system` | `system_instruction` | 取决于兼容层 | adapter 明确映射，不让 UI 猜。 |
| 文本内容块 | `TextPart` | `input_text` / `output_text` | string 或 content part | `content[].text` | `parts[].text` | 通常 OpenAI-style | 统一为 `type: "text"`。 |
| 图片输入 | `ImagePart` | image input / file id / URL | `image_url` 或 provider 扩展 | Anthropic image block；MiniMax Anthropic-compatible 当前不支持 image | `inlineData` / `fileData` | 取决于模型和 gateway | 发送前能力校验；未知默认阻断。 |
| 文件输入 | `FilePart` | Files API / file input | gateway 可能支持 `file` part | Anthropic Files / document；MiniMax Anthropic-compatible 当前不支持 document | Files API `fileData` | Vercel 支持 PDF attachment，OpenRouter 支持 PDF | 先登记生命周期；小文本走 CCR 本地策略。 |
| 音频 / 视频输入 | `AudioPart` / `VideoPart` | Chat 支持音频场景，Responses 需查模型 | 第三方差异大 | 不是当前主线 | Gemini Files 支持音频/视频 | OpenRouter / Vercel 可能支持 | 第一版只在能力目录声明，不默认启用。 |
| 工具定义 | `CcrToolDefinition` | function tools JSON schema | `tools[].function.parameters` | `tools[].input_schema` | `functionDeclarations` | 有的透传，有的裁剪 | 已有 `LlmProviderToolProfile`，继续补 Gemini。 |
| 工具选择 | Tool Profile | `tool_choice` / built-ins | `tool_choice` | `tool_choice` | function calling mode | 取决于兼容层 | profile 记录是否支持 `required/none/auto`。 |
| 工具调用 | `ToolCallPart` | response function call item | `message.tool_calls[]` | `tool_use` block | `functionCall` part | 取决于路由 | 统一成 `id/name/input`。 |
| 工具结果 | `CcrToolResult` | `function_call_output` | `role: "tool"` + `tool_call_id` | `tool_result` + `tool_use_id` | `functionResponse` | 取决于兼容层 | 发送前验证每个 call 都有 result。 |
| 工具参数错误 | ErrorSnapshot + ToolResult | 必须回填 tool output | 必须回填 tool message | 必须回填 `tool_result` | 必须回填 `functionResponse` | 必须按实际协议回填 | 校验失败生成标准工具结果，不能卡死会话。 |
| 并行工具 | Tool Profile | 支持情况依模型 | OpenAI-style 支持情况依模型 | 多 block | Gemini 有 parallel function calling 能力矩阵 | gateway 差异大 | profile 标记 `true/false/unknown`，unknown 保守。 |
| Structured Output | StructuredSnapshot | `text_format` / schema | `response_format.json_schema` 或 `json_object` | 主要依工具或 prompting，需查模型 | `response_json_schema` / `response_mime_type` | Vercel / OpenRouter 有统一参数但依模型 | 先按 provider profile 裁剪 schema。 |
| JSON mode | StructuredSnapshot | 支持 | `json_object` | 不当作统一保证 | `application/json` / schema | 取决于模型 | 不能等同 schema 严格遵守。 |
| Reasoning / Thinking | `ThinkingPart` + metadata | reasoning item / effort | DeepSeek `reasoning_content` / `reasoning_effort` | extended thinking block / interleaved thinking | `thinkingBudget` / include thoughts / thought signature | Vercel 有 normalized reasoning | 不可见或不可回放部分必须 redacted；历史规则单独处理。 |
| Streaming | DisplayEvent | typed SSE events | delta chunks | `message_start/content_block_delta/message_delta` | stream chunks | gateway 可能二次包装 | adapter 输出统一流式事件，不直接给 UI provider 原始 chunk。 |
| Usage / Token | runtime metadata | `usage` | `usage` | `usage` | `usageMetadata` | gateway usage / billing | 统一到 `usage`，缺失显示未知。 |
| Context / cache | Context status | stateful / previous response | 手动传历史 | stateless；prompt cache / context window | stateless；Files 有生命周期 | gateway 可能有 cache / fallback | CCR 自己管理历史，不依赖 provider state。 |
| Stop / finish reason | runtime metadata | response status / finish | `finish_reason` | `stop_reason` | `finishReason` | 取决于兼容层 | 映射 `stop/length/tool/safety/refusal/error`。 |
| Refusal / safety | ErrorSnapshot | refusal / content filter | `content_filter` | `refusal` stop reason | safety ratings | gateway 可能改写 | 用户可见错误卡，不铺原始大字符串。 |
| 错误体 | ErrorSnapshot | OpenAI error object | HTTP error + body | HTTP error + `request-id` | Google RPC-ish error | gateway 自己包一层 | 统一 `category/source/retryable/requestId/safeDetails`。 |
| 限流 / 额度 | ErrorSnapshot | 429 / quota | 429 / quota | 429 / rate limit | 429 / quota | gateway billing/usage | 统一 `rate_limit/quota`，提示重试或切模型。 |
| 输出媒体 | Output media lifecycle | image/audio/file output item | images array 或扩展 | 文件/工具结果/未来能力 | parts / generated files | Vercel / OpenRouter 可能有 image/audio/video output | 后续单独设计，不混入 text。 |
| 历史恢复 | Conversation recovery | previous response item / function outputs | assistant tool_calls 后必须跟 tool messages | assistant tool_use 后必须跟 user tool_result | `functionCall` 后必须跟 `functionResponse` part | gateway 也会校验 | 发送前 history validator + synthetic result。 |

## 5. Provider 差异结论

### 5.1 OpenAI Responses

必须处理：

- Responses 使用 `input` / `output` item，而不是传统 chat `messages`。
- 工具输出使用 `function_call_output`，并带 `call_id`。
- reasoning 模型返回的 reasoning item 在工具调用场景下需要和工具输出一起纳入后续输入。
- Streaming 是 typed event，不是简单 token delta。
- Responses 还包含 built-in tools、stateful conversation、file/image input 等能力；CCR 第一版只接自有工具和标准内容块，不把 built-in tools 混进 CCR Tool Registry。

后续任务：

- `openai-responses` adapter 要明确区分 function tools、built-in tools 和 output item。
- `ThinkingPart` 需要记录可见 / 不可见 / redacted 状态。
- history validator 要理解 Responses 的 call output 成对规则。

### 5.2 OpenAI Chat Completions / OpenAI-compatible

必须处理：

- 请求核心是 `messages`，工具定义在 `tools`。
- 模型返回 `assistant.message.tool_calls[]` 时，后续必须追加 `role: "tool"` 且带对应 `tool_call_id`。
- `response_format` 同时存在 JSON mode 和 JSON schema structured output，不能混为一谈。
- 第三方 OpenAI-compatible 可能只支持字段子集。

后续任务：

- 继续保留 `LlmProviderToolProfile`。
- 对 gateway / DeepSeek / Kimi API / GLM / MiniMax OpenAI-compatible 分别建 profile，不共享“OpenAI 官方完整能力”。
- 发送前校验历史中悬空 `tool_calls`。

### 5.3 Anthropic Messages / Anthropic-compatible

必须处理：

- 官方 Messages 是 stateless，多轮历史必须由 CCR 发送。
- `system` 是 top-level 字段，不是普通 `messages` role。
- assistant 通过 content block 返回 `tool_use`；工具结果作为下一条 user content 中的 `tool_result` 回传。
- `stop_reason` 是正常完成原因，不等于错误；`tool_use`、`max_tokens`、`refusal` 要分别映射。
- extended thinking / context window 有专门回传规则，尤其工具结果附近不能随意丢 thinking block。
- Files API 是 beta，且需要 beta header。

后续任务：

- Anthropic-compatible profile 必须区分官方 Anthropic、MiniMax、DeepSeek、Kimi Code。
- `ThinkingPart` 历史策略要在 adapter 层明确，不由 UI 决定。
- 错误展示要区分 `stop_reason` 和 HTTP/API error。

### 5.4 Gemini GenerateContent

必须处理：

- Gemini 的核心结构是 `contents[].parts[]`，不是 OpenAI messages。
- 工具定义是 `functionDeclarations`，工具调用是 `functionCall`，工具结果是 `functionResponse`。
- Gemini 3 支持 multimodal function response，这会影响工具结果内容块设计。
- Files API 支持图片、音频、视频、文档等媒体，超过一定请求大小应走 Files API。
- structured output 使用 `response_mime_type` / `response_json_schema`。
- thinking 有 `thinkingBudget`、include thoughts、thought signature 等概念。

后续任务：

- 新增 `gemini-generate-content` apiMode，不要伪装成 OpenAI Chat。
- `CcrContentBlock` 需要覆盖 `inlineData/fileData/functionCall/functionResponse` 映射。
- history validator 要理解 Gemini `functionCall -> functionResponse part` 的顺序。

### 5.5 DeepSeek

必须处理：

- DeepSeek Chat Completion 是 OpenAI-compatible 外壳，但并不等于 OpenAI 官方完整协议。
- Function Calling strict 是 beta，且 strict schema 支持范围有限：对象属性 required、`additionalProperties: false` 等要求需要 profile 记录。
- JSON Output 是 `json_object`，文档要求 prompt 中明确让模型输出 JSON，且可能出现空内容或截断。
- Thinking Mode 同时给出 OpenAI format 和 Anthropic format 控制参数；默认 thinking 和 effort 映射有 provider 自己的规则。
- Anthropic-compatible 入口需要独立 profile。

后续任务：

- DeepSeek profile 继续保守：未知能力不默认打开。
- 工具参数错误必须回填标准工具结果，避免会话再次 400。
- thinking 内容回放必须按 DeepSeek 官方规则做，不从 UI 层猜。

### 5.6 MiniMax

必须处理：

- MiniMax 官方同时提供 OpenAI API 兼容和 Anthropic API 兼容。
- 文本模型、语音、图像、视频、音乐、文件管理是不同接口能力，不应混成一个聊天协议。
- 当前 CCR 中 MiniMax 优先按 Anthropic-compatible 接入；后续如果接 OpenAI-compatible，要单独 profile。
- M2.7 相关文档强调 tool use 和 interleaved thinking；这不等于 Anthropic 官方完整 extended thinking 语义。
- MiniMax Anthropic-compatible 文档当前标注文本、工具、工具结果、thinking 支持，但 `image` 和 `document` 输入不支持。

后续任务：

- MiniMax Anthropic-compatible profile 不能直接复用 Anthropic 官方 profile 的所有能力。
- MiniMax OpenAI-compatible 如果启用，要单独 probe 工具、structured output、reasoning。
- MiniMax 图像 / 视频 / 语音生成属于 `generation-output`，后续单独设计。

### 5.7 OpenRouter / Vercel AI Gateway

必须处理：

- Gateway 是路由层，不是一个模型协议标准。
- 同一个模型名在不同 gateway 下可能支持不同参数、不同媒体输入、不同工具能力。
- Vercel AI Gateway 明确提供 OpenAI-compatible API，并支持 chat completions、attachments、tools、structured outputs、reasoning、model list。
- OpenRouter structured outputs、multimodal 能力需要按模型页和 supported parameters 判断。
- Gateway 可能改写错误体、usage、finish reason、streaming chunk。

后续任务：

- Gateway 必须支持用户 Profile 覆盖。
- Gateway 必须提供 probe 结果记录，不靠模型名推断。
- 对 gateway 的 `model catalog` 只作为能力候选，最终以 profile + probe 为准。

## 6. 必须实现清单

### P0：继续接 provider 前必须有

- [x] `CCR 标准 LLM 协议 v0.1`：内部标准不以任何一家原始协议为准。
- [x] `ProviderToolProfile`：工具 schema、工具结果、strict、deferred tool search 能力有统一查询入口。
- [x] `CcrContentBlock` 共享类型：统一 text / thinking / image / file / audio / video / json / tool / error。
- [ ] Provider 协议 registry：每个 provider/profile 明确 `apiMode`、官方来源、能力来源、校验日期。
- [x] History validator：发送给 provider 前扫描悬空工具调用、非法角色顺序、缺失 thinking/tool result。
- [ ] ErrorSnapshot：统一 provider / tool / file / auth / quota / safety / protocol 错误。
- [ ] Provider fixture：每个协议族至少一组文本、工具、工具错误、结构化输出、历史恢复样例。

### P1：多模态和展示稳定后做

- [ ] Structured output profile：不同 provider 的 JSON schema 子集、strict 支持、fallback 策略。
- [ ] Streaming adapter：把 provider 原始流式事件归一化为 CCR DisplayEvent / runtime event。
- [ ] File lifecycle：OpenAI / Anthropic / Gemini / MiniMax Files API 的上传、引用、过期、删除策略。
- [ ] Reasoning / thinking lifecycle：显示、隐藏、签名、回放、token 计费、历史恢复策略。
- [ ] Gateway model catalog：OpenRouter / Vercel / NewAPI 等模型能力目录导入和用户覆盖。

### P2：生成型多模态输出

- [ ] 图片生成输出：image item / images array / file result / data URI 的统一生命周期。
- [ ] 音频输出：语音合成、转写、音频引用和播放组件。
- [ ] 视频输出：异步任务、状态轮询、文件下载、预览和历史恢复。
- [ ] Provider native tools：web search、file search、code execution、computer use 等内置工具和 CCR 自有工具的边界。

## 7. 标准 Probe 矩阵

新增 provider 或 gateway profile 前，至少跑这些 probe。没有真机条件时也要补 fixture，并在文档中标注未真机。

| Probe | 目标 | 覆盖协议面 |
| --- | --- | --- |
| `text-basic` | 普通文本输入输出 | role、content、stop reason、usage |
| `image-input-supported` | 支持图片的模型能真实读图 | image block、mime、size、provider adapter |
| `image-input-blocked` | 文本模型发送图片被阻断 | capabilities、错误展示 |
| `file-small-text` | 小文本文件进入上下文 | file/text fallback、context budget |
| `file-provider-reference` | provider file id / file uri 可引用 | Files API、过期、history |
| `tool-basic` | 一个简单工具调用并继续回复 | tool definition/call/result |
| `tool-invalid-args` | 工具参数错误产生标准工具结果 | schema validation、ErrorSnapshot |
| `tool-interrupted` | 工具中断后仍可继续会话 | synthetic tool result、history validator |
| `tool-parallel` | 并行工具支持或明确禁用 | profile、result ordering |
| `structured-json-schema` | JSON schema 输出符合 provider 子集 | structured output profile |
| `structured-json-mode` | JSON mode 不保证 schema adherence | fallback、解析失败展示 |
| `thinking-enabled` | reasoning/thinking 可显示或 redacted | ThinkingPart、history |
| `thinking-with-tools` | thinking + tool result 的历史回放 | provider 特殊规则 |
| `streaming-text` | 流式文本事件稳定 | streaming adapter |
| `streaming-tool-args` | 流式工具参数能组装 | streaming tool delta |
| `finish-refusal-safety` | 拒答 / safety 能归类 | stop reason、ErrorSnapshot |
| `rate-limit-auth-quota` | 认证、限流、额度有行动提示 | error mapping |
| `gateway-capability-mismatch` | gateway 声称支持但实际失败可回退 | profile override、probe result |

## 8. 更新流程

以后出现新 provider、新能力或兼容问题时，按这个顺序处理：

1. 查官方文档，确认属于哪个协议族和协议面。
2. 更新本文档的官方来源、协议面和必须实现项。
3. 如果 CCR 内部标准不够，先更新 [CCR 标准 LLM 协议 v0.1](./ccr-standard-llm-protocol.md)。
4. 更新 profile / adapter / validator / DisplayEvent。
5. 补 fixture 或 smoke。
6. 更新 changelog。

不要直接在 UI、工具执行层或某个 provider adapter 里临时兼容一个字段。只要是跨 provider 的协议问题，必须回到本文档和标准协议。
