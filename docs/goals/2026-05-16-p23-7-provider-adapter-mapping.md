# Goal: P23-7 Provider adapter 多模态映射

## 目标

让 CCR 已经归一化的图片内容块真正进入内建 LLM Runtime 的 provider 请求，而不是只停留在 UI、App Server 校验和 Core 事件展示层。

本阶段第一版只做图片输入：

```text
Core image content block
-> LlmImagePart
-> provider adapter 请求格式
```

## 为什么先做这个

MM-05 已经让图片附件进入 `turn/start.input.content`，MM-06 已经让小文本文件转成安全的 `text` block。现在真正缺的一环是 provider adapter：如果这里不接上，模型能力目录和 UI 都会说“支持图片”，但实际请求仍只带文本。

Provider 层同时也是最需要谨慎的地方。图片 base64 只能出现在实际发给模型的请求体里，不能写进普通历史、日志或转录文件。

## 第一版范围

1. 扩展内建 LLM Runtime 的内容部件类型，新增图片输入部件。
2. `claudeApiAdapter` 将用户消息里的 CCR `image` block 转为 `LlmImagePart`。
3. OpenAI Chat / OpenAI Compatible adapter 将图片部件映射为 `image_url` content part。
4. Anthropic Messages adapter 将图片部件映射为 `image` content block。
5. 本地文件图片在 adapter 发请求前读取并 base64 编码。
6. URL 图片保持 URL 形式传给支持 URL source 的 provider。
7. 请求错误诊断只记录消息数量、图片数量和文本长度，不输出 base64 或本地绝对路径。
8. 补 smoke，验证图片映射不需要真实联网。

## 明确不做

- 不做 PDF / Office / 任意文件的 provider 原生 `file` input。
- 不做音频输入。
- 不做模型输出图片、音频或文件的归一化展示。
- 不做发送后用户消息附件卡片和历史恢复。
- 不把 base64 写入 Core 历史、转录、运行日志或 UI 事件。
- 不重构 provider runtime 总架构。

这些留给 MM-08 和后续文件增强。

## 第一版限制

- 图片大小和 mime type 仍以前面模型能力校验为第一道门。
- 本地文件读取失败时，provider adapter 直接报错，由现有错误通道返回给用户。
- Native Anthropic 原始 `query` 路径暂不强行改造；本阶段优先保证内建 LLM Runtime provider。
- OpenAI Chat 使用 data URL 承载本地图片，URL 图片保持原 URL。

## 验收标准

- `content` 用户消息里的图片 block 能转换为 `LlmImagePart`。
- OpenAI Chat 请求体中用户消息 `content` 是 text / image_url parts 数组。
- Anthropic Messages 请求体中用户消息 `content` 包含 image block。
- 请求诊断不会泄露 base64 或本地图片路径。
- 纯文本、工具调用、thinking 和已有流式输出不回归。
- `typecheck`、`build`、相关 smoke 通过。

## 建议验证命令

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run smoke:llm-claude-adapter
npm.cmd run smoke:openai-chat-protocol
npm.cmd run smoke:multimodal-provider-mapping
git diff --check
```

## 完成记录

- 已新增内建 LLM Runtime 图片内容部件 `LlmImagePart`。
- `claudeApiAdapter` 已能把 CCR 用户消息里的 `image` block 转成运行时图片部件。
- OpenAI Chat / Compatible adapter 已将图片映射为用户消息 `content` 数组中的 `image_url` part。
- Anthropic Messages adapter 已将图片映射为用户消息 `content` 数组中的 `image` block。
- 本地文件图片只在 provider adapter 发请求前读取并编码，Core 历史和普通事件仍不保存 base64。
- OpenAI provider 请求失败时的 diagnostics 只包含计数和长度摘要，不输出 base64 或本地路径。
- 原生 Anthropic 旧 `query` 路径本阶段仍走文本 fallback，避免旧路径误发 CCR 自定义 file source。
- 新增 `smoke:multimodal-provider-mapping`，离线覆盖 Core 内容块转换、OpenAI 请求体、Anthropic 请求体和错误诊断脱敏。
- 验证通过：`typecheck`、`build`、`smoke:multimodal-provider-mapping`、`smoke:llm-claude-adapter`、`smoke:openai-chat-protocol`、`smoke:turn-input`、`smoke:app-server`、`desktop:build`。
