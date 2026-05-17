# CCR 多模态输入输出设计

## 1. 目标

这份文档单独沉淀 CCR 的多模态输入/输出、附件上传与预览能力。

它只负责“消息内容怎么表达、附件怎么进入会话、不同 provider 怎么接收这些内容、Desktop 怎么展示和恢复”，不负责多供应商配置、模型档案、密钥管理和供应商切换。多供应商部分单独见 [CCR 多供应商模型与协议接入设计](./multi-provider-model-management-design.md)。

第一版目标是：

- 先建立模型能力声明和发送前校验，而不是先做 UI 上传按钮。
- Desktop 输入框支持选择图片和文件。
- 聊天区能展示附件草稿、已发送附件和模型返回的媒体/文件引用。
- Core user message 从纯文本升级为统一内容块。
- App Server 协议能表达文本、图片、文件引用和附件元数据。
- LLM Runtime 根据当前 provider/model 能力选择正确的协议映射。
- 不支持多模态的模型在发送前给明确提示，而不是请求失败后才暴露协议错误。

## 1.1 方向调整：能力协商优先

调研 OpenRouter、Vercel AI Gateway、GitHub Copilot SDK、LiteLLM、LangChain 和 Anthropic 后，P23 的实现顺序需要调整。

外部系统的共同做法不是让模型“自己判断”能不能处理图片、文件或音频，而是在模型外部维护能力元数据：

- Vercel / OpenRouter 通过模型目录暴露 `input_modalities`、`output_modalities`、`supported_parameters`。
- GitHub Copilot SDK 要求发送图片前检查 `capabilities.supports.vision`，并用 limits 描述图片数量、大小和 mime type。
- LiteLLM 提供 `supports_vision(model)` 这类 helper。
- LangChain 提供统一多模态内容块，但明确具体模型能力仍要回到 provider 文档。
- Anthropic 的 Workbench 在选择支持图片的模型时才显示图片添加入口，并在文档中明确图片格式、大小、数量和“只理解图片、不生成图片”的限制。

因此 CCR 第一版不做“万能附件上传”。新的执行顺序是：

```text
模型能力声明
-> 当前 Profile + 当前模型能力解析
-> Desktop 附件草稿状态与发送前校验
-> CCR 内容块协议
-> Provider adapter 映射
-> 用户消息 / 工具输出 / 历史恢复展示
```

核心原则：

- 没有能力声明时默认只认为支持文本输入和文本输出。
- UI 可以展示附件草稿，但发送前必须明确“会发送 / 仅预览 / 需转换 / 不支持”。
- 不支持的附件不能静默丢弃，也不能靠请求失败后再解释。
- Provider adapter 只处理已经通过能力校验的内容块。
- 工具、MCP、浏览器产生的图片或文件可以先作为 Desktop 输出展示；能否再次发送给模型要重新走能力校验。

参考资料：

- [Vercel AI Gateway Models & Providers](https://vercel.com/docs/ai-gateway/models-and-providers/)
- [OpenRouter Multimodal Capabilities](https://openrouter.ai/docs/guides/overview/multimodal/overview)
- [GitHub Copilot SDK Image Input](https://docs.github.com/en/copilot/how-tos/copilot-sdk/use-copilot-sdk/image-input)
- [LangChain Messages: Multimodal](https://docs.langchain.com/oss/python/langchain/messages)
- [LiteLLM Vision](https://docs.litellm.com.cn/docs/completion/vision)
- [Anthropic Vision](https://docs.claude.com/en/docs/build-with-claude/vision)

## 2. 边界

本文负责：

- 用户上传附件的草稿状态。
- 图片输入的最小闭环。
- 文件附件的元数据、预览和后续扩展入口。
- Core / App Server / Desktop 的内容块协议。
- Provider adapter 对多模态内容块的转换。
- 历史会话恢复后的附件展示。

本文不负责：

- 新增 OpenAI、Anthropic、OpenAI Compatible 等供应商。
- API Key、OAuth、baseUrl、自定义 header 配置。
- 顶部模型切换和“模型与供应商”页面。
- 大文件解析、向量化、知识库和长期文件索引。
- 复杂音频、视频、屏幕录制输入。
- 模型生成图片、生成音频等创作型多模态输出。

这些能力可以后续扩展，但第一版先把“用户把图片/文件随消息发给模型，并能稳定展示和恢复”做稳。

模型原始输出和 Desktop 展示层之间的统一口径见 [CCR 模型输出归一化与展示标准](./model-output-normalization-and-display-standard.md)。后续新增 provider、多模态输出或历史恢复兼容时，先按该标准映射到 CCR 内容块和 `DisplayEvent`，不要让 UI 直接消费各家原始协议。

## 3. 和多供应商专项的关系

两个专项是并列关系：

```text
多供应商专项
  -> 负责 provider/profile/protocol/auth/model/capability

多模态专项
  -> 负责 text/image/file attachment/content block/display
```

交界面只有一层：模型能力声明。

多供应商专项需要提供类似能力：

```ts
type LlmModelCapabilities = {
  inputModalities: Array<'text' | 'image' | 'file' | 'audio'>
  outputModalities: Array<'text' | 'image' | 'audio'>
  tools: boolean
  structuredOutput: boolean
  source: 'builtin' | 'profile_override' | 'default'
  reason: string
  baseSource?: 'builtin' | 'default'
  image?: {
    maxImages?: number
    maxImageBytes?: number
    mimeTypes?: string[]
  }
}
```

多模态专项只消费这些能力，不自己决定哪个 provider 可用。

能力来源优先级：

第一版只保留两个正式来源：

1. 内置能力目录。
   - 官网 / 官方文档是这份目录的事实来源，例如官方模型页、vision/audio/file input 文档和 SDK 示例。
   - CCR 把官网信息整理成版本化 catalog，放在仓库里。
   - 这层适合官方 provider，例如 OpenAI、Anthropic、Gemini、MiniMax、DeepSeek。
2. Profile 覆盖。
   - 对 OpenAI Compatible / 第三方中转，不能只看模型名。
   - 同一个 `gpt-4o`、`claude-sonnet`、`gemini` 名字，在不同中转里可能被禁用图片、文件或工具调用。
   - Profile 必须允许用户或配置声明：只支持文本、支持图片输入、支持工具、支持 structured output、最大图片大小和 mime type。

如果内置目录和 Profile 覆盖都没有命中，就使用保守默认值：只支持文本输入和文本输出。

能力解析必须同时考虑 `profileId + model + apiMode`。同一个模型名在不同 provider 或中转里可能能力不同，不能只靠模型名称判断。

官网用于初始化内置目录，但运行时最终能力以“当前 Profile + 当前模型 + 协议模式”的解析结果为准。尤其是 OpenAI Compatible / 第三方中转，不允许因为模型名像 `gpt-4o`、`claude-sonnet` 或 `gemini` 就自动启用图片、文件或音频；必须由 Profile 覆盖明确声明。

示例：

```text
当前模型：Anthropic / claude-sonnet-4-5
能力：input.text + input.image + tools

用户发送：文本 + PNG
多模态层：允许发送，生成 text/image content blocks
Provider adapter：把 blocks 转成 Anthropic Messages 对应请求格式
```

再例如：

```text
当前模型：OpenAI Compatible / deepseek-chat
能力：input.text + tools，input.image=false

用户发送：文本 + PNG
多模态层：发送前拦截，提示“当前模型不支持图片输入”
```

## 3.1 第一版能力矩阵口径

第一版不追求把所有 provider 都打通，只需要把“不支持时不误发”做稳。

| Provider / Profile 类型 | 第一版默认能力 | 处理口径 |
| --- | --- | --- |
| `codex-oauth` | `gpt-5.5` 声明 `text + image`、tools；`gpt-5.4` / `gpt-5.4-mini` 暂按文本模型处理 | 图片只在 provider adapter 边界读取为 base64 并映射成 pi-ai `image` block；未声明图片能力的模型继续阻止 |
| `deepseek` 官方 | `text`、tools；默认不声明图片 | 图片发送前阻止 |
| `minimax` | 按内置模型目录声明 | 只启用已确认能力 |
| `openai-compatible` | 默认只支持文本 | 需要 Profile 覆盖才启用图片/文件 |
| 后续官方 OpenAI | 按模型目录声明 `input/output` | OpenAI Responses 和 Chat Completions adapter 分别映射 |
| 后续 Anthropic | 按模型目录声明图片理解能力 | 第一版只做图片输入，不把 Claude 当图片生成模型 |

这里的“默认能力”不是事实宣称，而是 CCR 的保守运行策略。宁可先阻止，也不要把附件发出去后模型无视或报协议错误。

## 3.2 当前实现状态

当前代码里已经有第一版能力解析骨架，但能力目录还没有完全覆盖所有 provider / model。

实现位置：

| 文件 | 责任 |
| --- | --- |
| `src/services/llm/types.ts` | 定义 `LlmModelCapabilities`、`LlmInputModality`、`LlmOutputModality`、`LlmModelCapabilitySource` 等类型 |
| `src/services/llm/modelCatalog.ts` | 内置模型目录，记录已知模型的上下文、输出上限、工具能力和输入模态 |
| `src/services/llm/modelCapabilities.ts` | 解析最终模型能力：内置目录 -> Profile 覆盖 -> 默认纯文本 |
| `src/services/llm/llmConfig.ts` | 读取 `llm.config.local.json`，支持 `capabilityOverrides` 配置 |
| `src/services/llm/runtimeStatus.ts` | 在运行时状态中暴露当前 provider/model 的 `modelCapabilities` |
| `C:\Users\luoji\.ccr\data\llm.config.local.json` | 本机 Profile 配置，当前主要配置账号、provider、模型列表；目前未写 `capabilityOverrides` |

当前已内置的第一版能力：

| Provider | 模型 | 当前内置能力 |
| --- | --- | --- |
| `codex-oauth` | `gpt-5.5` | `text + image` 输入，文本输出，支持工具 |
| `codex-oauth` | `gpt-5.4` / `gpt-5.4-mini` | 文本输入，文本输出，支持工具 |
| `deepseek` | `deepseek-v4-flash` / `deepseek-v4-pro` | 文本输入，文本输出，支持工具 |
| `minimax` / `minimax-cn` | `MiniMax-M2.7` / `MiniMax-M2.7-highspeed` | 文本输入，文本输出，支持工具 |
| `anthropic` | 当前默认 Claude 系列 | 代码里暂按 `text + image` 输入处理，后续需要细化到具体模型目录 |
| 未知 provider / 未知模型 | 任意 | 默认纯文本输入 / 纯文本输出，不默认启用图片、文件或音频 |

当前缺口：

- `capabilityOverrides` 已有 schema，但本机配置暂未写入覆盖项。
- 内置目录还没有覆盖官方 OpenAI、Gemini、更多 Claude 版本、结构化输出、音频、文件输入、图片生成等能力。
- `tools` 目前是布尔值，工具 strict schema、并行工具调用、deferred tool search 等细节已转入 [CCR Provider 工具协议统一化标准](./provider-tool-protocol-normalization.md) 继续细化。
- Desktop 需要把解析后的 `modelCapabilities` 用到发送前校验和附件草稿状态，而不是只在顶部展示模型名。

后续补能力时必须遵守：

1. 官方 provider 能力先查官网，再写入内置目录。
2. 第三方中转 / OpenAI Compatible 必须通过 Profile 覆盖声明能力，不能靠模型名猜。
3. 未声明能力时按纯文本处理。
4. 每次新增 provider 或模型能力，都要补 smoke / probe，至少验证“不支持图片时发送前阻止”和“支持图片时请求结构正确”。

## 4. 内容块模型

Core 和 App Server 不应继续假设用户输入只有一段字符串。

建议引入统一内容块：

```ts
type UserContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | FileContentBlock

type TextContentBlock = {
  type: 'text'
  text: string
}

type ImageContentBlock = {
  type: 'image'
  attachmentId: string
  mimeType: string
  sizeBytes: number
  width?: number
  height?: number
  source:
    | { kind: 'data'; data: string }
    | { kind: 'file'; path: string }
}

type FileContentBlock = {
  type: 'file'
  attachmentId: string
  name: string
  mimeType?: string
  sizeBytes?: number
  source:
    | { kind: 'file'; path: string }
    | { kind: 'text'; text: string }
}
```

第一版建议：

- 图片可以走 `data` 或受控临时文件路径。
- 文件先以元数据和路径引用为主。
- 文本类小文件后续再按能力转为 `text` content block。
- 大文件不自动塞进模型上下文。

## 5. 附件生命周期

附件状态建议拆成五段：

```text
选择文件
-> 草稿附件
-> 发送前校验
-> 进入 turn input
-> 持久化到历史会话
```

### 5.1 草稿附件

Desktop 输入框里维护草稿附件：

```ts
type DraftAttachment = {
  id: string
  name: string
  path: string
  mimeType?: string
  sizeBytes?: number
  previewUrl?: string
  status: 'ready' | 'too_large' | 'unsupported' | 'missing' | 'error'
  errorMessage?: string
}
```

草稿阶段只做本地校验：

- 文件是否存在。
- 文件大小是否超过本地限制。
- mime type 是否可识别。
- 当前模型是否支持对应输入类型。

### 5.2 发送前校验

发送时再做一次校验：

- 当前模型能力是否支持。
- 文件仍然存在。
- 图片大小和格式是否符合 provider 限制。
- 工作区外文件是否需要二次确认。

校验失败不应创建 turn。

### 5.3 进入 turn input

`thread/start` 或 `turn/start` 参数需要从：

```json
{
  "input": {
    "type": "text",
    "text": "分析这张图"
  }
}
```

扩展为：

```json
{
  "input": {
    "type": "content",
    "content": [
      { "type": "text", "text": "分析这张图" },
      {
        "type": "image",
        "attachmentId": "att_123",
        "mimeType": "image/png",
        "sizeBytes": 1024,
        "source": { "kind": "file", "path": "D:\\work\\a.png" }
      }
    ]
  }
}
```

App Server 第一阶段已经采用这个结构：旧文本入口保留为 `input.type = "text"`，新多模态入口统一走 `input.type = "content"`。MM-03 后，CoreTurn 已能保存 `content` 内容块；MM-07 后，内建 LLM Runtime 路径已经能把图片内容块映射到 provider adapter。文件和音频的原生 provider 映射仍留给后续阶段。

## 6. Provider Adapter 映射

多模态层只输出 CCR 自己的内容块，具体协议由 provider adapter 转换。

### 6.1 OpenAI Responses

映射方向：

```text
CCR text  -> input_text
CCR image -> input_image
CCR file  -> file / input_file / text fallback
```

第一版优先图片输入，不急着实现完整文件上传。

### 6.2 OpenAI Chat Completions / Compatible

映射方向：

```text
CCR text  -> content text part
CCR image -> image_url part
CCR file  -> text fallback 或提示不支持
```

第三方中转差异较大，必须走能力声明，不要默认所有 compatible 都支持图片。

当前实现快照（2026-05-16）：

- OpenAI Chat / Compatible adapter 已支持用户消息 `content` 数组。
- 文本按 `text` part 发送。
- 本地图片在 adapter 发请求前读取为 data URL，并放入 `image_url.url`。
- URL 图片保持 URL 形式放入 `image_url.url`。
- Provider 错误诊断只记录 content part 数、图片 part 数和文本长度，不输出 base64 或本地路径。

### 6.3 Anthropic Messages

映射方向：

```text
CCR text  -> text block
CCR image -> image block
CCR file  -> document block 或 text fallback
```

当前实现快照（2026-05-16）：

- Anthropic Messages adapter 已支持用户消息 `image` block。
- 本地图片在 adapter 发请求前读取为 `source.type = "base64"`。
- URL 图片保持 `source.type = "url"`。
- 当前只做图片输入；文件 document block 和原生 Files API 留给后续增强。

### 6.4 Codex OAuth

Codex OAuth 走当前内置 LLM Runtime。MM-09 真机复查发现 `gpt-5.5` 的 UI 仍显示图片“不支持”，根因是能力目录和 `CodexOAuthProvider` 发送层都还停在文本假设。

当前实现快照（2026-05-17）：

- `gpt-5.5` 内置能力目录声明为 `text + image` 输入、`text` 输出和 tools。
- `gpt-5.4` / `gpt-5.4-mini` 仍按文本输入处理，避免未验证模型误收图片。
- `CodexOAuthProvider` 保留纯文本用户消息的 string content 映射；当用户消息包含图片时，转成 pi-ai 的 `[{ type: "text" }, { type: "image" }]` content 数组。
- 本地图片只在 provider adapter 发请求前读取为 base64；请求上下文和错误诊断不输出本地路径或 data URL。
- 真机验收已确认 `codex-oauth / gpt-5.5` 真实发送图片后模型能读取图片；文本模型发送图片会被发送前能力校验拦截，不会静默漏发。
- 如果后续打开更多 Codex OAuth 模型能力，必须同时更新能力目录、provider 映射和 smoke，不只改前端标签。

## 7. Desktop 交互

### 7.1 输入框

输入框左侧 `+` 继续作为附件入口。

第一版交互：

- 点击 `+` 选择文件。
- 图片显示缩略图。
- 文件显示名称、大小、类型。
- 每个附件支持删除。
- 不支持的附件显示轻量错误状态。
- 发送按钮在附件不可发送时禁用或弹出原因。

当前实现快照（2026-05-16）：

- Composer 已支持附件草稿队列、追加、去重和删除。
- Composer 输入框已支持粘贴文件和图片；粘贴结果进入同一套附件草稿队列，不新增单独的粘贴 UI。
- 草稿附件会根据当前 `modelCapabilities` 显示 `可发送 / 可转换 / 仅预览 / 不支持`。
- 图片附件已由 main/preload 做读取验证、大小限制、mime type 归一化和缩略图生成。
- 无路径剪贴板图片会由 renderer 读取为二进制并交给 main，main 写入受控临时文件后再返回 `file` source；不把 base64 放进普通日志或 UI 状态。
- 发送时图片会进入 `turn/start.input.content` 的 `image` block；内建 LLM Runtime 会在 provider adapter 边界转换为 OpenAI `image_url` 或 Anthropic `image` block。
- 小文本文件已由 main/preload 做 128 KB 上限保护，发送时转换为 `text` block；大文本和二进制文件默认只保留元信息。
- 原生 Anthropic 旧 `query` 路径暂时仍使用文本 fallback，避免旧路径误发 CCR 自定义 file source。

### 7.2 聊天消息

用户消息卡展示：

- 文本内容。
- 图片缩略图。
- 文件附件卡片。

助手消息卡展示：

- 文本。
- 图片/文件引用。
- 工具生成的文件卡继续沿用 P21 的 `FileSnapshot` / `AttachmentSnapshot`。

当前实现快照（2026-05-16）：

- `DisplayEvent` 已支持多个 `attachmentSnapshots`。
- 当前发送的图片附件和小文本文件会在用户消息下方显示紧凑附件条，不再额外铺 `[图片附件：...]` 或 `[文本文件：...]` 占位行；图片附件优先显示缩略图，缩略图可点击打开当前窗口内大图预览。
- 如果历史或工具事件只保留本地图片路径，renderer 会通过 preload 请求 main 生成安全缩略图，不直接用 `file://` 暴露本地资源。
- 大图预览按点击行为临时向 main 请求较大预览图，聊天流常驻状态仍只保留缩略图和附件元信息。
- 工具结果、MCP 或浏览器输出中出现 `image/file/audio/attachment` 内容块时，也会提取成同一组附件快照，并在工具卡内展示。
- 附件条只展示类型、名称、mime、大小、路径和复制路径，不读取文件内容，也不输出 base64。

### 7.3 历史恢复

恢复历史会话时：

- 能看到当时发送过哪些附件。
- 如果本地文件还在，可继续预览。
- 如果文件不存在，展示“本地文件已不存在”的状态。
- 不因为附件缺失导致整条历史消息不可渲染。

当前实现快照（2026-05-17）：

- 历史回放遇到用户 `content` block 会走 completed item replay，而不是只追加纯文本消息。
- 历史中的 `image/file/audio` 内容块可以恢复为用户消息附件条。
- 历史中已落盘但缺少结果的 `tool_use` 会恢复为工具卡并显示“已中断”，不再误显示“成功”或“执行中”。
- 中断发生在助手回复或工具调用落盘前时，历史里没有可恢复的命令内容，界面显示“本轮已中断，未产生可恢复回复。”，不再显示内部 `No response requested.`。
- 当前阶段不在历史恢复时读取本地文件，也不做文件存在性探测；缺失检测和更强预览留给后续增强。

## 8. 安全与限制

第一版必须守住这些规则：

- API Key 和 token 不进入附件元数据。
- 不自动读取大文件全文。
- 工作区外文件需要清晰提示。
- 图片 base64 不在普通日志里完整打印。
- 历史会话不要无限复制大附件内容。
- 如果采用临时文件缓存，需要有清理策略。
- 多模态内容块进入模型前必须经过 provider capability 校验。

建议第一版限制：

- 图片大小先限制在 10 MB 以内。
- 单轮附件数量先限制在 5 个以内。
- 只支持常见图片：PNG、JPEG、WEBP、GIF 静态预览。
- 文件附件只做卡片和路径引用，不默认发全文。

## 9. 第一版实施顺序

建议顺序：

1. 定义 `ModelCapabilities` 和能力解析器。
2. 把当前 `profileId + model + apiMode` 的解析后能力暴露给 Desktop / App Server。
3. 定义 App Server `input.content` 协议，保留旧文本入口。
4. Core user message 归一化为内容块，同时保留 provider fallback 文本。
5. Desktop 输入框草稿附件和能力提示。
6. 图片输入最小闭环：main/preload 安全读取、受控内容引用和 `turn/start` image content block。
7. Provider adapter 图片映射，先打通一个明确支持图片的 provider/model。
8. 用户消息附件展示、历史会话恢复和附件缺失状态。
9. 工具/MCP/浏览器媒体输出归一化。
10. smoke 和真机验证。

## 10. 验收标准

- 输入框可以添加和删除图片附件。
- 用户消息能显示图片缩略图。
- 当前模型不支持图片时，发送前提示原因。
- 当前模型支持图片时，turn input 能携带图片内容块。
- 当前模型状态能展示或返回解析后的输入/输出能力。
- OpenAI Compatible / 第三方中转在未声明能力时不会默认启用图片。
- Core 不再把所有用户输入强行压成纯字符串。
- App Server 协议兼容旧 `text` 输入。
- 历史会话恢复后附件卡片仍可见。
- 文件缺失不会导致历史消息渲染失败。
- 不把大 base64、token、密钥写入普通日志。
- `codex-oauth` 纯文本链路不回归。
- Desktop 文件/附件 P21 现有卡片不回归。
