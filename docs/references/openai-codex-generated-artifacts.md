# OpenAI Codex 生成物源码对照索引

参考仓库：`D:\C_Project\codex-openai`，来源为 `openai/codex`，本次核对 HEAD 为 `19f0d196d11dcf31e02a4d022d099e6d3bcfad6e`。

用途：给 CCR 后续生成型多模态输出、历史恢复和 Desktop 展示设计复用；其他会话优先读这份索引，不必重新通读 Codex 源码。

## 关键源码索引

- 生成图片工具注入：`codex-rs/core/src/tools/spec.rs`
  - `config.image_gen_tool` 为真时注入 `ToolSpec::ImageGeneration { output_format: "png" }`。
- hosted tool 序列化：`codex-rs/tools/src/tool_spec.rs`
  - `ToolSpec::ImageGeneration` 序列化成 Responses tool：`{ "type": "image_generation", "output_format": "png" }`。
- 生成物协议项：`codex-rs/protocol/src/models.rs`
  - Responses `image_generation_call` 解析为 `ImageGenerationCall { id, status, revised_prompt, result }`；`result` 是生成图片 payload。
- 生成图片落盘：`codex-rs/core/src/stream_events_utils.rs`
  - `GENERATED_IMAGE_ARTIFACTS_DIR = "generated_images"`；`ImageGenerationCall.result` 会被 base64 解码，保存到 `<codex_home>/generated_images/<session_id>/<call_id>.png`，并写入 `saved_path`。
- App Server 历史线程项：`codex-rs/app-server-protocol/src/protocol/thread_history.rs`、`codex-rs/app-server-protocol/src/protocol/v2/item.rs`
  - `ImageGenerationBegin` 先建空项，`ImageGenerationEnd` 更新 `status/revised_prompt/result/saved_path`，v2 `ThreadItem::ImageGeneration` 继续保留 `saved_path`。
- Desktop/TUI 展示：`codex-rs/tui/src/history_cell.rs`
  - 展示口径是 `Generated Image:` + `Saved to:`，优先让用户看到保存路径，而不是原始 base64。
- 本地图片进入模型：`codex-rs/core/src/tools/handlers/view_image.rs`
  - `view_image` 读取本地路径，事件保存 `ImageViewItem.path`；只有传给模型时才转成 `InputImage { image_url: data URL, detail }`。
- app-server 恢复轻量化：`codex-rs/app-server/src/request_processors/thread_resume_redaction.rs`
  - 注释说明 `thread/resume` 可能包含大 MCP 和 image-generation payload；远程恢复响应会移除 `ImageGeneration` 项，避免大内容直接回灌。
- 模型切换行为：`codex-rs/core/tests/suite/model_switching.rs`
  - 图像模型回放时保留 `image_generation_call.result`；切到文本模型时保留原 `image_generation_call` 和 id，但清空 `result`，不改写成普通 `input_image`。

## 对 CCR 的直接结论

- `STD-OUTPUT-03` 的 `ModelOutput/generated` 元数据方向正确，但下一阶段要补“生成物落盘 + savedPath + 恢复轻量化”专项。
- Codex OAuth 图片生成应走 Responses hosted tool `image_generation`，不是 OpenAI API Key 的 `/images/generations`，也不是让 `gpt-5.5` 直接作为图片模型输出。
- 生成图片、音频、文件不要只依赖 `previewDataUrl` 或 provider 临时 URL；CCR 应提供本地持久化路径，例如 `.ccr/generated_outputs/<session_id>/<output_id>.<ext>`。
- Desktop 展示事件优先携带轻量引用和安全元数据；大 base64 只允许在模型输入边界或必要预览边界短暂出现，不进入恢复响应主路径。
