# Goal: P23-9 Smoke、真机验收和文档收口

## 目标

把 P23 多模态第一版从“各分项已实现”收束到“有统一回归护栏、清楚的真机验收口径和可提交的文档状态”。

本阶段不再新增大功能，重点是验证、补漏和确认边界。

## 为什么最后做这个

MM-01 到 MM-08 已经分别完成能力声明、输入协议、Core 内容块、Desktop 草稿队列、图片/文本文件输入、provider adapter 映射、附件展示和历史恢复。

如果现在不做统一收口，后续很容易出现两类问题：

- 某个阶段单独 smoke 通过，但完整链路组合后退化。
- 文档写着支持多模态，但真实 Desktop 或 provider 验收边界不清楚。

所以 MM-09 的任务是把第一版的“能做什么 / 不能做什么 / 怎么验证”一次性钉住。

## 第一版验收范围

1. 自动 smoke：
   - 模型能力解析。
   - App Server 新旧 `turn/start` 输入。
   - Core 内容块保留。
   - Desktop display event 附件展示。
   - Provider adapter 离线图片请求体映射。
   - App Server 基础回归。
2. 构建与类型：
   - `typecheck`
   - `build`
   - `desktop:build`
   - `git diff --check`
3. 真机验收口径：
   - 文本模型发送图片应在发送前或 App Server 阶段被阻止。
   - 支持图片的 Profile 覆盖发送图片应创建 turn，并进入 provider adapter 映射。
   - Desktop 当前用户消息能看到图片附件条。
   - 小文本文件能作为文本进入上下文，并在当前用户消息看到附件条。
   - 历史恢复中带图片/文件内容块的消息能恢复附件条。
4. 文档收口：
   - `multimodal-input-output-todo.md` 标出最终完成项和剩余增强。
   - `app-server-todo.md` P23 子任务状态同步。
   - `multimodal-input-output-design.md` 写清当前实现快照和非目标。
   - `docs/README.md` / `docs/goals/README.md` 入口齐全。

## 明确不做

- 不打包发布。
- 不提交 release。
- 不新增 PDF / Office / 音频 / 视频解析。
- 不做文件缺失探测和大型媒体预览。
- 不新增新的 provider 或账号配置。
- 不把真实 API key、base64 图片或本地敏感路径写进日志。

## 验收标准

- 自动验证命令全部通过，或对无法自动跑的真机项给出明确原因和后续手工步骤。
- 文档与 todo 指针一致，P23 第一版状态不再含糊。
- 如果发现返修项，必须登记为 P23 后续增强或修复项，不把 MM-09 标成假完成。
- 本轮只 commit/push 不打包发布，等多模态完成后再发布。

## 建议验证命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run desktop:build
npm.cmd run smoke:model-capabilities
npm.cmd run smoke:turn-input
npm.cmd run smoke:multimodal-provider-mapping
npm.cmd run smoke:codex-oauth-provider
npm.cmd run smoke:desktop-display-events
npm.cmd run smoke:app-server
git diff --check
```

## 本轮进展

状态：已完成。

真机复查新增返修项：

- 开发版 Desktop 在 `codex-oauth / gpt-5.5` 下选择图片后仍显示“不支持”。
- 根因不是前端标签，而是内置能力目录仍把 `gpt-5.5` 标成 text-only，且 `CodexOAuthProvider` 发送层还会拒绝非文本用户内容。
- 本阶段允许补这个最小闭环：只打开已验证目标 `gpt-5.5` 的图片输入，保留 `gpt-5.4` / `gpt-5.4-mini` 文本策略，并用 smoke 防止“UI 允许但 provider 不能发”的假支持。

已完成自动验证：

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run desktop:build`
- `npm.cmd run smoke:model-capabilities`
- `npm.cmd run smoke:turn-input`
- `npm.cmd run smoke:multimodal-provider-mapping`
- `npm.cmd run smoke:codex-oauth-provider`
- `npm.cmd run smoke:desktop-display-events`
- `npm.cmd run smoke:app-server`
- `git diff --check`

已完成本次返修验证：

- 当前配置运行时状态解析为 `codex-oauth / gpt-5.5 / inputModalities = ["text", "image"]`。
- `smoke:codex-oauth-provider` 验证 `gpt-5.5` 图片输入会映射为 pi-ai `image` content block，且不会把本地路径或 data URL 写入上下文。
- 开发版 Desktop 已重启到最新代码，便于继续做真实图片发送验收。

粘贴附件返修：

- Composer 输入框已接入 `onPaste`，从剪贴板中提取文件或图片并加入现有附件草稿队列。
- 从资源管理器复制文件后粘贴，继续复用已有文件路径准备逻辑。
- 截图、微信或浏览器复制得到的无路径图片，会把二进制内容通过 IPC 交给 main，main 写入 `userData/attachments/clipboard` 受控临时文件，再返回 `file` source 和缩略图。
- Renderer 状态不保存 base64；普通日志不输出图片 payload。

已完成真机验收：

- 开发版 Desktop 图片附件和小文本文件发送验收已完成。
- `codex-oauth / gpt-5.5` 真实图片请求已完成，模型能读取图片内容。
- 文本模型发送图片会被拦截，不会偷偷把图片发给上游。
- 图片粘贴、图片点开预览、小文本文件、历史附件恢复和中断返修均已复测通过。
- 历史中已落盘的 `tool_use` 中断恢复为工具卡“已中断”；过早中断只剩用户消息时显示“本轮已中断，未产生可恢复回复。”，不再显示内部 `No response requested.`。

说明：

- 本阶段不打包发布。
- 当前阶段只做 commit + push；等多模态完成后再发布。
