# CCR 标准 LLM 协议 v0.1

## 1. 文档目标

本文定义 CCR 内部用于多模型、多 provider、多模态、工具调用和错误展示的标准协议。

核心结论：

```text
CCR 不以 OpenAI / Anthropic / Gemini / DeepSeek 任意一家原始协议为标准
CCR 以自己的标准协议为中心
各家 provider 原始协议只在 Provider Adapter 边界内存在
```

后续新增 provider、修复兼容问题或调整 UI 展示时，先判断问题属于哪一层：

- provider 原始协议变化：更新 Provider Adapter 和 Provider Profile。
- CCR 内部结构不足：先更新本文档，再改共享类型和映射代码。
- UI 展示不一致：先映射到标准内容块 / 展示事件，再调整组件。

本文是标准化入口文档。相关专项文档：

- [Provider 工具协议统一化标准](./provider-tool-protocol-normalization.md)
- [多模态输入输出设计](./multimodal-input-output-design.md)
- [模型输出归一化与展示标准](./model-output-normalization-and-display-standard.md)
- [多供应商模型与协议接入设计](./multi-provider-model-management-design.md)

## 2. 协议分层

标准链路：

```text
Provider 原始协议
  -> Provider Adapter
  -> CCR 标准 LLM 协议
  -> Core / App Server / Desktop
  -> DisplayEvent / Snapshot
  -> UI 组件
```

| 层级 | 责任 | 不允许做什么 |
| --- | --- | --- |
| Provider 原始协议 | 接收各家 SDK / HTTP API 的真实结构 | 不直接进入 Core 状态、历史恢复和 UI |
| Provider Adapter | 双向转换 provider 方言和 CCR 标准协议 | 不执行工具，不拼 UI，不修业务语义 |
| CCR 标准 LLM 协议 | 定义消息、内容块、工具、错误、能力的内部结构 | 不保留 provider 专属字段作为主字段 |
| Core / App Server / Desktop | 按标准协议运行、持久化、广播和恢复 | 不重新猜 provider 原始字段 |
| DisplayEvent / Snapshot | 把标准协议转换为可渲染快照 | 不直接消费 OpenAI / Claude / Gemini 原始块 |
| UI 组件 | 渲染消息、附件、工具卡、错误卡 | 不解析 provider 原始协议 |

## 3. 命名原则

内部协议命名遵循三条规则：

1. 人读文档使用中文主称呼，第一次出现写英文对照。
2. 代码字段使用稳定英文标识，避免和某家 provider 的原始字段强绑定。
3. provider 原始字段只能作为映射表字段出现，不能变成 UI 或 Core 的主表达。

示例：

| 中文称呼 | 内部代码名 | 不直接采用的 provider 方言 |
| --- | --- | --- |
| 内容块 | `LlmContentPart` / 后续 `CcrContentBlock` | `content[].type`、`message.tool_calls`、`functionCall` |
| 工具调用 | `tool_call` | OpenAI `tool_calls`、Claude `tool_use`、Gemini `functionCall` |
| 工具结果 | `tool_result` | OpenAI `role: "tool"`、Claude `tool_result`、Gemini `functionResponse` |
| 能力声明 | `LlmModelCapabilities` | Vercel/OpenRouter/Gateway 各自返回字段 |
| Provider 工具 profile | `LlmProviderToolProfile` | OpenAI/DeepSeek/Anthropic 的工具协议差异 |

## 4. 标准消息信封

CCR 标准消息由 `role + parts + metadata` 组成。

当前代码中已落地的核心形态：

```ts
type LlmMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  parts: readonly LlmContentPart[]
  name?: string
}
```

标准不变式：

- 消息内容必须进入 `parts`，不要把 provider 原始 message 直接挂到 UI。
- `system` 只承载系统级文本或标准元数据，不承载用户附件。
- `user` 可以包含文本、图片、文件引用等用户输入内容块。
- `assistant` 可以包含文本、思考、工具调用和输出媒体引用。
- `tool` 只承载工具结果，不混入新的用户文本。

后续可以扩展的消息元数据：

```ts
type CcrMessageMetadata = {
  providerId?: string
  profileId?: string
  model?: string
  apiMode?: string
  turnId?: string
  requestId?: string
  createdAt?: string
}
```

## 5. 标准内容块

第一版内容块以当前代码已实现类型为核心，后续 `STD-DISPLAY-01` 再抽共享 `CcrContentBlock`。

```ts
type LlmContentPart =
  | TextPart
  | ThinkingPart
  | ImagePart
  | ToolCallPart
  | ToolResultPart
```

### 5.1 文本块

```ts
type TextPart = {
  type: 'text'
  text: string
}
```

映射规则：

| 来源 | 原始字段 | 标准结果 |
| --- | --- | --- |
| OpenAI Chat | `message.content` | `text` |
| OpenAI Responses | `output_text` / `input_text` | `text` |
| Anthropic | `content[].type === "text"` | `text` |
| Gemini | `parts[].text` | `text` |

### 5.2 思考块

```ts
type ThinkingPart = {
  type: 'thinking'
  thinking: string
  signature?: string
  redacted?: boolean
}
```

规则：

- 可见 reasoning 进入 `thinking`。
- 加密或不可展示 reasoning 只能保留安全引用或 `redacted: true`。
- UI 不应把思考块误当成用户文本。

### 5.3 图片块

```ts
type ImagePart = {
  type: 'image'
  mimeType: string
  source?: ImageSource
  data?: string
  attachmentId?: string
  displayName?: string
  sizeBytes?: number
}
```

规则：

- 发送给 provider 前必须经过模型能力校验。
- UI / 历史 / 日志默认不内联大 base64。
- 本地文件丢失时，消息仍要可渲染为“附件不可用”状态。

### 5.4 后续内容块草案

这些属于 v0.1 标准草案，当前不要求一次性实现：

```ts
type FilePart = {
  type: 'file'
  attachmentId?: string
  displayName?: string
  mimeType?: string
  sizeBytes?: number
  source?: unknown
}

type AudioPart = {
  type: 'audio'
  attachmentId?: string
  displayName?: string
  mimeType?: string
  sizeBytes?: number
  source?: unknown
}

type JsonPart = {
  type: 'json'
  value: unknown
  label?: string
}
```

后续如果 provider 返回新媒体类型，先补本文协议，再补 adapter 和 UI。

## 6. 标准工具定义

工具定义只维护一份，不为每个 provider 复制。

```ts
type CcrToolDefinition = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  category?: 'file' | 'shell' | 'todo' | 'permission' | 'network' | 'other'
  lifecycle?: {
    core?: boolean
    deferable?: boolean
    permission?: 'none' | 'ask' | 'policy'
  }
}
```

当前代码对应 `LlmToolDefinition`：

```ts
type LlmToolDefinition = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}
```

不变式：

- 工具 schema 由工具注册表维护。
- Provider Profile 只描述 provider 能力，不复制工具 schema。
- 核心工具如 `TodoWrite` 默认不走 deferred。

## 7. 标准工具调用

```ts
type ToolCallPart = {
  type: 'tool_call'
  id: string
  name: string
  input: unknown
}
```

映射规则：

| 来源 | 原始字段 | 标准字段 |
| --- | --- | --- |
| OpenAI Chat / DeepSeek | `message.tool_calls[].id` | `id` |
| OpenAI Chat / DeepSeek | `message.tool_calls[].function.name` | `name` |
| OpenAI Chat / DeepSeek | `message.tool_calls[].function.arguments` | `input`，JSON parse 后对象 |
| Anthropic | `content[].type === "tool_use"` | `tool_call` |
| Anthropic | `content[].id` | `id` |
| Anthropic | `content[].name` | `name` |
| Anthropic | `content[].input` | `input` |
| Gemini | `functionCall.id` | `id` |
| Gemini | `functionCall.name` | `name` |
| Gemini | `functionCall.args` | `input` |

不变式：

- `id` 不能丢。
- `input` 必须先做运行时校验。
- 非法参数不能被 UI 或 adapter 静默修成“看起来成功”。

## 8. 标准工具结果

当前代码对应：

```ts
type ToolResultPart = {
  type: 'tool_result'
  toolCallId: string
  toolName?: string
  result: unknown
  isError?: boolean
}
```

标准化目标形态：

```ts
type CcrToolResult = {
  type: 'tool_result'
  toolCallId: string
  toolName: string
  status: 'success' | 'error' | 'validation_error' | 'permission_denied' | 'interrupted'
  result?: unknown
  error?: {
    code: string
    message: string
    missingFields?: string[]
    rawInput?: unknown
  }
}
```

映射规则：

| 标准字段 | OpenAI / DeepSeek | Anthropic | Gemini |
| --- | --- | --- | --- |
| `toolCallId` | `tool_call_id` | `tool_result.tool_use_id` | `functionResponse.id` |
| `result` | `role: "tool"` 的 `content` | `tool_result.content` | `functionResponse.response` |
| `isError/status` | JSON content 内部标记 | `is_error: true` | response 内部标记 |

不变式：

- 只要 provider 返回了工具调用，后续发送给该 provider 前必须有对应工具结果。
- 工具校验失败也必须生成工具结果。
- 中断、历史缺失、执行失败都不能留下悬空 tool call。

## 9. 标准模型能力

模型能力用于发送前校验，不靠模型自己猜。

当前标准：

```ts
type LlmModelCapabilities = {
  inputModalities: readonly ('text' | 'image' | 'file' | 'audio')[]
  outputModalities: readonly ('text' | 'image' | 'audio')[]
  tools: boolean
  structuredOutput: boolean
  source: 'builtin' | 'profile_override' | 'default'
  reason: string
  baseSource?: 'builtin' | 'profile_override' | 'default'
  image?: {
    maxImages?: number
    maxImageBytes?: number
    mimeTypes?: readonly string[]
  }
}
```

规则：

- 没有能力声明时，默认只按文本模型处理。
- Profile 覆盖可以增强或收窄能力。
- 发送图片、文件、音频前必须经过能力校验。
- 第三方中转不能只凭模型名继承官方能力。

## 10. 标准 Provider 工具 Profile

Provider 工具 Profile 描述 provider 工具协议方言。

当前标准：

```ts
type LlmProviderToolProfile = {
  providerId: string
  apiMode: 'anthropic-messages' | 'openai-responses' | 'openai-chat' | 'custom'
  source: 'builtin' | 'api_mode_default' | 'disabled_default'
  modelPattern?: string
  toolCalling: {
    supported: boolean
    schemaStyle:
      | 'json_schema_function'
      | 'anthropic_input_schema'
      | 'gemini_function_declarations'
    resultStyle:
      | 'tool_role_with_tool_call_id'
      | 'anthropic_tool_result_block'
      | 'gemini_function_response'
      | 'function_call_output'
    requiresCallId: boolean
    supportsParallelCalls: boolean | 'unknown'
    supportsStrictSchema: boolean | 'beta' | 'unknown'
    supportsDeferredToolSearch: boolean | 'unknown'
    coreToolsAlwaysInline: readonly string[]
  }
}
```

当前内置映射：

| Provider / apiMode | `schemaStyle` | `resultStyle` | `supportsStrictSchema` | `supportsDeferredToolSearch` |
| --- | --- | --- | --- | --- |
| DeepSeek / `openai-chat` | `json_schema_function` | `tool_role_with_tool_call_id` | `beta` | `false` |
| 未知 OpenAI-chat compatible | `json_schema_function` | `tool_role_with_tool_call_id` | `unknown` | `false` |
| Codex OAuth / `openai-responses` | `json_schema_function` | `function_call_output` | `unknown` | `unknown` |
| Anthropic / `anthropic-messages` | `anthropic_input_schema` | `anthropic_tool_result_block` | `unknown` | `true` |
| MiniMax / `anthropic-messages` | `anthropic_input_schema` | `anthropic_tool_result_block` | `unknown` | `unknown` |
| custom | 默认不支持工具 | 默认不支持工具 | `unknown` | `false` |

## 11. 标准错误快照

错误展示不直接铺 provider 原始错误字符串。后续 `P24-1 / P24-2` 应以这个目标模型为准。

```ts
type ErrorSnapshot = {
  category:
    | 'auth'
    | 'rate_limit'
    | 'quota'
    | 'model'
    | 'safety'
    | 'tool'
    | 'permission'
    | 'network'
    | 'protocol'
    | 'file'
    | 'unknown'
  severity: 'info' | 'warning' | 'error'
  source: 'provider' | 'tool' | 'app_server' | 'desktop' | 'runtime'
  message: string
  retryable: boolean | 'unknown'
  actions?: readonly ('retry' | 'switch_model' | 'login' | 'open_logs' | 'copy_diagnostics')[]
  requestId?: string
  safeDetails?: unknown
  rawRef?: string
}
```

规则：

- 用户可见错误必须有来源、影响和下一步动作。
- 原始错误可以保留引用，但不默认完整铺到 UI。
- 未识别错误进入 `unknown`，不能让 UI 崩溃。

## 12. Provider 方言映射总表

| 标准能力 | OpenAI Chat / DeepSeek | OpenAI Responses | Anthropic Messages | Gemini |
| --- | --- | --- | --- | --- |
| 文本输入 | `role: "user"` + `content` | `input_text` | `content[].text` | `parts[].text` |
| 图片输入 | `image_url` | `input_image` | `type: "image"` | inline/file image part |
| 工具定义 | `tools[].function.parameters` | function tool | `tools[].input_schema` | `functionDeclarations` |
| 工具调用 | `tool_calls[]` | function call item | `tool_use` block | `functionCall` |
| 工具结果 | `role: "tool"` + `tool_call_id` | `function_call_output` | `tool_result` block | `functionResponse` |
| 流式文本 | delta content | event item delta | content block delta | stream chunk |
| 思考内容 | `reasoning_content` 或 provider 扩展 | reasoning item | `thinking` block | thinking / reasoning 扩展 |
| 用量 | `usage` | `usage` | `usage` | usage metadata |

这张表只表达映射关系，不代表 CCR 以其中任何一家为标准。

## 13. 版本和更新规则

协议版本从 `v0.1` 开始，采用文档先行策略：

1. 发现 provider 新方言或兼容问题。
2. 先判断是否能映射到现有标准字段。
3. 如果不能，先更新本文档：
   - 新增字段。
   - 新增内容块类型。
   - 新增 provider profile 能力。
   - 新增错误分类。
4. 再改代码：
   - 共享类型。
   - Provider Adapter。
   - DisplayEvent / Snapshot。
   - UI 组件。
5. 补 fixture / smoke。

兼容原则：

- 新字段默认可选。
- 删除或重命名字段必须先给迁移路径。
- 历史会话恢复要能识别旧字段并映射到新结构。
- provider 原始 `raw` 只能作为诊断，不作为业务主路径。

## 14. 和后续任务的关系

后续任务应按本文协议推进：

1. `STD-DISPLAY-01 CcrContentBlock 共享类型`
   - 把当前 Desktop / App Server / Runtime 分散内容块收成共享类型。
2. `P24-1 / P24-2 ErrorSnapshot`
   - 把错误分类和展示快照落成代码。
3. Provider probe 套件
   - 每个 provider 接入后补标准 fixture。
4. Profile 覆盖
   - 第三方中转可覆盖能力和工具 profile。

本文档优先级高于零散讨论。后续如果实现与本文冲突，要么修实现，要么先更新本文档说明原因。
