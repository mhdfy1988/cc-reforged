# 2026-05-18 STD-OUTPUT-06 OpenAI 生成路径数据一致性

## 背景

用户在 Codex 中选择 `gpt-5.5` 也能生成图片，这不是把 `gpt-5.5` 直接作为 Images API 的图片模型，而是主模型触发 `image_generation` 工具后返回 `image_generation_call` 结果。

因此 CCR 不能把下面两条 OpenAI 路径做成两套展示模型：

- 直接 Image API：`/images/generations`
- Responses / Codex 风格：`responses.output[].image_generation_call`

它们都来自 OpenAI 生成图片能力，落到 Desktop 和历史恢复时应该是同一套 CCR 生成物结构。

## 官方接口对照

- OpenAI 图像生成指南：https://platform.openai.com/docs/guides/image-generation
- OpenAI `image_generation` 工具指南：https://platform.openai.com/docs/guides/tools-image-generation/
- OpenAI Images API reference：https://platform.openai.com/docs/api-reference/images/create

## 第一版目标

1. 抽共享归一化入口：
   - `normalizeOpenAiGeneratedImageOutputs(...)`
   - 输入统一为 `base64Data/url/revisedPrompt/outputId`
   - 输出统一为 `LlmImageGenerationResponse`
2. 保留两条 provider 输入：
   - `normalizeOpenAiImageGenerationResponse(...)`：Image API 原始响应。
   - `normalizeOpenAiImageGenerationCall(...)`：Responses/Codex `image_generation_call`。
3. 数据一致性不变式：
   - `provider` 统一为 `openai` 或 OpenAI-compatible provider id。
   - `origin` 统一为 `model_output`。
   - `lifecycle` 统一为 `persisted`，除非只有临时 URL。
   - `safety` 统一为 `needs_review`。
   - `generatedArtifact.status` 统一为 `saved`。
   - 大 base64 不进入 Desktop event、resume payload 或 safe raw。
4. 模型字段规则：
   - 直接 Image API：`model` 是图片生成模型，例如 `gpt-image-1`。
   - Responses/Codex 工具路径：`model` 保留用户选择的主模型，例如 `gpt-5.5`；底层图片模型如后续可见，再放到扩展元数据，不改当前主展示字段。

## 验证记录

- 已通过：`npm.cmd run typecheck`
- 已通过：`npm.cmd run build`
- 已通过：`npm.cmd run smoke:generated-output-provider`
- 已通过：`npm.cmd run smoke:provider-output-fixtures`
- 已通过：`npm.cmd run smoke:desktop-display-events`
- 已通过：`git diff --check`

## 本轮完成

- `normalizeOpenAiImageGenerationResponse(...)` 不再自己组装展示块，而是调用共享 `normalizeOpenAiGeneratedImageOutputs(...)`。
- 新增 `normalizeOpenAiImageGenerationCall(...)`，适配 Responses/Codex `image_generation_call` 的 `id/call_id/result/revised_prompt`。
- `smoke:generated-output-provider` 同时验证：
  - `gpt-image-1` 直接 Image API 响应。
  - `gpt-5.5` 主模型触发的 `image_generation_call`。
  - 两条路径输出同形 `origin/lifecycle/safety/provider/mime/source/generatedArtifact`。
- provider 输出 fixture 新增 `provider-openai-responses-image-generation-call`，防止 UI 直接消费 `image_generation_call.result` 或 base64。

## 遗留边界

- 当前只补归一化入口和 smoke，还没有把真实 Responses API 调用链接入 `OpenAiProvider.generate(...)`。
- Codex OAuth provider 如果上游 SDK 后续直接暴露 `image_generation_call`，应优先调用本轮新增的共享归一化入口，不要再造一套结构。
