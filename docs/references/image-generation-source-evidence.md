# 生图工具链源码证据索引

本索引用来固定本轮生图工具改造参考过的关键源码证据，后续继续改协议、UI 或 provider 时先读这里，不必重复翻完整参考仓库。

## Codex Rust 参考

- `D:\learn_code\codex-rust-v0.131.0\codex-rs\core\src\tools\hosted_spec.rs`
  - `create_image_generation_tool(output_format)` 返回 `ToolSpec::ImageGeneration`。
  - 结论：Codex 把生图暴露成模型可见 hosted tool，而不是让模型自己猜 shell、文件写入或 SVG。

- `D:\learn_code\codex-rust-v0.131.0\codex-rs\core\src\tools\spec_plan.rs`
  - `hosted_model_tool_specs(config)` 在 `config.image_gen_tool` 打开时加入 image generation tool。
  - 结论：生图能力是否可见由工具规划层决定，模型请求入口和 UI 展示入口解耦。

- `D:\learn_code\codex-rust-v0.131.0\codex-rs\core\src\event_mapping.rs`
  - `ResponseItem::ImageGenerationCall` 被映射成 `TurnItem::ImageGeneration`，包含 `id/status/revised_prompt/result/saved_path`。
  - 结论：模型输出的图片调用是结构化 item，不是普通 assistant 文本。

- `D:\learn_code\codex-rust-v0.131.0\codex-rs\core\src\stream_events_utils.rs`
  - `save_image_generation_result()` 将 base64 图片按 `codex_home/generated_images/<session>/<call_id>.png` 持久化。
  - `completed_item_defers_mailbox_delivery_to_next_turn()` 对 `ImageGenerationCall` 单独处理。
  - 结论：生图结果需要持久化路径和事件语义，不能只靠聊天文本描述。

## CCR 当前落点

- 模型可见入口：`src/tools/GenerateImageTool/GenerateImageTool.ts`
- provider 统一调用：`src/services/llm/llmRuntime.ts` 的 `generateImage()`
- provider 输出标准化：`src/services/llm/protocols/generatedImageOutputAdapter.ts`
- 内容块协议：`src/types/contentBlocks.ts` 的 `CcrImageContentBlock` 和 `CcrGeneratedArtifactSnapshot`
- Desktop 附件抽取：`apps/desktop/src/renderer/src/domain/fileEvents.ts`

## 本轮实现原则

1. 生图是模型可见工具能力，不再依赖自然语言意图路由作为唯一入口。
2. 工具结果发回模型时保持文本摘要，避免把 CCR 本地图片块误塞进上游 provider 协议。
3. App Server / Desktop 事件保留结构化图片输出，UI 复用现有附件缩略图和预览链路。
4. GLM、OpenAI、Codex OAuth 等 provider 继续共用 `runtime.generateImage()` 和 `CcrImageContentBlock`，不分叉两套展示协议。
