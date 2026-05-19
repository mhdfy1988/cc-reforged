# 2026-05-18 STD-OUTPUT-05 真实 provider 生成 API 接入

## 背景

`STD-OUTPUT-03` 已补模型生成物的标准内容块字段，`STD-OUTPUT-04` 已补生成物本地落盘、`savedPath` 展示和恢复轻量化。当前缺口是：真实 provider 返回的生成图片结果，如何进入这条标准链路。

第一版只做图片生成，优先覆盖 OpenAI / OpenAI-compatible 的 Images API 形态；音频、文件和 Responses 多轮 `image_generation` 工具结果留给后续阶段。

## 官方接口对照

- OpenAI Images API：[`POST /v1/images/generations`](https://platform.openai.com/docs/api-reference/images/create)，请求以 `model`、`prompt` 为核心字段。
- OpenAI 图像生成指南说明，Image API 可以用文本 prompt 生成图片；Responses API 更适合把图片生成作为对话或多步流程的一部分：https://platform.openai.com/docs/guides/image-generation
- `gpt-image-1` 用作第一版默认图片生成模型；兼容旧式或 OpenAI-compatible provider 时，CCR 可按需请求 `b64_json` 响应，方便本地落盘。OpenAI API reference 说明 GPT image models 默认返回 `b64_json`，而 `dall-e-2` / `dall-e-3` 需要显式 `response_format=b64_json`。
- CCR 不让 Desktop 或恢复响应直接消费 provider 原始 `b64_json` / data URL；原始结果必须先变成 `CcrImageContentBlock` 和 `CcrGeneratedArtifactSnapshot`。

## 第一版目标

1. 补标准图片生成请求 / 响应类型：
   - `LlmImageGenerationRequest`
   - `LlmImageGenerationResponse`
   - provider 可选入口 `generateImage(...)`
2. 补 OpenAI 图片生成适配器：
   - 构造 `/images/generations` 请求。
   - 解析 `b64_json` / `url` 输出。
   - 对 `b64_json` 输出直接调用 `persistGeneratedArtifactFromBase64(...)`。
3. 补 OpenAI provider 接入：
   - `OpenAiProvider.generate(...)` 继续复用 OpenAI Chat adapter。
   - `OpenAiProvider.generateImage(...)` 接入图片生成 adapter。
   - 默认读取 `CCR_OPENAI_API_KEY` / `OPENAI_API_KEY`。
4. 补 smoke：
   - 用 mock `fetch` 返回 provider 图片生成响应。
   - 断言生成图片落盘到 `generated_outputs/<sessionId>/<outputId>.png`。
   - 断言 Desktop 展示事件只携带 `savedPath` / 生成物快照，不泄露 base64。
   - 断言 resume 清理仍能移除大 payload。

## 边界

- 本阶段不调用真实网络生成，避免 smoke 依赖外部额度和账号状态。
- 本阶段不做图片编辑、多图输入、音频生成和文件生成。
- 本阶段不把 provider 原始响应结构传入 Desktop UI；UI 继续只认 CCR 标准内容块和展示事件。
- 真实安全扫描先保留 `safety: needs_review`，后续再补内容审核或用户确认策略。

## 验证记录

- 已通过：`npm.cmd run typecheck`
- 已通过：`npm.cmd run build`
- 已通过：`npm.cmd run smoke:generated-output-provider`
- 已通过：`npm.cmd run smoke:desktop-display-events`
- 已通过：`npm.cmd run smoke:provider-output-fixtures`
- 已通过：`npm.cmd run smoke:llm-config`
- 已通过：`npm.cmd run smoke:model-capabilities`
- 已通过：`npm.cmd run smoke:llm-runtime`
- 已通过：`git diff --check`

## 本轮完成

- 新增 `LlmImageGenerationRequest` / `LlmImageGenerationResponse`，provider 可选实现 `generateImage(...)`。
- 新增 `OpenAiImageGenerationAdapter`，负责请求 `/images/generations`、解析 `b64_json` / `url`，并把 base64 图片保存为 CCR 本地生成物。
- 新增 `OpenAiProvider`，默认注册到 LLM runtime，支持 OpenAI Chat 文本入口和 OpenAI Images 图片生成入口。
- 新增 `smoke:generated-output-provider`，用 mock provider 响应验证落盘、Desktop 展示和 resume 清 payload。
- 更新 provider 输出 fixture，加入 OpenAI 图片生成输出样例，验证 UI 不直接消费 provider 原始结构。

## 遗留边界

- 真实联网生成未进入自动 smoke；需要账号、额度和 API key 时再做手动 probe。
- Responses API 多轮 `image_generation` 工具事件、图片编辑、音频生成、文件生成仍留给后续阶段。
- `safety` 目前默认 `needs_review`，还没有接内容审核或用户确认策略。
