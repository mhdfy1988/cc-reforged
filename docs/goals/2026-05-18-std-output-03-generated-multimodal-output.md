# Goal: STD-OUTPUT-03 生成型多模态输出设计

## 目标

补齐模型自己生成图片、音频、文件这类输出的标准表示、生命周期和安全边界，让 Desktop 能展示模型生成物，而不是只展示用户上传附件或工具输出附件。

这属于多模型输入输出协议的输出侧：输入附件由 P23 处理，provider 原始输出归一化由 STD-DISPLAY-02 处理，本阶段处理“模型生成物怎么被 CCR 接住、展示、恢复和管控”。

## 第一版范围

本次优先做：

- 在 `CcrContentBlock` 的 image / file / audio / video 附件块上补生成来源、生命周期、安全状态、provider/model/outputId 等元数据。
- Desktop `AttachmentSnapshot` 支持 `ModelOutput` 来源和 `generated` 状态。
- Assistant message 遇到模型生成附件时，展示为模型生成输出，而不是工具附件。
- smoke 覆盖模型生成图片第一版展示和元数据恢复。

本次不做：

- 不接真实图片生成 / 音频生成 API。
- 不做二进制文件落盘或下载管理。
- 不实现完整安全扫描。
- 不做大型媒体播放器。

## 验收标准

- [x] CCR 内容块能表达模型生成图片、音频、文件的生成来源和生命周期。
- [x] Desktop 展示事件能把模型生成物识别为 `ModelOutput`。
- [x] 生成物快照包含 provider、model、outputId、安全状态和生命周期。
- [x] smoke 覆盖模型生成图片进入 assistant message 的展示链路。

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

- `CcrContentSource` 新增 `providerFile`，用于表达 provider 文件引用、可选临时 URL 和过期时间。
- `CcrAttachmentContentBlockBase` 新增：
  - `origin`：生成来源，例如 `model_output`。
  - `lifecycle`：`inline`、`referenced`、`temporary`、`persisted`、`expired`、`unknown`。
  - `safety`：`trusted`、`needs_review`、`blocked`、`unknown`。
  - `provider` / `model` / `outputId` / `expiresAt`。
- `AttachmentSnapshot` 新增 `ModelOutput` 来源和 `generated` 状态，并保留生成物生命周期、安全状态、provider、model、outputId。
- assistant message 中的模型生成附件会按 `ModelOutput` 展示，不再误标为工具输出附件。
- `MessageFrame` 的附件元信息会显示模型生成、provider/model、生命周期和安全状态。
- `smoke:desktop-display-events` 新增模型生成图片回归，验证标准内容块和 Desktop 展示快照。

已完成验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run smoke:desktop-display-events`
- `npm.cmd run smoke:provider-output-fixtures`
- `npm.cmd run desktop:build`
- `git diff --check`

后续保留：

- 真实 provider 生成 API 接入。
- 生成物下载、落盘和打开 / 保存动作。
- 完整安全扫描和大文件日志脱敏策略。
