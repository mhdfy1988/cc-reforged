# Goal: STD-OUTPUT-04 Codex 对齐的生成物落盘与恢复

## 目标

把 `STD-OUTPUT-03` 预留的模型生成物元数据推进成可用闭环：生成图片、文件、音频等输出不能只停在 `previewDataUrl` 或 provider 临时引用里，而要有本地保存路径、轻量展示快照和恢复时的大 payload 清理策略。

本阶段直接对齐已核验的 Codex 源码策略：生成图片落到本地目录，协议项携带 `saved_path`，Desktop/TUI 展示保存路径，恢复响应避免把大 base64 重新灌回客户端，模型切换回放时由模型能力决定是否保留 result。

## 第一版范围

本次优先做：

- 新增 `GeneratedArtifactSnapshot` 或等价结构，字段覆盖 `id / type / status / savedPath / mimeType / provider / model / outputId / prompt / revisedPrompt / lifecycle / safety`。
- 新增生成物落盘工具，把 base64 图片保存到 `.ccr/generated_outputs/<sessionId>/<outputId>.png` 这类本地目录，并返回 `savedPath`。
- Desktop 附件快照与卡片展示优先使用 `savedPath`，提供打开、定位、另存为、复制路径动作。
- 新增恢复轻量化工具，清理 `previewDataUrl` / data URL / image-generation result 这类大 payload。
- 新增模型回放策略：文本模型回放时清空 image result，但保留 image generation call id。

本次不做：

- 不接真实 OpenAI / Anthropic / Gemini 图片生成 API。
- 不做完整媒体库、下载队列和安全扫描服务。
- 不做音频/视频播放器。
- 不把原始 base64 作为 Desktop 历史恢复主路径。

## 验收标准

- [x] 生成图片可从 base64 保存到本地 `generated_outputs` 目录。
- [x] 标准内容块和 Desktop 附件快照能携带 `savedPath` / `generatedArtifact`。
- [x] Desktop 展示生成物时优先展示保存路径，并支持打开、定位、另存、复制路径。
- [x] thread resume 清理大 base64，不把 `previewDataUrl` 或 image result 直接回灌。
- [x] 文本模型回放 image generation call 时保留 call id、清空 result。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:provider-output-fixtures
npm.cmd run desktop:build
git diff --check
```

## 执行结果

状态：已完成第一版。

已完成：

- 新增 `CcrGeneratedArtifactSnapshot`，覆盖 `id/type/status/savedPath/mimeType/provider/model/outputId/prompt/revisedPrompt/lifecycle/safety` 等字段。
- 新增 `src/utils/generatedArtifacts.ts`：
  - `persistGeneratedArtifactFromBase64`：把 base64 生成物保存到 `generated_outputs/<sessionId>/<outputId>.<ext>`。
  - `sanitizeGeneratedArtifactsForResume`：清理恢复响应中的 `previewDataUrl`、大 inline data 和 image generation result。
  - `prepareGeneratedImageCallForModelReplay`：文本模型回放时保留 call id、清空 result。
  - `shouldIncludeGeneratedImageResultForReplay`：按模型输出能力判断是否保留生成图片 result。
- Desktop `AttachmentSnapshot` 新增 `savedPath/prompt/revisedPrompt/generatedArtifact`，并优先把 `savedPath` 作为展示和动作路径。
- Desktop 生成物附件卡片新增打开、定位、另存、复制路径动作；图片预览可以从本地 `savedPath` 读取。
- `smoke:desktop-display-events` 覆盖生成图片落盘、Desktop `savedPath` 展示、恢复清 payload、文本模型回放清 result。

已完成验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:desktop-display-events`
- `npm.cmd run smoke:provider-output-fixtures`
- `npm.cmd run desktop:build`
- `git diff --check`

后续保留：

- 真实 provider 图片 / 音频 / 文件生成 API 接入。
- 完整安全扫描、媒体库、下载队列和跨会话清理策略。
