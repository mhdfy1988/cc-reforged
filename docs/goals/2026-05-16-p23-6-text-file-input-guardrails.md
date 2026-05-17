# Goal: P23-6 文本文件输入策略与大文件保护

## 目标

让 Desktop 选择的小文本文件可以安全进入模型上下文，同时阻止大文本、二进制和压缩包被自动全文塞进消息。

本阶段的目标不是“所有文件都能发”，而是建立清晰策略：

```text
小文本文件 -> 读取为 text content block
大文本文件 -> 只保留元信息，后续再做确认或摘要
二进制/压缩包 -> 只预览元信息，不进入模型
```

## 为什么先做这个

MM-05 已经让图片附件能进入 `turn/start` image block。文件输入比图片更容易把上下文打爆，也更容易误发二进制内容。

先把文本文件的大小边界、发送策略和 UI 提示定住，后续 provider adapter 才能只处理已经被 CCR 安全整理过的内容。

## 第一版范围

1. 复用 MM-05 的 main/preload 附件准备入口。
2. 小文本文件由 Desktop main 读取为 UTF-8 文本。
3. 文本文件进入 `turn/start.input.content` 时转换为 `text` block。
4. 文本 block 包含文件名、mime type、大小和文件正文。
5. 大文本文件不读取全文，只返回 `metadata_only` 状态。
6. 二进制、压缩包、未知文件默认 `metadata_only`，不进入模型。
7. Renderer 明确显示：
   - 可发送
   - 过大，仅元信息
   - 仅预览
   - 读取失败
8. 纯文本和图片发送不回归。

## 明确不做

- 不做大文本确认弹窗。
- 不做文件摘要、分片读取或检索式引用。
- 不做 PDF / Office 解析。
- 不做压缩包展开。
- 不做 provider 原生 file input。
- 不做发送后用户消息附件卡片和历史恢复。

这些留给 MM-07 之后的 provider 映射、MM-08 展示恢复和后续文件增强。

## 第一版限制

- 小文本文件上限先设为 128 KB。
- 只按常见文本 mime type 和扩展名识别文本文件。
- 读取失败或无法拿到本地路径时，不让文件内容进入上下文。
- 文本文件内容不写入普通日志。

## 验收标准

- `.txt`、`.md`、`.json` 等小文本文件显示可发送。
- 发送小文本文件时，`turn/start.input.content` 包含文本文件正文。
- 大文本文件显示只保留元信息，不随消息发送。
- 二进制/压缩包显示仅预览，不随消息发送。
- 纯文本发送和图片发送不回归。
- `desktop:build`、`build`、`typecheck`、`smoke:turn-input` 通过。

## 建议验证命令

```powershell
npm.cmd run desktop:build
npm.cmd run build
npm.cmd run typecheck
npm.cmd run smoke:turn-input
npm.cmd run smoke:app-server
git diff --check
```

## 完成记录

- Desktop main/preload 附件准备入口已支持小文本文件、图片和普通文件元信息。
- 小文本文件 128 KB 以内会按 UTF-8 读取，并在发送时作为 `text` content block 进入 `turn/start.input.content`。
- 大文本文件返回 `metadata_only`，不会读取全文或自动塞进上下文。
- 二进制、压缩包和未知文件默认只预览元信息，不随消息发送。
- Composer 已显示文本文件的可发送、读取中、读取失败、仅元信息和仅预览状态。
- `smoke:turn-input` 已补充文本文件转 text block 的协议样例。
- 验证通过：`typecheck`、`desktop:build`、`build`、`smoke:turn-input`。
