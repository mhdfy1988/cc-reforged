# 2026-05-18 STD-OUTPUT-09 会话流生成图片输出闭环

## 背景

STD-OUTPUT-05 到 STD-OUTPUT-08 已经完成 provider 图片生成、生成物落盘、Desktop 展示快照、历史恢复轻量化和 MiniMax 接入。

当前缺口是：这些能力还主要停留在 provider smoke 和展示 fixture 里，普通会话 turn 执行链路还没有把“模型生成图片”作为一等输出事件传给 Desktop。用户在聊天里让模型生成图片时，结果应进入同一套 `CcrContentBlock` / `generatedArtifact` / `DisplayEvent` 链路，而不是停在 provider 专项 API 或测试脚本里。

## 第一版目标

1. 建立会话流生成图片输出链路：
   - 读真实 turn/session 执行链路，确认 provider `generateImage(...)` 结果目前停在哪一层。
   - 将生成图片结果接入普通会话事件流。
   - App Server 输出标准 `contentBlocks` 和 `generatedArtifact` 引用。
2. 保持生成物治理不变：
   - 图片落盘到 `generated_outputs/<sessionId>/<outputId>`。
   - Desktop 优先展示 `savedPath`。
   - 历史恢复和安全 raw 不返回大 base64。
3. Desktop 展示与恢复验证：
   - 聊天区能展示普通会话产生的模型生成图片卡。
   - 恢复 payload 只带轻量引用。
   - smoke 验证 UI 不直接消费 provider 原始结构。
4. 文档收口：
   - 补 OpenAI provider 长期接入文档。
   - MiniMax / OpenAI 文档都说明图片生成如何进入普通会话流。

## 非目标

- 不做真实联网图片生成 E2E，第一版继续用 fixture/mock。
- 不做图生图、编辑图片、音频生成或文件生成。
- 不把 provider raw response 直接传给 Desktop。
- 不在 UI 里实现新的复杂图片编辑工作台。

## 验收

- `app-server` 普通 turn 事件流可携带模型生成图片标准内容块。
- Desktop 展示事件中有 `generatedArtifact` / `savedPath`，没有 provider raw `b64_json`、`image_base64` 或大 base64。
- thread resume 不回放大 base64。
- 文本模型回放时保留生成调用 ID，但不把图片 payload 再塞回模型。
- 新增 smoke 覆盖会话流、Desktop 展示和恢复轻量化。

## 当前状态

- 已完成第一版：普通会话流已能通过 `options.imageGeneration` 进入图片生成 runner，并输出标准 `contentBlocks` / `generatedArtifact`。

## 实现记录

真实链路确认：

```text
turn/start
-> normalizeTurnStartInputForCurrentModel(...)
-> CoreSessionService.startTurn(...)
-> shouldRunCoreImageGenerationTurn(...)
-> runCoreImageGenerationTurn(...)
-> LlmRuntime.generateImage(...)
-> provider.generateImage(...)
-> assistant item_completed(contentBlocks)
-> Desktop DisplayEvent
```

本轮完成：

- `TurnStartParams.options.imageGeneration`：新增图片生成选项，支持 prompt/model/size/quality/outputFormat/responseFormat/n/metadata。
- `CoreSessionService`：运行时先检查 `metadata.imageGeneration`，命中后切到 `runCoreImageGenerationTurn(...)`，普通 query runner 保持不变。
- `runCoreImageGenerationTurn(...)`：调用统一 `LlmRuntime.generateImage(...)`，把 provider 归一化输出作为 assistant message 和 `item_completed` 事件发出。
- `coreQueryTurnRunner`：对普通 assistant 输出中的 `image/file/audio/video` 内容块做保真透传，避免降级成 `{ type, value }`。
- Desktop 主进程：支持 `/image ...`、`/imagine ...`、`生成图片：...` 等轻量入口，并把它们转成 `options.imageGeneration`。
- `smoke:session-generated-image-flow`：新增会话流 smoke，覆盖图片生成 metadata、Core 路由、assistant 图片 item、Desktop `ModelOutput` 附件快照和 resume 去 base64。

## 文档记录

- OpenAI 长期接入文档：[openai.md](../architecture/provider-integrations/openai.md)
- MiniMax 长期接入文档：[minimax.md](../architecture/provider-integrations/minimax.md)

## 验证记录

已通过：

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:session-generated-image-flow
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:provider-output-fixtures
npm.cmd run smoke:turn-input
npm.cmd run smoke:generated-output-provider
git diff --check
```

说明：`git diff --check` 只提示两个既有 Markdown 文件的 CRLF/LF 归一化风险，没有 whitespace error。

## 后续边界

- 真实联网图片生成 E2E 仍不进入默认 smoke，后续可用单独 probe 或人工验证。
- 图生图、图片编辑、音频生成和文件生成仍属于后续生成型多模态输出专项。
