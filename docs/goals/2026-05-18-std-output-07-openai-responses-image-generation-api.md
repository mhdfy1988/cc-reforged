# 2026-05-18 STD-OUTPUT-07 OpenAI Responses image_generation 真实 API 接入

## 背景

上一轮已经把 OpenAI 直接 Images API 和 Responses/Codex 风格的 `image_generation_call` 归一化到同一套 CCR 生成物模型。还缺的一步是：真实调用 Responses API 时，CCR 能主动请求 `image_generation` 工具，并把返回的 `image_generation_call.result` 接进这套落盘与展示链路。

## 官方接口对照

- OpenAI `image_generation` 工具指南：https://platform.openai.com/docs/guides/tools-image-generation/
- OpenAI Responses Create API：https://platform.openai.com/docs/api-reference/responses/create

第一版只使用官方稳定字段：

- 请求：`POST /responses`
- 请求体：`model`、`input`、`tools: [{ type: "image_generation" }]`
- 输出：`response.output[]` 中 `type === "image_generation_call"` 的项目
- 图片数据：`image_generation_call.result`

## 第一版目标

1. 新增 Responses 图片生成 adapter：
   - 构造 `POST /responses` 请求。
   - 支持 `size / quality / output_format` 透传到 `image_generation` 工具。
   - 使用 mock fetch 做 smoke，不依赖真实联网生成。
2. 接入 OpenAI provider：
   - 默认 `generateImage(...)` 仍走 Images API。
   - 当 `metadata.imageGenerationApi = "responses"` 或 `metadata.apiMode = "openai-responses"` 时，显式切到 Responses 生成路径。
   - Responses 路径默认使用主模型，例如 `gpt-5.5`，而不是图片专用模型默认值。
3. 保持数据一致性：
   - Responses 返回结果必须复用 `normalizeOpenAiImageGenerationCall(...)`。
   - Desktop / resume / safe raw 继续不能泄露大 base64。
   - 同一家 OpenAI provider 不拆出第二套生成物结构。

## 验收

- `smoke:generated-output-provider` 覆盖：
  - `/responses` 请求体包含 `image_generation` 工具。
  - `OpenAiResponsesImageGenerationAdapter` 能从 `image_generation_call.result` 落盘图片。
  - `OpenAiProvider.generateImage(...)` 可通过 metadata 显式路由到 Responses API。
  - safe raw / Desktop event 不包含 base64。
- `typecheck`、`build`、相关 smoke 和 `git diff --check` 通过。

## 当前状态

- 已完成：新增 Responses adapter、provider 路由和 smoke。

## 本轮完成

- 新增 `OpenAiResponsesImageGenerationAdapter`，支持构造 `POST /responses` + `tools: [{ type: "image_generation" }]`。
- 新增 `toOpenAiResponsesImageGenerationRequestBody(...)`，覆盖主模型、输入文本、`size / quality / output_format`。
- `OpenAiProvider.generateImage(...)` 支持通过 metadata 显式切换 Responses 生成路径，默认 Images API 路径保持不变。
- Responses 返回的 `image_generation_call.result` 继续复用 `normalizeOpenAiImageGenerationCall(...)`，生成物落盘、Desktop 展示和恢复轻量化口径不分裂。
- `smoke:generated-output-provider` 覆盖 Responses 请求体、图片落盘、safe raw 不泄露 base64，以及 provider 路由判断。

## 验证记录

- 已通过：`npm.cmd run typecheck`
- 已通过：`npm.cmd run build`
- 已通过：`npm.cmd run smoke:generated-output-provider`
- 已通过：`npm.cmd run smoke:provider-output-fixtures`
- 已通过：`npm.cmd run smoke:desktop-display-events`
- 已通过：`npm.cmd run smoke:llm-runtime`
