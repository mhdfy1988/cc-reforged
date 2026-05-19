# 2026-05-18 STD-OUTPUT-08 通用图片生成归一化与 MiniMax 接入

## 背景

OpenAI 图片生成已经完成三步：

- [STD-OUTPUT-05 真实 provider 生成 API 接入](2026-05-18-std-output-05-real-provider-generation-api.md)：接入 OpenAI Images API。
- [STD-OUTPUT-06 OpenAI 生成路径数据一致性](2026-05-18-std-output-06-openai-generation-consistency.md)：让 Images API 与 Responses/Codex `image_generation_call` 输出同形。
- [STD-OUTPUT-07 OpenAI Responses image_generation 真实 API 接入](2026-05-18-std-output-07-openai-responses-image-generation-api.md)：接入 Responses `image_generation` 工具请求。

但当前共享归一化入口仍叫 `normalizeOpenAiGeneratedImageOutputs(...)`。它做的事情其实不是 OpenAI 专属，而是：

```text
provider 原始图片结果
-> 统一中间项（base64Data / url / revisedPrompt / outputId）
-> 落盘或轻量 URL 引用
-> CcrImageContentBlock + CcrGeneratedArtifactSnapshot
```

MiniMax 图片生成接入前，必须先把这层抽成 provider-neutral，避免后续多模态输出继续带着 OpenAI 命名负担。

## 官方接口对照

MiniMax 图片生成不是当前 `MiniMaxProvider` 文本聊天使用的 Anthropic-compatible 协议，而是原生图片接口：

- 国际版文生图：https://platform.minimax.io/docs/api-reference/image-generation-t2i
- 国内版文生图：https://platform.minimaxi.com/docs/api-reference/image-generation-t2i
- 图片生成指南：https://platform.minimax.io/docs/guides/image-generation

第一版只做文生图（Text-to-Image）：

- 国际版默认地址：`https://api.minimax.io/v1/image_generation`
- 国内版默认地址：`https://api.minimaxi.com/v1/image_generation`
- 鉴权：`Authorization: Bearer <api_key>`
- 请求关键字段：`model`、`prompt`、`aspect_ratio`、`width`、`height`、`response_format`、`seed`、`n`、`prompt_optimizer`
- 响应关键字段：
  - `data.image_base64[]`
  - `data.image_urls[]`
  - `metadata.failed_count / success_count`
  - `base_resp.status_code / status_msg`

## 第一版目标

1. 通用图片生成归一化层：
   - 新增 `normalizeGeneratedImageOutputs(...)`。
   - 输入为 provider-neutral 的 `GeneratedImageOutputItem[]`。
   - 输出仍为 `LlmImageGenerationResponse`。
   - OpenAI 现有 adapter 改为调用通用函数；保留 OpenAI 专属函数只做 raw response 映射。
2. MiniMax 图片生成 adapter：
   - 新增 `MiniMaxImageGenerationAdapter`。
   - 支持 `base64` 结果落盘和 `url` 结果轻量引用。
   - `responseFormat` 映射：
     - CCR `b64_json` -> MiniMax `base64`
     - CCR `url` -> MiniMax `url`
     - 默认优先 `base64`，方便进入本地生成物管理。
   - `size` / metadata 映射：
     - 支持 `metadata.aspectRatio`。
     - 对常见 `1024x1024 / 1536x1024 / 1024x1536` 等尺寸映射为 MiniMax `aspect_ratio`。
     - 支持 `metadata.width / height / seed / promptOptimizer / aigcWatermark`。
3. MiniMax provider 接入：
   - `minimax` / `minimax-cn` 都实现 `generateImage(...)`。
   - 文本聊天继续走 Anthropic-compatible adapter。
   - 图片生成走 native image endpoint，不复用文本 baseUrl 原样请求。
4. 验证：
   - `smoke:generated-output-provider` 覆盖 MiniMax 国际版和国内版。
   - provider fixture 补 MiniMax 生成图片展示样例。
   - safe raw / Desktop event / resume payload 不泄露 base64。

## 不变式

- CCR 标准展示层不消费 MiniMax raw response。
- MiniMax 和 OpenAI 最终都输出同形 `CcrImageContentBlock` / `CcrGeneratedArtifactSnapshot`。
- 生成图片默认进入 `generated_outputs/<sessionId>/<outputId>`。
- URL 响应只作为临时轻量引用；文档里必须提示 MiniMax URL 有有效期。
- 第一版不做图生图、subject reference、style、水印完整 UI、真实联网生成。

## 当前状态

- 已完成第一版：已完成文档、通用归一化抽离、MiniMax adapter/provider 接入、smoke/fixture 验证。

## 本轮完成

- 新增 `generatedImageOutputAdapter.ts`，提供 provider-neutral 的 `normalizeGeneratedImageOutputs(...)`。
- OpenAI Images API 和 Responses `image_generation_call` 继续通过 OpenAI 专属映射函数进入通用归一化层。
- 新增 `MiniMaxImageGenerationAdapter`，支持 MiniMax 原生 `POST /v1/image_generation`。
- `MiniMaxProvider` / `MiniMaxChinaProvider` 实现 `generateImage(...)`，文本聊天仍走 Anthropic-compatible adapter。
- MiniMax 默认图片模型为 `image-01`，模型目录新增 `image-01` / `image-01-live` 图片输出能力。
- provider fixture 新增 `provider-minimax-image-generation`，防止 Desktop 直接消费 MiniMax raw `image_base64`。
- 更新 MiniMax provider 接入文档，明确文本聊天和图片生成是两条协议入口。

## 验证记录

- 已通过：`npm.cmd run typecheck`
- 已通过：`npm.cmd run build`
- 已通过：`npm.cmd run smoke:generated-output-provider`
- 已通过：`npm.cmd run smoke:provider-output-fixtures`
- 已通过：`npm.cmd run smoke:desktop-display-events`
- 已通过：`npm.cmd run smoke:model-capabilities`
- 已通过：`npm.cmd run smoke:llm-config`
- 已通过：`npm.cmd run smoke:llm-runtime`
