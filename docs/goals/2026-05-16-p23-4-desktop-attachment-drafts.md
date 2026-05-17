# Goal: P23-4 Desktop 附件草稿队列与能力提示

## 目标

让 Desktop 输入框里的附件从“临时文件名标签”升级为可管理的附件草稿队列，并根据当前模型能力显示每个附件的发送状态。

这一阶段只做草稿队列和能力提示，不读取文件内容，不把附件真正随消息发送给模型。

## 为什么先做这个

MM-01 到 MM-03 已经补齐模型能力、App Server 发送前校验和 Core 内容块。Desktop 下一步需要让用户在发送前看懂“这个附件能不能发、为什么不能发、是否只是预览”，否则图片真实闭环会继续混在 UI、读取、协议和 provider adapter 里。

## 第一版范围

1. 复用现有 Composer 文件选择入口。
2. 附件选择改为草稿队列，可追加、删除。
3. 每个草稿记录文件名、大小、mime type、输入模态。
4. 根据当前 `modelCapabilities.inputModalities` 计算发送策略：
   - `sendable`：当前模型能力支持。
   - `convertible`：后续可转换为文本或其他内容块。
   - `preview_only`：只能保留预览/元信息。
   - `blocked`：明确不能发送。
5. 图片额外校验 `maxImages`、`maxImageBytes`、`mimeTypes`。
6. 模型切换后草稿状态自动重算。
7. UI 保持现有 CCR 暖色、细边框、紧凑工作台风格。

## 明确不做

- 不读取图片或文件正文。
- 不生成缩略图。
- 不通过 preload 获取真实路径。
- 不把草稿附件传入 `turn/start`。
- 不做 provider 图片真实请求。
- 不做发送后用户消息附件卡片。

这些留给 MM-05 到 MM-08。

## 验收标准

- Composer 能添加多个附件并逐个删除。
- 当前模型支持图片时，图片显示可发送。
- 当前模型不支持图片时，图片显示不支持。
- 文本文件显示可转换为文本。
- 二进制/未知文件默认只预览。
- 大图或不支持 mime type 给出阻止或需转换状态。
- 不影响纯文本发送。
- `desktop:build` 通过。

## 建议验证命令

```powershell
npm.cmd run desktop:build
npm.cmd run build
npm.cmd run typecheck
git diff --check
```

## 完成记录

- Composer 附件草稿队列已支持追加多个附件、重复去重和逐个删除。
- 草稿附件会按当前模型能力计算 `sendable`、`convertible`、`preview_only`、`blocked`。
- 图片附件已接入数量、大小和 mime type 的发送前状态提示。
- 本阶段仍不读取文件内容、不生成缩略图、不把附件发送给模型，真实图片发送进入 MM-05。
- 验证通过：`desktop:build`、`build`、`typecheck`、`smoke:turn-input`、`smoke:app-server`、`git diff --check`。
