# Goal: P23-5 图片输入最小闭环与 main/preload 安全读取

## 目标

让 Desktop 中已选择的图片附件，在发送时经过 main/preload 安全读取与校验，转换为 App Server `turn/start` 的 `image` content block，并进入 Core user message。

本阶段的闭环范围是：

```text
Desktop Composer
-> main/preload 安全读取与图片元数据校验
-> turn/start input.content
-> App Server 能力校验
-> CoreTurn.input.content
```

Provider adapter 的真实 OpenAI / Anthropic 图片请求格式映射不在本阶段完成，继续留给 MM-07。

## 为什么先做这个

MM-04 已经能让用户看见附件草稿和模型能力提示，但附件仍然不会随消息进入 `turn/start`。如果直接做 provider 映射，会把 UI 队列、文件读取、安全边界、协议字段和 provider 格式混在一起。

先把图片安全地送进 CCR 自己的内容块协议，可以让后续 provider adapter 只处理已经通过校验的内容块。

## 第一版范围

1. Composer 继续复用现有文件选择入口。
2. 图片附件由 Desktop main 侧完成：
   - 路径获取和解析。
   - 文件读取可用性验证。
   - 图片 mime type 校验。
   - 图片大小限制。
   - 缩略图或预览数据生成。
3. Renderer 只持有附件元数据、预览图和由 main 确认过的安全来源，不直接读取 Node 文件系统。
4. 发送时把可发送图片转成 `turn/start` content block：
   - `type: "image"`
   - `attachmentId`
   - `displayName`
   - `mimeType`
   - `sizeBytes`
   - `source`
5. 纯文本发送继续兼容旧 `input.type = "text"`。
6. 不支持图片的模型仍由 App Server 返回稳定 `invalid_params`，不会创建 turn。
7. 图片 base64 不写入普通日志；日志和 turn 元数据只保留文件名、大小、mime type、数量和能力来源。

## 明确不做

- 不做 OpenAI / Anthropic provider adapter 的真实图片请求映射。
- 不把图片全文 base64 放进 App Server 日志。
- 不做 PDF、Office、音频、视频。
- 不做发送后用户消息附件卡片和历史恢复。
- 不做复杂图片编辑、裁剪或多尺寸缓存策略。

## 验收标准

- 选择 PNG / JPEG / WEBP / GIF 后，Composer 能显示图片预览和发送状态。
- 点击发送时，图片附件能进入 `turn/start` 的 `input.content`。
- 支持图片的 Profile 覆盖能通过 App Server 校验并创建 turn。
- 不支持图片的模型会在 App Server 阶段稳定拒绝。
- 纯文本发送不回归。
- `desktop:build`、`build`、`typecheck`、`smoke:turn-input` 通过。

## 建议验证命令

```powershell
npm.cmd run desktop:build
npm.cmd run build
npm.cmd run typecheck
npm.cmd run smoke:turn-input
git diff --check
```

## 完成记录

- Desktop main/preload 已新增图片附件准备入口，负责读取验证、10 MB 本地上限、mime type 归一化和缩略图生成。
- Composer 已能显示图片预览，并在发送时把可发送图片转成 `turn/start.input.content` 的 `image` block。
- 纯文本发送仍走旧 `input.type = "text"`；图片发送走新 `input.type = "content"`。
- `smoke:turn-input` 已覆盖支持图片的 Profile 覆盖 + `source.kind = "file"` 的 image block。
- 当前仍不做 provider adapter 的真实图片请求映射，下一步先做 MM-06 文本文件输入策略，再进入 MM-07。
- 验证通过：`desktop:build`、`typecheck`、`build`、`smoke:turn-input`、`smoke:app-server`、`git diff --check`。
