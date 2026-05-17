# Goal: P23-8 用户消息附件展示、输出媒体归一化与历史恢复

## 目标

让已经发送的图片和文件附件不再只显示成纯文本占位，而是进入 Desktop 现有展示模型，并能在历史会话恢复时重新展示。

第一版重点是展示和恢复，不重新设计上传、发送、provider 能力或大文件解析。

## 为什么先做这个

MM-05 到 MM-07 已经打通“附件可以进入内容块并映射到 provider 请求”。但用户看到的聊天区仍主要是：

```text
[图片附件：xxx.png]
[文本文件：xxx.md]
```

这会造成两个问题：

- 当前消息看不出附件的类型、大小、路径安全和是否来自用户上传。
- 历史恢复只回放文本，内容块里的图片/文件信息无法回到 UI。

P21 已经有 `AttachmentSnapshot`、`FileSnapshot`、`FileCard` 和 `DisplayEvent`，所以本阶段应复用这套模型，只补内容块到展示快照的桥接。

## 第一版范围

1. 从 `text/image/file/audio/attachment` 内容块提取 `AttachmentSnapshot`。
2. 用户消息 `DisplayEvent` 支持携带多个附件快照。
3. `MessageFrame` / `UserMessage` 能在文本下方展示紧凑附件条。
4. 历史恢复遇到用户内容块时走 completed item 回放，不再降级成纯文本。
5. 工具结果或助手输出里出现图片/文件内容块时，也能挂同一组附件快照。
6. 本地路径只展示元信息和可复制路径，不读取文件内容。
7. 保持现有 FileCard、工具卡、权限卡、thinking 展示不回归。

## 明确不做

- 不做图片大预览灯箱。
- 不做图片缩略图持久化。
- 不做 PDF / Office / 压缩包解析。
- 不做音频播放器和视频播放器。
- 不做模型生成图片的专用创作工作流。
- 不改变 provider adapter 和能力校验。

这些留给 MM-09 真机验收之后的增强项。

## 验收标准

- 当前发送的图片附件在用户消息下方显示附件条。
- 当前发送的小文本文件在用户消息下方显示附件条。
- 历史恢复中带 `image/file/audio` 内容块的用户消息能恢复附件条。
- 工具结果里出现图片或文件内容块时，不再只展示 raw JSON。
- 附件展示不输出 base64。
- `desktop:build`、`typecheck`、display-event smoke 通过。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run desktop:build
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:turn-input
git diff --check
```

## 完成记录

状态：已完成。

结果：

- `DisplayEvent` 新增多附件快照 `attachmentSnapshots`，事件合并和工具生命周期合并会保留附件列表。
- `fileEvents.ts` 统一从用户内容块、工具结果内容块和 `attachment` wrapper 中提取附件快照，并继续过滤 `todo_reminder` 等不应渲染的系统 attachment。
- `MessageFrame` / `UserMessage` / `ToolCard` 已复用紧凑附件条，显示类型、名称、mime、大小、路径并支持复制路径。
- 历史恢复中，用户 `content` block 会走 completed item replay，带 `image/file/audio` 的历史消息能恢复附件条。
- display-event fixture/smoke 已覆盖用户消息多附件和浏览器工具输出媒体。

验证：

- `npm.cmd run typecheck`
- `npm.cmd run smoke:desktop-display-events`
- `npm.cmd run desktop:build`
- `npm.cmd run smoke:turn-input`

留到 MM-09：

- 真实 provider 图片请求验收。
- Desktop 真机发送图片 / 小文本文件后检查附件条。
- 根据真机结果决定是否补文件缺失检测或更强媒体预览。
