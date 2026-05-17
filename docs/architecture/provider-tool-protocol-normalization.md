# CCR Provider 工具协议统一化标准

## 1. 文档目标

本文定义 CCR 后续接入不同模型 / provider 时，如何统一处理工具调用协议。

核心结论：

```text
工具只接一次
Provider 只接一次
中间通过 CCR 标准工具协议连接
```

不能把接入方式做成 `工具数量 * provider 数量`。`TodoWrite`、`Read`、`Edit`、`PowerShell` 这类 CCR 工具只在工具注册表中定义一次；OpenAI、Anthropic、Gemini、DeepSeek、OpenAI Compatible 中转只在 provider adapter 中定义一次。

本文回答四个问题：

1. 每家模型的工具格式从哪里知道。
2. 为什么不需要每个工具都为每个模型写一份适配。
3. CCR 内部标准工具结构是什么。
4. 新接 provider 时如何验证并沉淀能力差异。

## 2. 资料来源

工具调用协议必须优先查官方文档，不能凭印象猜字段。

本文资料核验日期：2026-05-17。Provider 文档和模型能力会变化，新增或修改 provider profile 前需要重新核对官方文档并补 probe 结果。

| Provider / 协议 | 官方入口 | 关键点 |
| --- | --- | --- |
| OpenAI Responses / Chat Completions | [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling) | 工具声明使用 JSON Schema；模型返回 function / tool call；工具结果必须带回对应 call id；大工具集可用 tool search。 |
| Anthropic Claude Messages | [Anthropic Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)、[Define Tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)、[Handle Tool Calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls) | 工具定义使用 `input_schema`；模型返回 `tool_use` block；工具结果回传 `tool_result`，并通过 `tool_use_id` 对齐。 |
| Gemini API | [Gemini Function Calling](https://ai.google.dev/gemini-api/docs/function-calling) | 工具声明使用 `functionDeclarations`；模型返回 `functionCall`；工具结果用 `functionResponse` 回传，Gemini 3 需要保留匹配的 `id`。 |
| DeepSeek API | [DeepSeek Function Calling](https://api-docs.deepseek.com/guides/function_calling) | 基本走 OpenAI-style function calling；strict 模式是 beta 能力，JSON Schema 支持范围和要求比通用 JSON Schema 更窄。 |

这些文档定义的是 provider 的“工具协议外壳”，不定义 CCR 自己的 `TodoWrite`、`Read`、`Edit` 语义。CCR 工具语义以本仓库工具注册表和 schema 为准。

## 3. 分层原则

统一链路如下：

```text
CCR Tool Registry
  -> CCR 标准工具定义
  -> Provider Adapter 发送前映射
  -> Provider 原始工具调用
  -> Provider Adapter 返回归一化
  -> CCR 标准工具调用
  -> 工具 schema 校验和执行
  -> CCR 标准工具结果
  -> Provider Adapter 结果回填
  -> DisplayEvent / UI 展示
```

每一层只做自己的事：

| 层级 | 责任 | 不允许做什么 |
| --- | --- | --- |
| Tool Registry | 定义工具名、描述、输入 schema、输出 schema、执行逻辑 | 不判断 provider 格式 |
| Provider Profile | 声明当前 provider / model 支持哪些协议能力 | 不复制每个工具 schema |
| Provider Adapter | 把 CCR 标准工具结构翻译成 provider 原始格式，并反向归一化 | 不执行工具，不修业务语义 |
| Tool Executor | 用工具 schema 校验模型参数并执行 | 不关心 OpenAI / Claude / Gemini 原始字段 |
| Display Adapter | 把工具调用、工具结果和错误转成展示事件 | 不把 provider 原始结构直接铺到 UI |

## 4. CCR 标准工具定义

工具定义只维护一份：

```ts
type CcrToolDefinition = {
  name: string
  description: string
  inputSchema: JsonSchemaObject
  outputSchema?: JsonSchemaObject
  category?: 'file' | 'shell' | 'todo' | 'permission' | 'network' | 'other'
  lifecycle?: {
    core?: boolean
    deferable?: boolean
    permission?: 'none' | 'ask' | 'policy'
  }
}
```

以 `TodoWrite` 为例，CCR 内部标准是：

```ts
type TodoWriteInput = {
  todos: Array<{
    content: string
    status: 'pending' | 'in_progress' | 'completed'
    activeForm: string
  }>
}
```

`name / description` 不是 `TodoWrite` 的合法输入字段。模型如果产出这种结构，应视为工具参数错误，而不是另一种可兼容 Todo。

## 5. CCR 标准工具调用

无论 provider 原始返回是什么，进入工具执行层前都必须归一化为：

```ts
type CcrToolCall = {
  type: 'tool_call'
  id: string
  name: string
  input: Record<string, unknown>
  provider: string
  model: string
  raw?: unknown
}
```

执行结果统一为：

```ts
type CcrToolResult = {
  type: 'tool_result'
  toolCallId: string
  toolName: string
  status: 'success' | 'error' | 'validation_error' | 'permission_denied'
  result?: unknown
  error?: {
    code: string
    message: string
    missingFields?: string[]
    rawInput?: unknown
  }
}
```

重要不变式：

- `id` / `toolCallId` 不能丢。
- `input` 必须先过工具 schema 校验，再执行工具。
- 校验失败也要生成标准工具结果，不能留下没有结果的悬空 tool call。
- UI 不直接解析 OpenAI `tool_calls`、Claude `tool_use`、Gemini `functionCall`。

## 6. Provider Profile

每个 provider / apiMode / model 组合需要一份能力声明。第一版可以先放在内置目录，后续再支持用户 profile 覆盖。

```ts
type ProviderToolProfile = {
  providerId: string
  apiMode:
    | 'openai-responses'
    | 'openai-chat-completions'
    | 'anthropic-messages'
    | 'gemini-generate-content'
    | 'openai-compatible'
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
    strictSchemaLimits?: {
      additionalPropertiesFalseRequired?: boolean
      allObjectPropertiesRequired?: boolean
      unsupportedKeywords?: string[]
    }
  }
}
```

示例：

```ts
const deepseekOpenAiCompatibleProfile: ProviderToolProfile = {
  providerId: 'deepseek',
  apiMode: 'openai-compatible',
  toolCalling: {
    supported: true,
    schemaStyle: 'json_schema_function',
    resultStyle: 'tool_role_with_tool_call_id',
    requiresCallId: true,
    supportsParallelCalls: 'unknown',
    supportsStrictSchema: 'beta',
    supportsDeferredToolSearch: false,
    strictSchemaLimits: {
      additionalPropertiesFalseRequired: true,
      allObjectPropertiesRequired: true,
      unsupportedKeywords: ['minLength', 'maxLength', 'minItems', 'maxItems'],
    },
  },
}
```

## 7. Provider Adapter 映射表

发送工具定义：

| CCR 标准 | OpenAI / DeepSeek | Anthropic Claude | Gemini |
| --- | --- | --- | --- |
| `name` | `function.name` | `name` | `functionDeclarations[].name` |
| `description` | `function.description` | `description` | `functionDeclarations[].description` |
| `inputSchema` | `function.parameters` | `input_schema` | `functionDeclarations[].parameters` |
| strict | `function.strict` 或 provider 特定开关 | `strict` | 按 Gemini 支持情况映射或禁用 |

接收工具调用：

| Provider 原始结构 | CCR 标准 |
| --- | --- |
| OpenAI Chat `message.tool_calls[].id` | `id` |
| OpenAI Chat `message.tool_calls[].function.name` | `name` |
| OpenAI Chat `message.tool_calls[].function.arguments` | `input`，需要 JSON parse |
| Anthropic `content[].type === "tool_use"` | `tool_call` |
| Anthropic `content[].id` | `id` |
| Anthropic `content[].name` | `name` |
| Anthropic `content[].input` | `input` |
| Gemini `functionCall.id` | `id` |
| Gemini `functionCall.name` | `name` |
| Gemini `functionCall.args` | `input` |

回填工具结果：

| CCR 标准 | OpenAI / DeepSeek | Anthropic Claude | Gemini |
| --- | --- | --- | --- |
| `toolCallId` | `role: "tool"` + `tool_call_id` | `tool_result.tool_use_id` | `functionResponse.id` |
| `result` | `content` 字符串或 JSON 字符串 | `tool_result.content` | `functionResponse.response` |
| `error` | 建议进入 `content` 并标记内部状态 | `tool_result.is_error: true` | `functionResponse.response` 中表达错误 |

## 8. 工具校验与错误标准

模型输出永远视为不可信输入。

执行前必须：

```ts
const parsed = tool.inputSchema.safeParse(toolCall.input)
```

成功：

```text
执行工具
-> CcrToolResult(status: 'success')
-> provider adapter 回填
-> UI 展示成功工具卡
```

失败：

```text
不执行工具
-> CcrToolResult(status: 'validation_error')
-> provider adapter 仍然回填一个工具结果
-> UI 展示清晰错误卡
```

失败也必须回填 provider 需要的 tool result。原因是 OpenAI-style、Anthropic、Gemini 都依赖工具调用 id 对齐下一轮上下文。没有回填会导致下一次请求出现“工具调用没有对应结果”的 API 错误。

`TodoWrite` 错误示例：

```json
{
  "todos": [
    {
      "name": "审查代码完整性",
      "status": "in_progress",
      "description": "检查第三阶段所有功能实现是否完整且正确"
    }
  ]
}
```

应归一化为：

```ts
{
  type: 'tool_result',
  toolName: 'TodoWrite',
  status: 'validation_error',
  error: {
    code: 'TOOL_INPUT_VALIDATION_ERROR',
    message: 'TodoWrite 参数无效',
    missingFields: ['todos[0].content', 'todos[0].activeForm'],
    rawInput: ...
  }
}
```

UI 只展示“参数无效”和缺失字段，原始 JSON 放入折叠详情。

## 9. Deferred Tool Search 规则

Deferred tool search 只适合大工具集和低频工具，不适合核心工具。

默认规则：

| 工具类型 | 是否允许 deferred | 原因 |
| --- | --- | --- |
| `TodoWrite` | 否 | 会话核心状态工具，模型猜错字段会污染进度与历史 |
| 权限请求工具 | 否 | 影响安全与用户决策 |
| Shell / 文件修改核心工具 | 谨慎 | 如果 provider 不支持 tool search，就不能依赖延迟加载 |
| 大量 MCP 工具 | 可以 | 工具多、schema 大，适合搜索后加载 |
| 低频外部集成工具 | 可以 | 例如少用的第三方服务操作 |

Provider Profile 必须声明 `supportsDeferredToolSearch`。当值不是 `true` 时，不允许把关键工具从请求 schema 中移除。

## 10. 新接 Provider 的统一流程

新增 provider 时按这个顺序做：

1. 查官方文档。
   - 工具声明格式。
   - 工具调用返回格式。
   - 工具结果回填格式。
   - 是否支持 strict schema。
   - 是否支持并行工具调用。
   - 是否支持 deferred tool search。
2. 新增或复用 Provider Profile。
   - OpenAI-compatible 也要单独 profile，不能只因为兼容 OpenAI 就默认能力完整。
3. 实现 provider adapter 映射。
   - `CcrToolDefinition -> provider tools`
   - `provider tool call -> CcrToolCall`
   - `CcrToolResult -> provider tool result`
4. 跑标准 probe。
   - `TodoWrite` 合法参数。
   - `TodoWrite` 非法参数。
   - 单工具调用。
   - 多工具调用。
   - 工具错误结果后继续对话。
   - 没有工具调用时普通文本输出。
5. 记录 provider 实际行为。
   - 如果和官方文档不一致，以实际 probe 结果补 profile 注释。
   - 第三方中转必须允许用户 profile 覆盖。

## 11. 标准 Probe

第一版至少保留这些 fixture：

| Probe | 目标 |
| --- | --- |
| `tool-call-basic-text` | 模型能调用一个简单工具并继续回复 |
| `tool-call-todowrite-valid` | `TodoWrite` 合法参数进入 todo 浮层 |
| `tool-call-todowrite-invalid` | `name / description` 这类错误字段进入标准错误卡 |
| `tool-result-error-recovery` | 工具失败后下一轮请求仍能继续 |
| `tool-call-parallel` | 支持或明确禁止并行工具调用 |
| `tool-call-history-replay` | 历史会话恢复后不出现悬空 tool call |
| `tool-call-deferred-search` | 只有声明支持的 provider 才运行 |

验证命令按改动范围选择：

```powershell
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server-client
npm.cmd run typecheck
npm.cmd run desktop:build
```

## 12. DeepSeek TodoWrite 事故复盘口径

历史会话：

```text
C:\Users\luoji\.ccr\projects\D--learn-code-gomoku\096e3bbe-d479-4914-8e84-396346bfcf05.jsonl
```

现象：

1. `deepseek-v4-flash` 在未加载 `TodoWrite` schema 的情况下直接调用 `TodoWrite`。
2. 模型输出了 `name / description`，缺少 `content / activeForm`。
3. `TodoWrite` 输入校验失败。
4. 随后模型按提示调用 `ToolSearch select:TodoWrite`。
5. 下一轮 DeepSeek OpenAI-compatible 请求又因为工具调用结果序列不满足 provider 要求而失败。

结论：

- 这不是 Todo UI 展示坏了。
- 这是 provider 工具 schema 加载策略和工具结果回填链路共同导致的问题。
- 修复不应是“DeepSeek 单独兼容 TodoWrite”，而应是：
  - 核心工具不 deferred。
  - Provider adapter 保证工具调用和工具结果严格成对。
  - 工具参数错误统一进入标准错误结果。
  - UI 展示标准错误卡。

## 13. 第一版落地范围

第一版先做：

- 抽出 `ProviderToolProfile` 或等价配置结构。
- 将 `TodoWrite` 标为核心工具，不走 deferred。
- OpenAI-compatible adapter 发送前校验 tool call / tool result 序列。
- `TodoWrite` 参数校验失败展示为标准错误卡。
- 补 DeepSeek 风格错误参数 fixture。

暂不做：

- 为每个工具写 provider 专属分支。
- 自动把 `name / description` 修复成 `content / activeForm`。
- 对所有第三方中转默认开启 strict schema。
- 一次性迁移所有工具 schema 生成逻辑。

## 14. 后续演进

后续可以逐步增强：

1. 工具 schema 生成器。
   - 从 Zod / 工具定义生成 provider 需要的 JSON Schema。
   - 根据 Provider Profile 裁剪不支持的 JSON Schema keyword。
2. Provider 能力目录。
   - 内置官方 provider 能力。
   - Profile 覆盖第三方中转能力。
3. 工具结果历史修复器。
   - 发送给 provider 前扫描悬空 tool call。
   - 能修复则补标准错误结果，不能修复则阻止请求并提示内部错误。
4. Provider probe 套件。
   - 每个 provider 接入时跑一套最小真机验证。
   - 结果写回文档和 profile 注释。

这套标准的目标是让 CCR 后续接入新模型时，只做“provider 协议接入”和“能力声明”，而不是让每个工具都重新适配一遍。
