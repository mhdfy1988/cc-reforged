# CCR 多模态输入输出设计

## 1. 目标

这份文档单独沉淀 CCR 的多模态输入/输出、附件上传与预览能力。

它只负责“消息内容怎么表达、附件怎么进入会话、不同 provider 怎么接收这些内容、Desktop 怎么展示和恢复”，不负责多供应商配置、模型档案、密钥管理和供应商切换。多供应商部分单独见 [CCR 多供应商模型与协议接入设计](./multi-provider-model-management-design.md)。

第一版目标是：

- Desktop 输入框支持选择图片和文件。
- 聊天区能展示附件草稿、已发送附件和模型返回的媒体/文件引用。
- Core user message 从纯文本升级为统一内容块。
- App Server 协议能表达文本、图片、文件引用和附件元数据。
- LLM Runtime 根据当前 provider/model 能力选择正确的协议映射。
- 不支持多模态的模型在发送前给明确提示，而不是请求失败后才暴露协议错误。

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
type ModelCapabilities = {
  textInput: boolean
  imageInput: boolean
  fileInput: boolean
  toolUse: boolean
  streaming: boolean
  reasoning: boolean
  maxImageBytes?: number
  supportedImageMimeTypes?: string[]
  supportedFileMimeTypes?: string[]
}
```

多模态专项只消费这些能力，不自己决定哪个 provider 可用。

示例：

```text
当前模型：Codex OAuth / gpt-5.5
能力：text + tools + imageInput

用户发送：文本 + PNG
多模态层：允许发送，生成 text/image content blocks
Provider adapter：把 blocks 转成 Codex/OpenAI 对应请求格式
```

再例如：

```text
当前模型：OpenAI Compatible / deepseek-chat
能力：text + tools，imageInput=false

用户发送：文本 + PNG
多模态层：发送前拦截，提示“当前模型不支持图片输入”
```

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
    "text": "分析这张图"
  }
}
```

扩展为：

```json
{
  "input": {
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

为了兼容旧客户端，`text` 字段可以继续保留，Core 内部统一归一化为 `content`。

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

### 6.3 Anthropic Messages

映射方向：

```text
CCR text  -> text block
CCR image -> image block
CCR file  -> document block 或 text fallback
```

第一版可以只保留 adapter 扩展点，不强制同时实现所有 Anthropic 文件形态。

### 6.4 Codex OAuth

Codex OAuth 走当前内置 LLM Runtime，需要确认它实际支持的输入格式。

第一版策略：

- 如果 runtime 能接收图片内容块，就走原生图片映射。
- 如果不能，Desktop 发送前提示当前 provider 暂不支持图片。
- 不把图片路径直接塞给模型冒充多模态能力。

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

### 7.2 聊天消息

用户消息卡展示：

- 文本内容。
- 图片缩略图。
- 文件附件卡片。

助手消息卡展示：

- 文本。
- 图片/文件引用。
- 工具生成的文件卡继续沿用 P21 的 `FileSnapshot` / `AttachmentSnapshot`。

### 7.3 历史恢复

恢复历史会话时：

- 能看到当时发送过哪些附件。
- 如果本地文件还在，可继续预览。
- 如果文件不存在，展示“本地文件已不存在”的状态。
- 不因为附件缺失导致整条历史消息不可渲染。

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

1. 盘点现有 P21 附件/文件快照能力。
2. 定义 App Server `input.content` 协议，保留旧 `input.text` 兼容。
3. Core user message 归一化为内容块。
4. Desktop 输入框草稿附件和图片预览。
5. 发送前能力校验。
6. Provider adapter 图片映射。
7. 历史会话恢复和附件缺失状态。
8. smoke 和真机验证。

## 10. 验收标准

- 输入框可以添加和删除图片附件。
- 用户消息能显示图片缩略图。
- 当前模型不支持图片时，发送前提示原因。
- 当前模型支持图片时，turn input 能携带图片内容块。
- Core 不再把所有用户输入强行压成纯字符串。
- App Server 协议兼容旧 `text` 输入。
- 历史会话恢复后附件卡片仍可见。
- 文件缺失不会导致历史消息渲染失败。
- 不把大 base64、token、密钥写入普通日志。
- `codex-oauth` 纯文本链路不回归。
- Desktop 文件/附件 P21 现有卡片不回归。
