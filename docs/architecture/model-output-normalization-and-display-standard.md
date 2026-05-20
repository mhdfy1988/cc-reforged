# CCR 模型输出归一化与展示标准

## 1. 文档目标

本文定义 CCR 面向 Desktop 聊天区的展示标准，以及不同模型 / provider 输出进入展示层前的归一化规则。

内部标准消息、内容块、工具调用、工具结果、能力声明和错误快照的字段定义见 [CCR 标准 LLM 协议 v0.1](./ccr-standard-llm-protocol.md)。本文只展开 provider 输出进入 Desktop 展示层前的归一化和组件展示口径。

核心结论：

```text
不同模型输出不会相同
-> CCR 必须先归一化成自己的内容块和展示事件
-> UI 只消费 DisplayEvent 和各类 Snapshot
```

本文不要求 OpenAI、Anthropic、Gemini、DeepSeek 或 OpenAI Compatible 网关返回同一种原始结构。相反，CCR 需要把它们映射到统一的内部结构，避免 UI、历史恢复和工具卡片各自猜字段。

## 2. 分层标准

标准链路分四层：

```text
Provider 原始消息
-> CCR 标准内容块
-> App Server / Desktop 展示事件
-> UI 组件
```

| 层级 | 责任 | 不允许做什么 |
| --- | --- | --- |
| Provider 原始消息 | 接收各家 SDK / 网关返回结构 | 不直接进入 UI |
| CCR 标准内容块 | 表达文本、图片、文件、音频、工具、思考、未知 JSON | 不判断 UI 样式，不拼组件 |
| 展示事件 | 把内容块归一化为 `DisplayEvent` / Snapshot | 不重新判断 provider 能力，不执行工具 |
| UI 组件 | 渲染消息、工具卡、附件条、文件卡、错误卡 | 不解析 provider 原始协议 |

这条链路里，provider adapter 负责“协议映射”，Desktop domain 负责“展示归一化”。两者不能混在一起。

## 3. CCR 标准内容块

第一版标准内容块按用途分组。

### 3.1 文本块

内部标准类型使用：

```ts
type TextBlock = {
  type: 'text'
  text: string
}
```

历史恢复和 provider 兼容层必须把这些文本别名当作文本处理：

| 来源 | 常见原始类型 | 归一化结果 |
| --- | --- | --- |
| Claude / CCR | `text` | `text` |
| OpenAI / Codex 用户输入 | `input_text` | `text` |
| OpenAI / Codex 助手输出 | `output_text` | `text` |
| OpenAI Realtime 部分消息 | `text` / `input_text` / `output_text` | `text` |

不变式：

- 用户真实输入不能因为只认 `text` 而被丢弃。
- 普通用户文本不应走工具事件展示。
- 文本归一化只处理可见文本，不把 reasoning encrypted content 或系统大段配置当作用户消息。

### 3.2 媒体与附件块

内部标准类型先保留三类：

```ts
type ImageBlock = {
  type: 'image'
  attachmentId?: string
  displayName?: string
  mimeType?: string
  sizeBytes?: number
  source?: unknown
}

type FileBlock = {
  type: 'file'
  attachmentId?: string
  displayName?: string
  mimeType?: string
  sizeBytes?: number
  source?: unknown
}

type AudioBlock = {
  type: 'audio'
  attachmentId?: string
  displayName?: string
  mimeType?: string
  sizeBytes?: number
  source?: unknown
}
```

兼容别名：

| 原始类型 | 归一化结果 | 备注 |
| --- | --- | --- |
| `image` / `image_url` / `input_image` | `image` | UI 展示为 `AttachmentSnapshot` |
| `file` / `input_file` / `attachment` | `file` | 文件内容是否进入模型由能力校验决定 |
| `audio` / `input_audio` | `audio` | 第一版只保留展示入口 |

安全规则：

- UI 状态、历史列表和日志里不内联 base64。
- 本地路径可以用于复制和预览，但不能作为 provider 请求错误的完整明文输出。
- 历史恢复时附件文件不存在，不应导致整条消息不可渲染。

### 3.3 工具与进度块

工具相关块不归入普通 assistant 文本：

```ts
type ToolUseBlock = { type: 'tool_use'; id?: string; name?: string; input?: unknown }
type ToolResultBlock = { type: 'tool_result'; tool_use_id?: string; content?: unknown }
type ProgressBlock = { type: 'progress'; data?: unknown }
```

不变式：

- `tool_use` / `tool_result` / `progress` 必须进入工具展示归一化。
- 工具结果里如果包含 `image/file/audio/attachment`，要提取为附件快照，展示在工具卡内部。
- 工具结果对应的 `type: "user"` 历史消息是模型工具回填，不是用户真实发言，不能渲染成普通“我”的消息。

### 3.4 思考与未知块

思考相关：

| 原始类型 | 默认展示 |
| --- | --- |
| `thinking` | 不展示 raw 内容 |
| `redacted_thinking` | 不展示 raw 内容 |
| `reasoning` | 默认不展示，后续只展示摘要 |

未知内容：

```ts
type JsonFallbackBlock = {
  type: 'json'
  value: unknown
}
```

未知块可以进入详情或日志，不应直接铺到聊天主界面。只有在没有更合适的结构化展示时，才作为折叠原始内容提供复制。

## 4. 当前展示事件标准

Desktop 当前展示层标准是：

```text
AppServerThreadMessage / ChatMessage
-> DisplayEvent
-> MessageFrame / ToolCard / FileCard / TodoOverlay / PermissionCard
```

当前 `DisplayEvent.type`：

| 类型 | 语义 | 主要数据 |
| --- | --- | --- |
| `user_message` | 用户消息 | `text`、`attachmentSnapshots` |
| `assistant_message` | 助手正文 | `text` |
| `thinking_summary` | 思考摘要或进展 | `text` |
| `tool_call` | 工具调用及合并结果 | `toolSnapshot`、附件快照 |
| `tool_result` | 孤立工具结果兜底 | `toolSnapshot` |
| `permission_request` | 权限请求 | permission snapshot |
| `todo_list` | TodoWrite 状态 | `todoSnapshot` |
| `file_change` | 文件变更 | `fileSnapshot` |
| `file_reference` | 文件/引用命中 | `referenceSnapshot` |
| `attachment` | 单独附件事件 | `attachmentSnapshot` |
| `error` | 错误 | `text` |
| `system_notice` | 系统提示 | `text` |

Snapshot 分工：

| Snapshot | 负责 |
| --- | --- |
| `ToolSnapshot` | 工具名、分类、状态、参数、结果、错误分类 |
| `FileSnapshot` | 文件变更、读取、路径、安全状态 |
| `AttachmentSnapshot` | 图片、文件、音频的展示、复制、预览状态 |
| `ReferenceSnapshot` | 文件引用、URL、搜索命中 |
| `TodoOverlaySnapshot` | todo 项、状态、进度 |

实现位置：

- `apps/desktop/src/renderer/src/domain/displayEvents.ts`
- `apps/desktop/src/renderer/src/domain/contentBlocks.tsx`
- `apps/desktop/src/renderer/src/domain/toolEvents.ts`
- `apps/desktop/src/renderer/src/domain/fileEvents.ts`
- `apps/desktop/src/renderer/src/domain/todoEvents.ts`
- `src/app-server/handlers/sessionHandlers.ts`

## 5. 历史恢复规则

历史恢复要面对多种历史来源：

- CCR 自己的 `.ccr` transcript。
- Codex `.codex/sessions` 的 `response_item` / `event_msg`。
- OpenAI Compatible provider 可能保留的 OpenAI 风格块。
- 旧版本 Desktop 只保存的纯文本消息。

恢复规则：

1. `text` / `input_text` / `output_text` 都作为可见文本。
2. 纯用户文本直接恢复为 `user_message`。
3. 用户消息中包含附件时，恢复为带 `attachmentSnapshots` 的 `user_message`。
4. 用户消息中只有 `tool_result` 时，这是工具回填，不作为用户气泡展示。
5. 助手消息中包含 `tool_use` / `tool_result` / `progress` 时，进入工具卡归一化。
6. 未知结构保留到详情，不让它阻断整条历史消息。
7. 历史恢复不读取大文件正文，不自动把本地文件重新塞进模型上下文。

本规则的目标不是让历史恢复“像实时流一样完整”，而是保证用户真实发言、助手正文、工具卡、附件条都能稳定可读。

## 6. Provider Adapter 映射规则

Provider adapter 的任务是把 CCR 内容块映射到目标协议，或把目标协议返回映射回 CCR 内容块。

工具调用协议的详细统一化规则见 [CCR Provider 工具协议统一化标准](./provider-tool-protocol-normalization.md)。本文只定义展示层需要消费的 `tool_use` / `tool_result` 归一化结果，不重复维护 OpenAI、Anthropic、Gemini、DeepSeek 等 provider 的原始工具协议。

示例：

| Provider / 协议 | 原始结构 | CCR 内容块 |
| --- | --- | --- |
| Anthropic Messages | `content: [{ type: "text" }]` | `text` |
| Anthropic Messages | `tool_use` / `tool_result` | `tool_use` / `tool_result` |
| OpenAI Responses | `input_text` / `output_text` | `text` |
| OpenAI Responses | `input_image` | `image` |
| OpenAI Chat Completions | message text / multimodal parts | `text` / `image` |
| Gemini | `parts.text` | `text` |
| Gemini | `inlineData` / `fileData` | `image` / `file` |
| DeepSeek 官方 | text + tool calls | `text` / `tool_use` / `tool_result` |
| OpenAI Compatible 中转 | 不可信，可能裁剪能力 | 先按 Profile 能力，再映射 |

适配规则：

- 发送前必须先走模型能力校验。
- Adapter 不负责决定“这个模型是否支持图片”，只负责转换已通过校验的内容块。
- OpenAI Compatible 不能只按模型名判断能力，必须允许 Profile 覆盖。
- 返回内容如果无法识别，先进入 `json` 兜底，不直接污染 UI 主消息。

## 7. 多模态输出口径

“多模态输出”要区分三件事：

| 类型 | 第一版口径 |
| --- | --- |
| 模型文本输出 | 已纳入 `assistant_message` |
| 模型返回媒体引用 | 归一化为 `AttachmentSnapshot` 或 `ReferenceSnapshot` |
| 模型生成图片 | 已进入 `0.5.0` 第一版，通过 `GenerateImage` 和 `generatedArtifact` 统一展示 |
| 模型生成音频 / 文件 | 不在第一版默认范围，后续单独做生成型输出标准 |

第一版不是承诺所有模型都能“生成图片”。当前目标是：

- 用户能发图片给支持视觉的模型。
- 工具 / MCP / 浏览器产生的图片、文件能在聊天区展示。
- 历史恢复后这些附件仍可见。
- 支持图片生成的 provider 通过 `GenerateImage` 或会话 `imageGeneration` metadata 输出标准 `CcrImageContentBlock` 和 `generatedArtifact`。
- provider 返回图片 URL 时，后端应先下载并持久化，再交给 Desktop 渲染缩略图和预览；UI 不直接依赖远程临时 URL。
- 如果未来 provider 返回文件 ID、音频引用或其它生成物，先作为附件 / 引用展示，不直接塞进普通 Markdown。

## 8. 回归样例要求

后续每接入一种 provider 输出格式，都要补 fixture 或 smoke 样例。

最低样例：

| 样例 | 必须验证 |
| --- | --- |
| `openai-input-text-history` | `input_text` 用户消息能恢复 |
| `openai-output-text-history` | `output_text` 助手文本能恢复 |
| `anthropic-tool-use-result` | `tool_use` / `tool_result` 进入工具卡 |
| `user-image-attachment-history` | 用户图片附件恢复为附件条 |
| `tool-image-output` | 工具返回图片展示在工具卡内 |
| `model-generated-image` | 模型生成图片展示为附件卡，缩略图和预览可用 |
| `remote-generated-image-url` | 远程图片 URL 先下载持久化，再展示本地生成物 |
| `unknown-json-fallback` | 未知结构不打断时间线 |
| `text-only-model-with-image` | 不支持图片模型发送前阻止 |

验证命令按改动范围选择：

```powershell
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server-client
npm.cmd run typecheck
npm.cmd run desktop:build
```

## 9. 当前状态与缺口

已具备：

- Desktop 已有 `DisplayEvent` 展示标准。
- 工具、文件、附件、todo 已有 Snapshot 雏形。
- 历史恢复已能识别 `text` / `input_text` / `output_text`。
- 用户附件展示和图片预览已经进入聊天区。
- App Server 线程消息已经向 renderer 提供 `content` 作为历史回放依据。
- 图片生成输出已经统一为 `generatedArtifact`，GLM URL 图片、OpenAI / Codex OAuth / MiniMax 图片都会进入同一套附件缩略图和预览 UI。

仍需补齐：

- 补 provider 输出样例 fixture，覆盖 OpenAI、Anthropic、Gemini、DeepSeek、OpenAI Compatible。
- 结构化输出标准仍缺，不能长期只当 JSON 文本展示。
- 音频、文件这类生成型多模态输出，需要单独设计生命周期和安全策略。
- 日志页和聊天详情页应共用同一套 raw 内容复制组件，避免各自展示 raw JSON。

## 10. 后续执行顺序

建议后续按这个顺序推进：

1. 继续补 OpenAI / Anthropic / Gemini / DeepSeek / OpenAI Compatible 样例 fixture。
2. 把历史恢复样例纳入更稳定的 smoke。
3. 继续把图片生成输出的 URL 下载、落盘、恢复和预览失败兜底固化。
4. 再做结构化输出和音频 / 文件生成型媒体输出。

这样做的收益是：后续新增 provider 或模型能力时，只需要补一层 adapter 和样例，不需要改 UI 主链路。
